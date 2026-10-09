import {readPostRevision,assertApprovedRevision} from "./post-revisions-store"
import {materializePostRevision} from "../../application/publishing/materialize-post-revision"
import { publicationFactualBlocker } from "../../application/publishing/factual-authority"
import { lockPublicKnowledge, readPublicKnowledge } from "./public-knowledge-store"
import { reviewDigest, reviewedPostDigest } from "../../application/weekly-planning/review-evidence"
import { weeklyBatchDigest, assertCurrentWeeklyApproval } from "../../application/weekly-planning/approval-evidence"
import type { PlanningRun } from "../../blueprints/social/weekly-planning/model"
import type { WeeklyApprovalEvidence } from "../../blueprints/social/weekly-planning/review-evidence"
import type { PostsPayload } from "../../blueprints/social/weekly-planning/posts"
import { createHash } from "node:crypto"
import type { Pool, PoolClient } from "pg"
import type {
  SocialContentPublishAttemptId, SocialContentPublishResultId, SocialContentSchedule,
  SocialContentScheduleEvent, SocialContentScheduleLifecycleState, SocialPublishingAccount,
} from "../../blueprints/social"
import { createInitialSocialContentScheduleLifecycleState, rescheduleSocialContent, cancelSocialContentSchedule } from "../../blueprints/social/content-schedule-lifecycle"
import type { IsoDateTime } from "../../core/domain/primitives"
import { decodeSocialPublicationBundle } from "../../application/publishing/publication-bundle-codec"
import type { DueSocialPublication, PersistedSocialSchedule, SocialPublicationStore, ScheduleChange } from "../../application/publishing/publication-store"
import type { PublicationAssetSource, PublishableAsset } from "../../application/publishing/delivery-store"

import { ScheduleConflict } from "../../application/publishing/schedule-errors"
import { resolveScheduleTime, type ScheduleTimeContext } from "../../application/publishing/schedule-time"

