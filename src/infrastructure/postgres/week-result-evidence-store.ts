import type { Pool, PoolClient } from "pg"
import { evidencePeriod, evidenceWeeks, summarizeWeekResults, type ConfirmedPublication } from "../../application/analytics/week-evidence"
import { SOCIAL_METRIC_NAMES, type SocialAnalyticsResult } from "../../application/analytics/social-analytics-store"
import { readWeekEvidence } from "./social-strategy-store"

const MAX_PUBLICATION_ROWS = 400

/** Reconstruct old and new links from immutable delivery records. Repeated reads do not mutate history. */
export async function readWeekResultEvidence(db: Pool | PoolClient, ownerId: string, brandId: string, targetWeek: string, asOf = new Date().toISOString()) {
  const weeks = evidenceWeeks(targetWeek)
  const start = evidencePeriod(weeks.at(-1)!).start, end = evidencePeriod(targetWeek).end
  const rows = await db.query(`WITH confirmed AS (
    SELECT attempt_id,provider_publication_ref,published_at,recorded_at AS confirmed_at,false AS reconciled
    FROM social_publish_results WHERE status='published' AND recorded_at<=$4::timestamptz AND evidence_recorded_at<=$4::timestamptz
    UNION ALL
    SELECT r.attempt_id,r.provider_publication_ref,r.published_at,r.checked_at AS confirmed_at,true AS reconciled
    FROM social_publish_reconciliations r JOIN social_publish_results u ON u.id=r.unknown_result_id AND u.attempt_id=r.attempt_id AND u.status='unknownOutcome'
    JOIN social_publish_attempts ra ON ra.id=r.attempt_id AND ra.content_id=r.content_id AND ra.draft_id=r.draft_id AND ra.draft_version=r.draft_version
      AND ra.schedule_id=r.schedule_id AND ra.schedule_revision=r.schedule_revision AND ra.publishing_account_id=r.publishing_account_id AND ra.channel=r.channel
    WHERE r.status='publicationFound' AND r.checked_at<=$4::timestamptz AND r.created_at<=$4::timestamptz AND u.evidence_recorded_at<=$4::timestamptz
  ) SELECT a.id AS attempt_id,a.publishing_account_id,a.channel,a.content_id,a.draft_id,a.draft_version,a.schedule_id,
    i.id AS input_id,i.source_weekly_run_id,i.post_key,j.provider,j.provider_binding_id,c.provider_publication_ref,c.published_at,c.confirmed_at,
    b.provider_profile_ref,b.provider_account_ref,m.id AS snapshot_id,coalesce(m.native_publication_ref,n.native_ref) AS native_publication_ref,n.identity_conflict,m.publication_url,
    m.provider_updated_at,m.observed_at,m.created_at AS stored_at,m.metric_contract,m.metric_availability,m.raw_metrics,
    ${SOCIAL_METRIC_NAMES.map(name => `m.${name}`).join(",")},m.engagement_rate
    FROM confirmed c JOIN social_publish_attempts a ON a.id=c.attempt_id
    JOIN social_content_schedules s ON s.id=a.schedule_id AND s.publishing_account_id=a.publishing_account_id
      AND s.content_id=a.content_id AND s.draft_id=a.draft_id AND s.draft_version=a.draft_version AND s.channel=a.channel
    JOIN social_publication_inputs i ON i.id=s.publication_input_id AND i.brand_id=s.brand_id
      AND i.content_id=a.content_id AND i.draft_id=a.draft_id AND i.draft_version=a.draft_version AND i.channel=a.channel
    JOIN weekly_planning_runs run ON run.id=i.source_weekly_run_id AND run.brand_id=i.brand_id
    JOIN social_provider_publish_requests j ON j.attempt_id=a.id
      AND (c.reconciled OR c.provider_publication_ref=j.provider_publication_ref OR c.provider_publication_ref=j.duplicate_publication_ref)
    JOIN social_provider_account_bindings b ON b.id=j.provider_binding_id AND b.publishing_account_id=a.publishing_account_id
      AND b.brand_id=i.brand_id AND b.channel=a.channel AND b.provider=j.provider
    JOIN brands brand ON brand.id=i.brand_id JOIN workspaces w ON w.id=brand.workspace_id
    LEFT JOIN LATERAL (SELECT m.* FROM social_post_analytics m
      WHERE m.publishing_account_id=a.publishing_account_id AND m.provider_binding_id=b.id AND m.provider=j.provider
        AND m.provider_publication_ref=c.provider_publication_ref AND m.provider_updated_at>=c.published_at
        AND m.provider_updated_at<=$4::timestamptz AND m.observed_at<=$4::timestamptz AND m.created_at<=$4::timestamptz
      ORDER BY m.provider_updated_at DESC,m.observed_at DESC,m.id LIMIT 1) m ON true
    LEFT JOIN LATERAL (SELECT CASE WHEN min(h.native_publication_ref)=max(h.native_publication_ref) THEN min(h.native_publication_ref) END AS native_ref,
      count(DISTINCT h.native_publication_ref)>1 AS identity_conflict FROM social_post_analytics h
      WHERE h.publishing_account_id=a.publishing_account_id AND h.provider_binding_id=b.id AND h.provider=j.provider
        AND h.provider_publication_ref=c.provider_publication_ref AND h.native_publication_ref IS NOT NULL
        AND h.provider_updated_at>=c.published_at AND h.provider_updated_at<=$4::timestamptz AND h.observed_at<=$4::timestamptz AND h.created_at<=$4::timestamptz) n ON true
    WHERE i.brand_id=$1 AND w.owner_user_id=$2 AND c.published_at>=$3::timestamptz
      AND c.published_at<$5::timestamptz AND c.published_at<=$4::timestamptz
    ORDER BY c.published_at DESC,a.id LIMIT $6`, [brandId, ownerId, start, asOf, end, MAX_PUBLICATION_ROWS + 1])
  const truncated = rows.rows.length > MAX_PUBLICATION_ROWS
  const publications: ConfirmedPublication[] = rows.rows.slice(0, MAX_PUBLICATION_ROWS).map(row => {
    const measurement: ConfirmedPublication["measurement"] = row.snapshot_id ? {
      snapshotId: row.snapshot_id, storedAt: row.stored_at.toISOString(), provider: row.provider, providerProfileRef: row.provider_profile_ref,
      providerAccountRef: row.provider_account_ref, publishingAccountId: row.publishing_account_id, providerBindingId: row.provider_binding_id,
      channel: row.channel, providerPublicationRef: row.provider_publication_ref, nativePublicationRef: row.native_publication_ref,
      publicationUrl: row.publication_url, providerUpdatedAt: row.provider_updated_at.toISOString(), observedAt: row.observed_at.toISOString(),
      metricContract: row.metric_contract, availability: row.metric_availability, rawMetrics: row.raw_metrics,
      metrics: Object.fromEntries([...SOCIAL_METRIC_NAMES.map(name => [name, row[name] === null ? null : Number(row[name])]),
        ["engagementRate", row.engagement_rate === null ? null : Number(row.engagement_rate)]]) as SocialAnalyticsResult["metrics"]
    } : null
    return { publishingAccountId: row.publishing_account_id, channel: row.channel, provider: row.provider,
      providerPublicationRef: row.provider_publication_ref, publishedAt: row.published_at.toISOString(), confirmedAt: row.confirmed_at.toISOString(), identityConflict: row.identity_conflict,
      lineage: { publicationInputId: row.input_id, runId: row.source_weekly_run_id, postKey: row.post_key, contentId: row.content_id,
        draftId: row.draft_id, draftVersion: row.draft_version, scheduleId: row.schedule_id, attemptId: row.attempt_id, providerBindingId: row.provider_binding_id }, measurement }
  })
  const manual = (await readWeekEvidence(db, ownerId, brandId)).filter(e => Date.parse(e.reviewedAt) <= Date.parse(asOf))
  return weeks.map(week => summarizeWeekResults({ week, asOf, publications, manual: manual.find(e => e.week === week), truncated }))
}
