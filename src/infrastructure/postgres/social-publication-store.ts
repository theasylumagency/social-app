import { createHash } from "node:crypto"
import type { Pool, PoolClient } from "pg"
import type {
  SocialContentPublishAttemptId, SocialContentPublishResultId, SocialContentSchedule,
  SocialContentScheduleEvent, SocialContentScheduleLifecycleState, SocialPublishingAccount,
} from "../../blueprints/social"
import { createInitialSocialContentScheduleLifecycleState, rescheduleSocialContent, cancelSocialContentSchedule } from "../../blueprints/social/content-schedule-lifecycle"
import type { IsoDateTime } from "../../core/domain/primitives"
import { decodeSocialPublicationBundle } from "../../application/publishing/publication-bundle-codec"
import type { DueSocialPublication, PersistedSocialSchedule, SocialPublicationStore } from "../../application/publishing/publication-store"
import type { PublicationAssetSource, PublishableAsset } from "../../application/publishing/delivery-store"

type ScheduleRow = {
  id: string; brand_id: string; publication_input_id: string; publishing_account_id: string; content_id: string;
  draft_id: string; draft_version: number; content_execution_spec_id: string; channel: "facebook" | "instagram";
  authorization: SocialContentSchedule["authorization"]; publish_at: Date; scheduled_at: Date; post_key?: string;
}
type EventRow = { id: string; schedule_id: string; revision: number; event_type: "rescheduled" | "cancelled"; publish_at: Date | null;
  actor_user_id: string; occurred_at: Date; reason: string | null }

const stable = (kind: string, values: readonly (string | number)[]) => `social:${kind}:${createHash("sha256").update(values.join("\u0000")).digest("hex")}`
const scheduleFrom = (row: ScheduleRow): SocialContentSchedule => ({ id: row.id, contentId: row.content_id, draftId: row.draft_id,
  draftVersion: row.draft_version, contentExecutionSpecId: row.content_execution_spec_id, channel: row.channel,
  authorization: row.authorization, publishAt: row.publish_at.toISOString(), scheduledAt: row.scheduled_at.toISOString() }) as SocialContentSchedule

function lifecycle(schedule: SocialContentSchedule, rows: readonly EventRow[]): SocialContentScheduleLifecycleState {
  let state = createInitialSocialContentScheduleLifecycleState(schedule)
  for (const row of rows) {
    if (row.event_type === "rescheduled") state = rescheduleSocialContent({ id: row.id as never, schedule, currentState: state,
      publishAt: row.publish_at!.toISOString() as IsoDateTime, changedBy: row.actor_user_id as never,
      changedAt: row.occurred_at.toISOString() as IsoDateTime }).state
    else state = cancelSocialContentSchedule({ id: row.id as never, schedule, currentState: state,
      ...(row.reason ? { reason: row.reason } : {}), changedBy: row.actor_user_id as never,
      changedAt: row.occurred_at.toISOString() as IsoDateTime }).state
  }
  return state
}

async function assertBrand(client: PoolClient, ownerId: string, brandId: string) {
  const row = await client.query(`SELECT b.id FROM brands b JOIN workspaces w ON w.id=b.workspace_id
    WHERE b.id=$1 AND w.owner_user_id=$2 FOR UPDATE OF b`, [brandId, ownerId])
  if (!row.rowCount) throw new Error("Brand access denied")
}

async function eventsFor(client: Pool | PoolClient, ids: readonly string[]) {
  if (!ids.length) return new Map<string, EventRow[]>()
  const rows = await client.query<EventRow>("SELECT * FROM social_content_schedule_events WHERE schedule_id=ANY($1::text[]) ORDER BY schedule_id,revision", [ids])
  const map = new Map<string, EventRow[]>()
  for (const row of rows.rows) map.set(row.schedule_id, [...(map.get(row.schedule_id) ?? []), row])
  return map
}

export class PostgresSocialPublicationStore implements SocialPublicationStore {
  constructor(private readonly pool: Pool) {}