type ScheduleRow = {
  publication_confirmed?: boolean; last_status?: string | null; reconciliation_status?: string | null; attempt_count?: number; time_context?: ScheduleTimeContext | null; id: string; brand_id: string; publication_input_id: string; publishing_account_id: string; content_id: string;
  draft_id: string; draft_version: number; content_execution_spec_id: string; channel: "facebook" | "instagram";
  superseded_by_input_id?: string | null; approval_id?: string | null; authorization: SocialContentSchedule["authorization"]; publish_at: Date; scheduled_at: Date; post_key?: string;
}
type EventRow = { id: string; schedule_id: string; revision: number; event_type: "rescheduled" | "cancelled"; publish_at: Date | null;
  actor_user_id: string; occurred_at: Date; reason: string | null; time_context?: ScheduleTimeContext | null }

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
      await lockPublicKnowledge(client, input.brandId)
      await assertBrand(client, input.ownerId, input.brandId)
      const publicKnowledge = await readPublicKnowledge(client, input.brandId)
      const approved = await client.query<{ approved_at: Date; approved_by_user_id: string; payload: PostsPayload; version: number; run_payload: PlanningRun["payload"]; approval_evidence: WeeklyApprovalEvidence }>(`SELECT p.approved_at,p.approved_by_user_id,p.payload,r.version,r.payload AS run_payload,p.approval_evidence
        FROM weekly_post_batches p JOIN weekly_planning_runs r ON r.id=p.run_id
        WHERE p.run_id=$1 AND r.brand_id=$2 AND r.owner_user_id=$3 AND r.status='approved' AND p.status='ready'
          AND date_trunc('milliseconds',p.approved_at)=$4::timestamptz AND p.approved_by_user_id=$5 FOR UPDATE OF r,p`,
      [input.sourceRunId, input.brandId, input.ownerId, input.approvalAt, input.approvalActorId])
      if (!approved.rowCount || input.actorId !== input.ownerId) throw new Error("Approved weekly content changed or access was denied")
      const currentApproval = approved.rows[0]!
      assertCurrentWeeklyApproval({ id: input.sourceRunId, brandId: input.brandId, ownerId: input.ownerId,
        version: currentApproval.version, status: "approved", step: "ready", week: "", error: null, leaseUntil: null,
        createdAt: input.approvalAt, updatedAt: input.approvalAt, payload: currentApproval.run_payload },
      { runId: input.sourceRunId, status: "ready", step: "ready", error: null, leaseUntil: null, updatedAt: input.approvalAt,
        approvedAt: currentApproval.approved_at.toISOString(), approvedByUserId: currentApproval.approved_by_user_id,
        approvalEvidence: currentApproval.approval_evidence, payload: currentApproval.payload })
      if (!input.records.length) throw Error("Empty schedule request")
      const replacements = new Map<string, { id: string; superseded_by_input_id: string | null }[]>()
      const expected = new Set<string>()
      for (const { publication: p } of input.records) {
        const previous = await client.query<{ id: string; superseded_by_input_id: string | null }>(`SELECT id,superseded_by_input_id
          FROM social_publication_inputs WHERE brand_id=$1 AND source_weekly_run_id=$2 AND post_key=$3 AND channel=$4 AND id<>$5
          AND (superseded_by_input_id IS NULL OR superseded_by_input_id=$5) FOR UPDATE`, [input.brandId, input.sourceRunId, p.postKey, p.channel, p.id])
        replacements.set(p.id, previous.rows)
        previous.rows.forEach(row => expected.add(row.id))
      }
      const supplied = input.replaceInputIds ?? []
      if (new Set(supplied).size !== supplied.length || supplied.length !== expected.size || supplied.some(id => !expected.has(id)))
        throw new ScheduleConflict("განრიგის ვერსია შეიცვალა. განაახლეთ გვერდი და შეინახეთ ახალი ვერსია ძველი განრიგის ჩანაცვლებით.")
      if (expected.size && (await client.query(`SELECT 1 FROM social_publish_attempts a JOIN social_content_schedules s ON s.id=a.schedule_id
        WHERE s.publication_input_id=ANY($1::text[]) LIMIT 1`, [[...expected]])).rowCount)
        throw Error("ამ პოსტის გაგზავნის მცდელობა უკვე დაწყებულია; ახალი ვერსიით მისი ჩანაცვლება შეუძლებელია.")
      const saved: PersistedSocialSchedule[] = []
      for (const item of input.records) {
        const p = item.publication
        if (p.brandId !== input.brandId || p.sourceWeeklyRunId !== input.sourceRunId || p.channel !== item.schedule.channel) {
          throw new Error("Publication input lineage mismatch")
        }
        decodeSocialPublicationBundle(p.schema, p.version, p.bundle)
        const factIssue = publicationFactualBlocker(p.bundle, publicKnowledge, new Date().toISOString())
        if (factIssue) throw new Error(factIssue)
        if ('postRevision' in p.bundle) {
          const revisionId=p.bundle.postRevision.id
          await client.query('SELECT id FROM post_revisions WHERE id=$1 FOR UPDATE',[revisionId])
          const revision=await readPostRevision(client,input.ownerId,revisionId)
          if(!revision||revision.brandId!==input.brandId||revision.runId!==input.sourceRunId||revision.postKey!==p.postKey||revision.channel!==p.channel||revision.baseApprovalId!==currentApproval.approval_evidence.id)throw Error('Revision approval changed')
          assertApprovedRevision(revision)
          const latest=(await client.query<{id:string}>("SELECT id FROM post_revisions WHERE run_id=$1 AND post_key=$2 AND channel=$3 AND status='approved' ORDER BY approved_at DESC,created_at DESC,id DESC LIMIT 1",[input.sourceRunId,p.postKey,p.channel])).rows[0]
          if(latest?.id!==revisionId||reviewDigest(materializePostRevision(revision))!==reviewDigest(p))throw Error('Approved revision or immutable input changed')
        } else {
          const newer=await client.query("SELECT 1 FROM post_revisions WHERE run_id=$1 AND post_key=$2 AND channel=$3 AND status='approved' LIMIT 1",[input.sourceRunId,p.postKey,p.channel])
          if(newer.rowCount)throw Error('ამ არხს ახალი დამტკიცებული ტექსტი აქვს. განრიგში მიმდინარე ვერსია აირჩიეთ.')
        const current = approved.rows[0]!
        const currentPost = current.payload.outline?.posts[Number(p.postKey.slice(1)) - 1]
        const currentCopy = current.payload.copies[p.postKey]
        if (!currentPost || !currentCopy || !current.payload.reviewEvidence || p.bundle.weeklyReview.runVersion !== current.version
          || p.bundle.approval.actorId !== input.approvalActorId || p.bundle.approval.approvedAt !== current.approved_at.toISOString()
          || reviewDigest(p.bundle.weeklyReview) !== reviewDigest(current.payload.reviewEvidence)
          || p.bundle.weeklyReview.postDigests[p.postKey] !== reviewedPostDigest(currentPost, currentCopy)
          || reviewDigest(p.bundle.approval.binding) !== reviewDigest(current.approval_evidence)
          || p.bundle.approval.binding.batchDigest !== weeklyBatchDigest(current.payload)) throw Error("Approved review or copy changed")
        }
        const account = await client.query(`SELECT a.id FROM social_publishing_accounts a JOIN social_provider_account_bindings b
          ON b.publishing_account_id=a.id AND b.channel=a.channel AND b.binding_status='active'
          JOIN social_provider_profiles profile ON profile.brand_id=b.brand_id AND profile.provider=b.provider AND profile.provider_profile_ref=b.provider_profile_ref
          WHERE a.id=$1 AND a.brand_id=$2 AND a.channel=$3 AND b.connection_status='connected' AND b.can_publish=true AND profile.status='active'`,
        [item.publishingAccountId, input.brandId, p.channel])
        if (!account.rowCount) throw new Error("Publishing account is not connected or cannot publish")
        const policy = await client.query<{ active: boolean }>("SELECT active FROM brand_channel_operating_policies WHERE brand_id=$1 AND channel=$2", [input.brandId, p.channel])
        if (policy.rows[0]?.active === false) throw new Error("Channel is inactive for future operation")
        await client.query(`INSERT INTO social_publication_inputs(id,brand_id,source_weekly_run_id,post_key,channel,content_id,
          content_brief_id,content_execution_spec_id,draft_id,draft_version,bundle_schema,bundle_version,bundle)
          VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13::jsonb)
          ON CONFLICT(id) DO UPDATE SET id=social_publication_inputs.id
          RETURNING id`, [p.id, p.brandId, p.sourceWeeklyRunId, p.postKey, p.channel, p.contentId, p.contentBriefId,
          p.contentExecutionSpecId, p.draftId, p.draftVersion, p.schema, p.version, JSON.stringify(p.bundle)])
        const canonical = await client.query(`SELECT id FROM social_publication_inputs
          WHERE id=$1 AND superseded_by_input_id IS NULL AND bundle_schema=$2 AND bundle_version=$3 AND bundle=$4::jsonb AND brand_id=$5 AND source_weekly_run_id=$6
            AND post_key=$7 AND channel=$8 AND draft_id=$9 AND draft_version=$10`,
        [p.id, p.schema, p.version, JSON.stringify(p.bundle), p.brandId, p.sourceWeeklyRunId, p.postKey, p.channel, p.draftId, p.draftVersion])
        if (!canonical.rowCount) throw new Error("Publication input is immutable")
        for (const old of replacements.get(p.id) ?? []) {
          if (old.superseded_by_input_id) continue
          const oldSchedules = await client.query<ScheduleRow>("SELECT * FROM social_content_schedules WHERE publication_input_id=$1 FOR UPDATE", [old.id])
          const oldEvents = await eventsFor(client, oldSchedules.rows.map(row => row.id))
          const changedAt = new Date().toISOString() as IsoDateTime
          for (const row of oldSchedules.rows) {
            const schedule = scheduleFrom(row), currentState = lifecycle(schedule, oldEvents.get(row.id) ?? [])
            if (currentState.status === "cancelled") continue
            const event = cancelSocialContentSchedule({ id: stable("supersession-event", [row.id, p.id]) as never, schedule, currentState,
              changedBy: input.actorId as never, changedAt, reason: "Replaced by approved publication input " + p.id }).event
            await client.query(`INSERT INTO social_content_schedule_events(id,schedule_id,revision,event_type,actor_user_id,occurred_at,reason)
              VALUES($1,$2,$3,'cancelled',$4,$5,$6)`, [event.id, row.id, event.revision, input.actorId, changedAt, event.reason])
          }
          await client.query("UPDATE social_publication_inputs SET superseded_by_input_id=$2,superseded_at=$3 WHERE id=$1", [old.id, p.id, changedAt])
        }
        replacements.delete(p.id)
        const required = p.bundle.draft.format === "staticPost" && p.bundle.contentExecutionSpec.visualDependency === "none" ? 0
          : p.bundle.draft.format === "carousel" || p.bundle.draft.format === "story" ? p.bundle.draft.frames.length : 1
        const assets = await client.query<{ id: string; slot: number }>(`SELECT id::text,slot FROM weekly_post_assets
          WHERE run_id=$1 AND post_key=$2 ORDER BY slot`, [input.sourceRunId, p.postKey])
        if (assets.rowCount !== required || assets.rows.some((row, ordinal) => row.slot !== ordinal)) throw new Error("mediaManifestIncomplete")
        for (const [ordinal, asset] of assets.rows.entries()) await client.query(`INSERT INTO social_publication_input_assets
          (publication_input_id,ordinal,weekly_post_asset_id,media_type) VALUES($1,$2,$3,'image/webp') ON CONFLICT DO NOTHING`, [p.id, ordinal, asset.id])
        const s = item.schedule
        if (item.timeContext && resolveScheduleTime(item.timeContext) !== s.publishAt) throw Error("არჩეული სარტყელი და გამოქვეყნების დრო ერთმანეთს არ ემთხვევა.")
        const inserted = await client.query<ScheduleRow>(`INSERT INTO social_content_schedules(id,brand_id,publication_input_id,publishing_account_id,
          content_id,draft_id,draft_version,content_execution_spec_id,channel,"authorization",publish_at,scheduled_at,time_context)
          VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11,$12,$13::jsonb)
          ON CONFLICT(publication_input_id,publishing_account_id) DO NOTHING RETURNING *`, [s.id, input.brandId, p.id, item.publishingAccountId,
          s.contentId, s.draftId, s.draftVersion, s.contentExecutionSpecId, s.channel, JSON.stringify(s.authorization), s.publishAt, s.scheduledAt, item.timeContext ? JSON.stringify(item.timeContext) : null])
        let row = inserted.rows[0]
        if (!row) {
          row = (await client.query<ScheduleRow>("SELECT * FROM social_content_schedules WHERE publication_input_id=$1 AND publishing_account_id=$2", [p.id, item.publishingAccountId])).rows[0]!
          if (row.id !== s.id || row.publish_at.toISOString() !== s.publishAt || reviewDigest(row.time_context ?? null) !== reviewDigest(item.timeContext ?? null)) throw new ScheduleConflict("ამ პოსტის განრიგი უკვე არსებობს სხვა დროით. განაახლეთ გვერდი და გამოიყენეთ დროის შეცვლა.")
        }
        const schedule = scheduleFrom(row)
        const currentState = lifecycle(schedule, (await eventsFor(client, [row.id])).get(row.id) ?? [])
        if (currentState.status === "cancelled" || currentState.revision > 0) throw new ScheduleConflict("შენახული განრიგი უკვე შეიცვალა ან გაუქმდა. განაახლეთ გვერდი.")
        saved.push({ publicationInputId: p.id, supersededByInputId: null, approvalId: p.bundle.approval.binding.id, schedule, postKey: p.postKey, publishingAccountId: row.publishing_account_id, brandId: row.brand_id, timeContext: row.time_context ?? null,
          lifecycle: currentState })
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

      const rows = await client.query<ScheduleRow>(`SELECT s.*,i.post_key,i.superseded_by_input_id,i.bundle#>>'{approval,binding,id}' AS approval_id,
        coalesce(a.attempt_count,0)::int AS attempt_count,r.status AS last_status,c.status AS reconciliation_status,
        EXISTS(SELECT 1 FROM social_publish_attempts proof LEFT JOIN social_publish_results proof_result ON proof_result.attempt_id=proof.id
          LEFT JOIN social_publish_reconciliations proof_check ON proof_check.attempt_id=proof.id AND proof_check.status='publicationFound'
          WHERE proof.schedule_id=s.id AND (proof_result.status='published' OR proof_check.id IS NOT NULL)) AS publication_confirmed
        FROM social_content_schedules s JOIN social_publication_inputs i ON i.id=s.publication_input_id
        LEFT JOIN LATERAL (SELECT id,count(*) OVER () AS attempt_count FROM social_publish_attempts WHERE schedule_id=s.id ORDER BY attempt_number DESC LIMIT 1) a ON true
        LEFT JOIN social_publish_results r ON r.attempt_id=a.id
        LEFT JOIN LATERAL (SELECT status FROM social_publish_reconciliations WHERE attempt_id=a.id
          AND status IN ('publicationFound','confirmedAbsent','publicationFailed') ORDER BY checked_at DESC,id DESC LIMIT 1) c ON true
        WHERE s.brand_id=$1 AND ($2::uuid IS NULL OR i.source_weekly_run_id=$2::uuid) ORDER BY s.publish_at,s.id`, [scope.brandId, scope.sourceRunId ?? null])
      const events = await eventsFor(client, rows.rows.map((row) => row.id))
      await client.query("COMMIT")
      return rows.rows.map((row) => { const schedule = scheduleFrom(row); return { publicationInputId: row.publication_input_id, supersededByInputId: row.superseded_by_input_id ?? null, approvalId: row.approval_id ?? null, schedule, postKey: row.post_key!, publishingAccountId: row.publishing_account_id,
        brandId: row.brand_id, lifecycle: lifecycle(schedule, events.get(row.id) ?? []),
        timeContext: [...(events.get(row.id) ?? [])].reverse().find(e => e.event_type === "rescheduled")?.time_context ??
          ((events.get(row.id) ?? []).some(e => e.event_type === "rescheduled") ? null : row.time_context ?? null),
        delivery: { attemptCount: row.attempt_count ?? 0, state: !row.attempt_count ? "notStarted" as const
          : row.publication_confirmed || row.last_status === "published" || row.reconciliation_status === "publicationFound" ? "published" as const
          : row.reconciliation_status === "confirmedAbsent" || row.reconciliation_status === "publicationFailed" || row.last_status === "retryableFailure" || row.last_status === "permanentFailure" ? "failed" as const
          : row.last_status === "unknownOutcome" ? "unknown" as const : "inProgress" as const } } })
    } catch (error) { await client.query("ROLLBACK"); throw error } finally { client.release() }
  }

  async appendScheduleEvent(scope: { ownerId: string; brandId: string }, event: SocialContentScheduleEvent) {
    if (event.changedBy !== scope.ownerId) throw Error("განრიგზე წვდომა არ გაქვთ.")
    await this.mutateSchedule({ ...scope, scheduleId: event.scheduleId, operationId: event.id, expectedRevision: event.revision - 1,
      now: event.createdAt, ...(event.type === "rescheduled" ? { action: "reschedule" as const, publishAt: event.publishAt }
        : { action: "cancel" as const, ...(event.reason ? { reason: event.reason } : {}) }) }, event)
  }

  async changeSchedule(input: ScheduleChange) { await this.mutateSchedule(input) }

  private async mutateSchedule(input: ScheduleChange, suppliedEvent?: SocialContentScheduleEvent) {
    if (!Number.isSafeInteger(input.expectedRevision) || input.expectedRevision < 0 || !input.operationId || input.operationId.length > 160)
      throw Error("განრიგის ცვლილების მოთხოვნა არასწორია.")
    const client = await this.pool.connect()
    try {
      await client.query("BEGIN")
      // Same order as claimAttempt: a selected queue item cannot race a cancellation or reschedule.
      await lockPublicKnowledge(client, input.brandId)
      await assertBrand(client, input.ownerId, input.brandId)
      const row = (await client.query<ScheduleRow>(`SELECT s.*,i.superseded_by_input_id FROM social_content_schedules s
        JOIN social_publication_inputs i ON i.id=s.publication_input_id WHERE s.id=$1 AND s.brand_id=$2 FOR UPDATE OF s`,
      [input.scheduleId, input.brandId])).rows[0]
      if (!row) throw Error("განრიგი ვერ მოიძებნა ან მასზე წვდომა არ გაქვთ.")
      const schedule = scheduleFrom(row), rows = (await eventsFor(client, [row.id])).get(row.id) ?? []
      const duplicate = (await client.query<EventRow>("SELECT * FROM social_content_schedule_events WHERE id=$1", [input.operationId])).rows[0]
      if (duplicate) {
        const same = duplicate.schedule_id === row.id && duplicate.actor_user_id === input.ownerId
          && duplicate.revision === input.expectedRevision + 1 && duplicate.event_type === (input.action === "cancel" ? "cancelled" : "rescheduled")
          && (input.action === "cancel" ? (duplicate.reason ?? "") === (input.reason?.trim() ?? "")
            : duplicate.publish_at!.toISOString() === input.publishAt && reviewDigest(duplicate.time_context ?? null) === reviewDigest(input.timeContext ?? null))
        if (!same) throw new ScheduleConflict("ეს მოთხოვნა უკვე გამოიყენეს სხვა ცვლილებისთვის. განაახლეთ გვერდი.")
        if (suppliedEvent) {
          const prior = lifecycle(schedule, rows.filter(e => e.revision < duplicate.revision))
          const base = { id: duplicate.id as SocialContentScheduleEvent["id"], schedule, currentState: prior,
            changedBy: duplicate.actor_user_id as SocialContentScheduleEvent["changedBy"], changedAt: duplicate.occurred_at.toISOString() as IsoDateTime }
          const canonical = duplicate.event_type === "cancelled" ? cancelSocialContentSchedule({ ...base, ...(duplicate.reason ? { reason: duplicate.reason } : {}) }).event
            : rescheduleSocialContent({ ...base, publishAt: duplicate.publish_at!.toISOString() as IsoDateTime }).event
          if (reviewDigest(suppliedEvent) !== reviewDigest(canonical)) throw new ScheduleConflict("განმეორებითი ცვლილება შენახულ ჩანაწერს არ ემთხვევა.")
        }
        await client.query("COMMIT"); return
      }
      const state = lifecycle(schedule, rows)
      if (state.revision !== input.expectedRevision || state.status !== "scheduled" || row.superseded_by_input_id)
        throw new ScheduleConflict("განრიგი სხვა ჩანართში შეიცვალა ან გაუქმდა. განაახლეთ გვერდი.")
      if ((await client.query("SELECT 1 FROM social_publish_attempts WHERE schedule_id=$1 LIMIT 1", [row.id])).rowCount)
        throw new ScheduleConflict("გაგზავნის მცდელობა უკვე დაწყებულია. დროის შეცვლა ან გაუქმება ვეღარ შეაჩერებს მას; გადაამოწმეთ გამოქვეყნების სტატუსი.")
      if (input.action === "reschedule" && input.timeContext && resolveScheduleTime(input.timeContext) !== input.publishAt)
        throw Error("არჩეული სარტყელი და გამოქვეყნების დრო ერთმანეთს არ ემთხვევა.")
      const base = { id: input.operationId as SocialContentScheduleEvent["id"], schedule, currentState: state,
        changedBy: input.ownerId as SocialContentScheduleEvent["changedBy"], changedAt: input.now as IsoDateTime }
      const event = input.action === "cancel" ? cancelSocialContentSchedule({ ...base, ...(input.reason ? { reason: input.reason } : {}) }).event
        : rescheduleSocialContent({ ...base, publishAt: input.publishAt as IsoDateTime }).event
      if (suppliedEvent && reviewDigest(suppliedEvent) !== reviewDigest(event)) throw new ScheduleConflict("განრიგის ცვლილება მიმდინარე ვერსიას არ ემთხვევა.")
      await client.query(`INSERT INTO social_content_schedule_events(id,schedule_id,revision,event_type,publish_at,actor_user_id,occurred_at,reason,time_context)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb)`, [event.id, row.id, event.revision, event.type,
        event.type === "rescheduled" ? event.publishAt : null, input.ownerId, event.createdAt,
        event.type === "cancelled" ? event.reason ?? null : null, input.action === "reschedule" && input.timeContext ? JSON.stringify(input.timeContext) : null])
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
      LEFT JOIN brand_channel_operating_policies policy ON policy.brand_id=s.brand_id AND policy.channel=s.channel
      WHERE i.superseded_by_input_id IS NULL AND NOT EXISTS(SELECT 1 FROM social_publication_fact_holds h WHERE h.publication_input_id=i.id)
        AND coalesce(e.event_type,'rescheduled')<>'cancelled' AND coalesce(e.publish_at,s.publish_at)<=$1::timestamptz
        AND b.connection_status='connected' AND b.can_publish=true AND p.status='active' AND coalesce(policy.active,true)=true
        AND (l.attempt_number IS NULL OR (t.status='retryableFailure' AND l.attempt_number<$2 AND (t.retry_after IS NULL OR t.retry_after<=$1::timestamptz))
          OR (t.status='unknownOutcome' AND l.attempt_number<$2 AND (c.status='confirmedAbsent' OR (c.status='publicationFailed' AND c.failure_type='retryable'))))
      ORDER BY coalesce(e.publish_at,s.publish_at),s.id LIMIT $3`, [now, maxAttempts, limit])
    const knowledgeByBrand = new Map<string, Awaited<ReturnType<typeof readPublicKnowledge>>>()
    const due: DueSocialPublication[] = []
    for (const row of rows.rows) {
      let bundle: DueSocialPublication["bundle"]
      let reason: string | null = null
      try {
        bundle = decodeSocialPublicationBundle(row.bundle_schema, row.bundle_version, row.bundle)
        let current = knowledgeByBrand.get(row.brand_id)
        if (!current) { current = await readPublicKnowledge(this.pool, row.brand_id, now); knowledgeByBrand.set(row.brand_id, current) }
        reason = publicationFactualBlocker(bundle, current, now)
      } catch { reason = "პოსტის შენახული ფაქტობრივი საფუძველი ვერ გადამოწმდა." }
      if (reason) {
        await this.pool.query("INSERT INTO social_publication_fact_holds(publication_input_id,reason,checked_at) VALUES($1,$2,$3::timestamptz) ON CONFLICT(publication_input_id) DO UPDATE SET reason=excluded.reason,checked_at=excluded.checked_at", [row.publication_input_id, reason, now])
        continue
      }

      const schedule = scheduleFrom(row)
      const revision = Number(row.revision)
      const publishAt = (row.event_publish_at ?? row.publish_at).toISOString() as IsoDateTime
      const state = { scheduleId: schedule.id, contentId: schedule.contentId, draftId: schedule.draftId, draftVersion: schedule.draftVersion,
        revision, status: "scheduled" as const, publishAt }
      const attemptNumber = (row.last_attempt ?? 0) + 1
      due.push({ publicationInputId: row.publication_input_id, supersededByInputId: null, approvalId: "weeklyReview" in bundle! && "binding" in bundle!.approval ? bundle!.approval.binding.id : null, schedule, postKey: row.post_key!, publishingAccountId: row.publishing_account_id, brandId: row.brand_id, lifecycle: state,
        bundle: bundle!, provider: row.provider,
        publishingAccount: { id: row.publishing_account_id, channel: row.channel, providerAccountRef: row.provider_account_ref, connected: true } as SocialPublishingAccount,
        attemptNumber, attemptId: stable("attempt", [row.id, attemptNumber]) as SocialContentPublishAttemptId,
        resultId: stable("result", [row.id, attemptNumber]) as SocialContentPublishResultId })
    }
    return due
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
