import type { Pool } from "pg"
import type { DeliveryAttempt, DeliveryRecord } from "../../application/publishing/delivery-view"

type Row = {
  id: string; week: string; run_id: string; version: number; post_key: string; channel: "facebook" | "instagram"
  account_name: string; publish_at: Date; cancelled: boolean; can_publish: boolean; attempts: DeliveryAttempt[]
}

/** Tenant-scoped projection; no payloads, credentials or provider response messages leave storage. */
export async function readDeliveryRecords(pool: Pool, scope: { ownerId: string; brandId: string }): Promise<DeliveryRecord[]> {
  const access = await pool.query(`SELECT b.id FROM brands b JOIN workspaces w ON w.id=b.workspace_id
    WHERE b.id=$1 AND w.owner_user_id=$2`, [scope.brandId, scope.ownerId])
  if (!access.rowCount) throw new Error("Brand access denied")
  const { rows } = await pool.query<Row>(`SELECT s.id,r.week_start::text AS week,r.id AS run_id,r.version,i.post_key,s.channel,
    coalesce(p.display_name,p.username,s.channel) AS account_name,
    coalesce(moved.publish_at,s.publish_at) AS publish_at,coalesce(e.event_type='cancelled',false) AS cancelled,
    coalesce(b.connection_status='connected' AND b.can_publish AND profile.status='active',false) AS can_publish,
    coalesce(attempts.items,'[]'::jsonb) AS attempts
    FROM social_content_schedules s
    JOIN brands brand ON brand.id=s.brand_id JOIN workspaces w ON w.id=brand.workspace_id
    JOIN social_publication_inputs i ON i.id=s.publication_input_id AND i.brand_id=s.brand_id
    JOIN weekly_planning_runs r ON r.id=i.source_weekly_run_id AND r.brand_id=s.brand_id
    JOIN social_publishing_accounts p ON p.id=s.publishing_account_id AND p.brand_id=s.brand_id AND p.channel=s.channel
    LEFT JOIN social_provider_account_bindings b ON b.publishing_account_id=p.id AND b.binding_status='active'
    LEFT JOIN social_provider_profiles profile ON profile.provider=b.provider AND profile.provider_profile_ref=b.provider_profile_ref
    LEFT JOIN LATERAL (SELECT event_type FROM social_content_schedule_events WHERE schedule_id=s.id ORDER BY revision DESC LIMIT 1) e ON true
    LEFT JOIN LATERAL (SELECT publish_at FROM social_content_schedule_events WHERE schedule_id=s.id AND event_type='rescheduled' ORDER BY revision DESC LIMIT 1) moved ON true
    LEFT JOIN LATERAL (
      SELECT jsonb_agg(jsonb_build_object('number',a.attempt_number,'attemptedAt',a.attempted_at,'requestState',j.state,
        'result',result.status,'recordedAt',result.recorded_at,'retryAfter',result.retry_after,'publishedAt',result.published_at,
        'reconciliation',c.status,'reconciledAt',c.checked_at,'reconciledPublishedAt',c.published_at,'failureType',c.failure_type)
        ORDER BY a.attempt_number DESC) AS items
      FROM social_publish_attempts a
      LEFT JOIN social_provider_publish_requests j ON j.attempt_id=a.id
      LEFT JOIN social_publish_results result ON result.attempt_id=a.id
      LEFT JOIN LATERAL (SELECT status,checked_at,published_at,failure_type FROM social_publish_reconciliations
        WHERE attempt_id=a.id ORDER BY (status<>'inconclusive') DESC,checked_at DESC,id DESC LIMIT 1) c ON true
      WHERE a.schedule_id=s.id AND a.publishing_account_id=s.publishing_account_id AND a.channel=s.channel
    ) attempts ON true
    WHERE s.brand_id=$1 AND w.owner_user_id=$2
    ORDER BY coalesce(moved.publish_at,s.publish_at) DESC,s.id`, [scope.brandId, scope.ownerId])
  return rows.map((row) => ({ id: row.id, week: row.week, runId: row.run_id, version: row.version, postKey: row.post_key,
    channel: row.channel, accountName: row.account_name, publishAt: row.publish_at.toISOString(), cancelled: row.cancelled,
    canPublish: row.can_publish, attempts: row.attempts }))
}