  async saveSchedules(input: Parameters<SocialPublicationStore["saveSchedules"]>[0]) {
    const client = await this.pool.connect()
    try {
      await client.query("BEGIN")
      await assertBrand(client, input.ownerId, input.brandId)
      const approved = await client.query<{ approved_at: Date; approved_by_user_id: string }>(`SELECT p.approved_at,p.approved_by_user_id
        FROM weekly_post_batches p JOIN weekly_planning_runs r ON r.id=p.run_id
        WHERE p.run_id=$1 AND r.brand_id=$2 AND r.owner_user_id=$3 AND r.status='approved' AND p.status='ready'
          AND p.approved_at=$4::timestamptz AND p.approved_by_user_id=$5 FOR UPDATE OF p`,
      [input.sourceRunId, input.brandId, input.ownerId, input.approvalAt, input.approvalActorId])
      if (!approved.rowCount || input.actorId !== input.ownerId) throw new Error("Approved weekly content changed or access was denied")
      const saved: PersistedSocialSchedule[] = []
      for (const item of input.records) {
        const p = item.publication
        if (p.brandId !== input.brandId || p.sourceWeeklyRunId !== input.sourceRunId || p.channel !== item.schedule.channel) {
          throw new Error("Publication input lineage mismatch")
        }
        const account = await client.query(`SELECT a.id FROM social_publishing_accounts a JOIN social_provider_account_bindings b
          ON b.publishing_account_id=a.id AND b.channel=a.channel AND b.binding_status='active'
          JOIN social_provider_profiles profile ON profile.brand_id=b.brand_id AND profile.provider=b.provider AND profile.provider_profile_ref=b.provider_profile_ref
          WHERE a.id=$1 AND a.brand_id=$2 AND a.channel=$3 AND b.connection_status='connected' AND b.can_publish=true AND profile.status='active'`,
        [item.publishingAccountId, input.brandId, p.channel])
        if (!account.rowCount) throw new Error("Publishing account is not connected or cannot publish")
        await client.query(`INSERT INTO social_publication_inputs(id,brand_id,source_weekly_run_id,post_key,channel,content_id,
          content_brief_id,content_execution_spec_id,draft_id,draft_version,bundle_schema,bundle_version,bundle)
          VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13::jsonb)
          ON CONFLICT(id) DO UPDATE SET id=social_publication_inputs.id
          RETURNING id`, [p.id, p.brandId, p.sourceWeeklyRunId, p.postKey, p.channel, p.contentId, p.contentBriefId,
          p.contentExecutionSpecId, p.draftId, p.draftVersion, p.schema, p.version, JSON.stringify(p.bundle)])
        const canonical = await client.query(`SELECT id FROM social_publication_inputs
          WHERE id=$1 AND bundle_schema=$2 AND bundle_version=$3 AND bundle=$4::jsonb AND brand_id=$5 AND source_weekly_run_id=$6
            AND post_key=$7 AND channel=$8 AND draft_id=$9 AND draft_version=$10`,
        [p.id, p.schema, p.version, JSON.stringify(p.bundle), p.brandId, p.sourceWeeklyRunId, p.postKey, p.channel, p.draftId, p.draftVersion])
        if (!canonical.rowCount) throw new Error("Publication input is immutable")
        const required = p.bundle.draft.format === "staticPost" && p.bundle.contentExecutionSpec.visualDependency === "none" ? 0
          : p.bundle.draft.format === "carousel" || p.bundle.draft.format === "story" ? p.bundle.draft.frames.length : 1
        const assets = await client.query<{ id: string; slot: number }>(`SELECT id::text,slot FROM weekly_post_assets
          WHERE run_id=$1 AND post_key=$2 ORDER BY slot`, [input.sourceRunId, p.postKey])
        if (assets.rowCount !== required || assets.rows.some((row, ordinal) => row.slot !== ordinal)) throw new Error("mediaManifestIncomplete")
        for (const [ordinal, asset] of assets.rows.entries()) await client.query(`INSERT INTO social_publication_input_assets
          (publication_input_id,ordinal,weekly_post_asset_id,media_type) VALUES($1,$2,$3,'image/webp') ON CONFLICT DO NOTHING`, [p.id, ordinal, asset.id])
        const s = item.schedule
        const inserted = await client.query<ScheduleRow>(`INSERT INTO social_content_schedules(id,brand_id,publication_input_id,publishing_account_id,
          content_id,draft_id,draft_version,content_execution_spec_id,channel,"authorization",publish_at,scheduled_at)
          VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11,$12)
          ON CONFLICT(publication_input_id,publishing_account_id) DO NOTHING RETURNING *`, [s.id, input.brandId, p.id, item.publishingAccountId,
          s.contentId, s.draftId, s.draftVersion, s.contentExecutionSpecId, s.channel, JSON.stringify(s.authorization), s.publishAt, s.scheduledAt])
        let row = inserted.rows[0]
        if (!row) {
          row = (await client.query<ScheduleRow>("SELECT * FROM social_content_schedules WHERE publication_input_id=$1 AND publishing_account_id=$2", [p.id, item.publishingAccountId])).rows[0]!
          if (row.id !== s.id || row.publish_at.toISOString() !== s.publishAt) throw new Error("Schedule already exists with different input")
        }
        const schedule = scheduleFrom(row)
        saved.push({ schedule, postKey: p.postKey, publishingAccountId: row.publishing_account_id, brandId: row.brand_id,
          lifecycle: createInitialSocialContentScheduleLifecycleState(schedule) })
      }
      await client.query("COMMIT")
      return saved
    } catch (error) { await client.query("ROLLBACK"); throw error } finally { client.release() }
  }

  async listSchedules(scope: { ownerId: string; brandId: string; sourceRunId?: string }) {
    const client = await this.pool.connect()
    try {
      await client.query("BEGIN")
      await assertBrand(client, scope.ownerId, scope.brandId)
      const rows = await client.query<ScheduleRow>(`SELECT s.*,i.post_key FROM social_content_schedules s JOIN social_publication_inputs i ON i.id=s.publication_input_id
        WHERE s.brand_id=$1 AND ($2::uuid IS NULL OR i.source_weekly_run_id=$2::uuid) ORDER BY s.publish_at,s.id`, [scope.brandId, scope.sourceRunId ?? null])
      const events = await eventsFor(client, rows.rows.map((row) => row.id))
      await client.query("COMMIT")
      return rows.rows.map((row) => { const schedule = scheduleFrom(row); return { schedule, postKey: row.post_key!, publishingAccountId: row.publishing_account_id,
        brandId: row.brand_id, lifecycle: lifecycle(schedule, events.get(row.id) ?? []) } })
    } catch (error) { await client.query("ROLLBACK"); throw error } finally { client.release() }
  }

  async appendScheduleEvent(scope: { ownerId: string; brandId: string }, event: SocialContentScheduleEvent) {
    const client = await this.pool.connect()
    try {
      await client.query("BEGIN")
      await assertBrand(client, scope.ownerId, scope.brandId)
      const row = await client.query("SELECT id FROM social_content_schedules WHERE id=$1 AND brand_id=$2 FOR UPDATE", [event.scheduleId, scope.brandId])
      if (!row.rowCount || event.changedBy !== scope.ownerId) throw new Error("Schedule access denied")
      await client.query(`INSERT INTO social_content_schedule_events(id,schedule_id,revision,event_type,publish_at,actor_user_id,occurred_at,reason)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT(id) DO NOTHING`, [event.id, event.scheduleId, event.revision, event.type,
        event.type === "rescheduled" ? event.publishAt : null, event.changedBy, event.createdAt, event.type === "cancelled" ? event.reason ?? null : null])
      await client.query("COMMIT")
    } catch (error) { await client.query("ROLLBACK"); throw error } finally { client.release() }
  }

  async claimDue(now: string, maxAttempts: number, limit = 20): Promise<readonly DueSocialPublication[]> {
    if (!Number.isInteger(maxAttempts) || maxAttempts < 1 || !Number.isInteger(limit) || limit < 1 || limit > 100) throw new Error("Invalid publish queue policy")
    const rows = await this.pool.query<ScheduleRow & { bundle_schema: string; bundle_version: number; bundle: unknown;
      provider: string; provider_account_ref: string; connection_status: string; can_publish: boolean; profile_status: string; last_attempt: number | null;
      last_status: string | null; retry_after: Date | null; event_type: string | null; event_publish_at: Date | null; revision: number }>(`
      WITH latest_event AS (SELECT DISTINCT ON (schedule_id) schedule_id,event_type,publish_at,revision FROM social_content_schedule_events ORDER BY schedule_id,revision DESC),
      latest_attempt AS (SELECT DISTINCT ON (schedule_id) schedule_id,attempt_number FROM social_publish_attempts ORDER BY schedule_id,attempt_number DESC),
      terminal AS (SELECT a.schedule_id,a.attempt_number,r.status,r.retry_after FROM social_publish_attempts a JOIN social_publish_results r ON r.attempt_id=a.id
        JOIN latest_attempt l ON l.schedule_id=a.schedule_id AND l.attempt_number=a.attempt_number),
      reconciled AS (SELECT DISTINCT ON (c.attempt_id) a.schedule_id,c.status,c.failure_type FROM social_publish_reconciliations c
        JOIN social_publish_attempts a ON a.id=c.attempt_id JOIN latest_attempt l ON l.schedule_id=a.schedule_id AND l.attempt_number=a.attempt_number
        WHERE c.status IN ('publicationFound','confirmedAbsent','publicationFailed') ORDER BY c.attempt_id,c.checked_at DESC,c.id DESC)
      SELECT s.*,i.post_key,i.bundle_schema,i.bundle_version,i.bundle,b.provider,b.provider_account_ref,b.connection_status,b.can_publish,p.status AS profile_status,
        l.attempt_number AS last_attempt,t.status AS last_status,t.retry_after,e.event_type,e.publish_at AS event_publish_at,coalesce(e.revision,0) AS revision
      FROM social_content_schedules s JOIN social_publication_inputs i ON i.id=s.publication_input_id
      LEFT JOIN latest_event e ON e.schedule_id=s.id LEFT JOIN latest_attempt l ON l.schedule_id=s.id LEFT JOIN terminal t ON t.schedule_id=s.id
      LEFT JOIN reconciled c ON c.schedule_id=s.id
      JOIN social_provider_account_bindings b ON b.publishing_account_id=s.publishing_account_id AND b.channel=s.channel AND b.binding_status='active'
      JOIN social_provider_profiles p ON p.brand_id=b.brand_id AND p.provider=b.provider AND p.provider_profile_ref=b.provider_profile_ref
      WHERE coalesce(e.event_type,'rescheduled')<>'cancelled' AND coalesce(e.publish_at,s.publish_at)<=$1::timestamptz
        AND b.connection_status='connected' AND b.can_publish=true AND p.status='active'
        AND (l.attempt_number IS NULL OR (t.status='retryableFailure' AND l.attempt_number<$2 AND (t.retry_after IS NULL OR t.retry_after<=$1::timestamptz))
          OR (t.status='unknownOutcome' AND l.attempt_number<$2 AND (c.status='confirmedAbsent' OR (c.status='publicationFailed' AND c.failure_type='retryable'))))
      ORDER BY coalesce(e.publish_at,s.publish_at),s.id LIMIT $3`, [now, maxAttempts, limit])
    return rows.rows.map((row) => {
      const schedule = scheduleFrom(row)
      const revision = Number(row.revision)
      const publishAt = (row.event_publish_at ?? row.publish_at).toISOString() as IsoDateTime
      const state = { scheduleId: schedule.id, contentId: schedule.contentId, draftId: schedule.draftId, draftVersion: schedule.draftVersion,
        revision, status: "scheduled" as const, publishAt }
      const attemptNumber = (row.last_attempt ?? 0) + 1
      return { schedule, postKey: row.post_key!, publishingAccountId: row.publishing_account_id, brandId: row.brand_id, lifecycle: state,
        bundle: decodeSocialPublicationBundle(row.bundle_schema, row.bundle_version, row.bundle), provider: row.provider,
        publishingAccount: { id: row.publishing_account_id, channel: row.channel, providerAccountRef: row.provider_account_ref, connected: true } as SocialPublishingAccount,
        attemptNumber, attemptId: stable("attempt", [row.id, attemptNumber]) as SocialContentPublishAttemptId,
        resultId: stable("result", [row.id, attemptNumber]) as SocialContentPublishResultId }
    })
  }
}

export class PostgresPublicationAssetSource implements PublicationAssetSource {
  constructor(private readonly pool: Pool) {}
  async load(attempt: { scheduleId: string }): Promise<readonly PublishableAsset[]> {
    const rows = await this.pool.query(`SELECT a.weekly_post_asset_id::text AS "sourceAssetId",w.name AS filename,a.media_type AS "contentType",w.content AS bytes
      FROM social_content_schedules s JOIN social_publication_input_assets a ON a.publication_input_id=s.publication_input_id
      JOIN weekly_post_assets w ON w.id=a.weekly_post_asset_id WHERE s.id=$1 ORDER BY a.ordinal`, [attempt.scheduleId])
    return rows.rows.map((row) => ({ sourceAssetId: row.sourceAssetId, filename: row.filename, contentType: row.contentType, bytes: Buffer.from(row.bytes) }))
  }
}
