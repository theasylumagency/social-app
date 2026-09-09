import type { Pool } from "pg"
import type { SocialContentPublishAttempt, SocialContentPublishReconciliation, SocialContentPublishResult } from "../../blueprints/social"
import type { PublishReconciliationCorrelation, PublishReconciliationLookup, SocialPublishReconciliationStore } from "../../application/publishing/reconciliation-store"
import { PostgresSocialPublishStore } from "./social-publish-store"

type Row = {
  attempt_id: string; idempotency_key: string; attempt_number: number; content_id: string; draft_id: string; draft_version: number;
  schedule_id: string; schedule_revision: number; publishing_account_id: string; channel: "facebook" | "instagram";
  publish_at: Date; attempted_at: Date; result_id: string | null; recorded_at: Date | null; result_status: SocialContentPublishResult["status"] | null;
  provider_publication_ref: string | null; published_at: Date | null; error_code: string | null; message: string | null; retry_after: Date | null;
}

function hydrate(row: Row): { attempt: SocialContentPublishAttempt; result: SocialContentPublishResult | null } {
  const attempt = { id: row.attempt_id, idempotencyKey: row.idempotency_key, attemptNumber: row.attempt_number, contentId: row.content_id,
    draftId: row.draft_id, draftVersion: row.draft_version, scheduleId: row.schedule_id, scheduleRevision: row.schedule_revision,
    publishingAccountId: row.publishing_account_id, channel: row.channel, publishAt: row.publish_at.toISOString(),
    attemptedAt: row.attempted_at.toISOString() } as SocialContentPublishAttempt
  if (!row.result_id || !row.result_status || !row.recorded_at) return { attempt, result: null }
  const base = { id: row.result_id, attemptId: attempt.id, idempotencyKey: attempt.idempotencyKey, contentId: attempt.contentId,
    draftId: attempt.draftId, draftVersion: attempt.draftVersion, scheduleId: attempt.scheduleId, scheduleRevision: attempt.scheduleRevision,
    publishingAccountId: attempt.publishingAccountId, channel: attempt.channel, recordedAt: row.recorded_at.toISOString() }
  const result = row.result_status === "published"
    ? { ...base, status: "published", providerPublicationRef: row.provider_publication_ref!, publishedAt: row.published_at!.toISOString() }
    : { ...base, status: row.result_status, errorCode: row.error_code!, ...(row.message ? { message: row.message } : {}),
        ...(row.result_status === "retryableFailure" && row.retry_after ? { retryAfter: row.retry_after.toISOString() } : {}) }
  return { attempt, result: result as SocialContentPublishResult }
}

const fields = `a.id AS attempt_id,a.idempotency_key,a.attempt_number,a.content_id,a.draft_id,a.draft_version,a.schedule_id,
  a.schedule_revision,a.publishing_account_id,a.channel,a.publish_at,a.attempted_at,r.id AS result_id,r.recorded_at,
  r.status AS result_status,r.provider_publication_ref,r.published_at,r.error_code,r.message,r.retry_after`

export class PostgresSocialReconciliationStore implements SocialPublishReconciliationStore {
  private readonly delivery: PostgresSocialPublishStore
  constructor(private readonly pool: Pool) { this.delivery = new PostgresSocialPublishStore(pool) }

  private async correlationByAttempt(attemptId: string): Promise<PublishReconciliationCorrelation | null> {
    const row = (await this.pool.query<Row>(`SELECT ${fields} FROM social_publish_attempts a
      JOIN social_provider_publish_requests j ON j.attempt_id=a.id LEFT JOIN social_publish_results r ON r.attempt_id=a.id
      WHERE a.id=$1`, [attemptId])).rows[0]
    const request = row ? await this.delivery.loadRequest(row.attempt_id as SocialContentPublishAttempt["id"]) : null
    return row && request ? { ...hydrate(row), request } : null
  }

  async findCorrelation(lookup: PublishReconciliationLookup) {
    let attemptId: string | undefined
    if (lookup.providerPublicationRef) {
      attemptId = (await this.pool.query<{ attempt_id: string }>(`SELECT attempt_id FROM social_provider_publish_requests
        WHERE provider=$1 AND ($2=provider_publication_ref OR $2=duplicate_publication_ref) ORDER BY created_at DESC LIMIT 1`,
      [lookup.provider, lookup.providerPublicationRef])).rows[0]?.attempt_id
    }
    attemptId ??= lookup.attemptId
    if (attemptId) {
      const request = await this.delivery.loadRequest(attemptId as SocialContentPublishAttempt["id"])
      if (!request || request.provider !== lookup.provider) return null
    }
    return attemptId ? this.correlationByAttempt(attemptId) : null
  }

  async append(r: SocialContentPublishReconciliation) {
    const client = await this.pool.connect()
    try {
      await client.query("BEGIN")
      await client.query("SELECT id FROM social_publish_attempts WHERE id=$1 FOR UPDATE", [r.attemptId])
      if (r.status === "inconclusive") {
        const terminal = await client.query(`SELECT id FROM social_publish_reconciliations WHERE attempt_id=$1
          AND status IN ('publicationFound','confirmedAbsent','publicationFailed') LIMIT 1`, [r.attemptId])
        if (terminal.rowCount) { await client.query("COMMIT"); return "alreadyRecorded" as const }
      }
      const inserted = await client.query(`INSERT INTO social_publish_reconciliations(id,unknown_result_id,attempt_id,idempotency_key,
        content_id,draft_id,draft_version,schedule_id,schedule_revision,publishing_account_id,channel,status,provider_publication_ref,
        published_at,failure_type,reason_code,message,checked_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
        ON CONFLICT DO NOTHING RETURNING id`, [r.id, r.unknownResultId, r.attemptId, r.idempotencyKey, r.contentId, r.draftId,
        r.draftVersion, r.scheduleId, r.scheduleRevision, r.publishingAccountId, r.channel, r.status,
        r.status === "publicationFound" ? r.providerPublicationRef : null, r.status === "publicationFound" ? r.publishedAt : null,
        r.status === "publicationFailed" ? r.failureType : null,
        r.status === "publicationFailed" || r.status === "inconclusive" ? r.reasonCode : null,
        r.status === "publicationFailed" || r.status === "inconclusive" ? r.message ?? null : null, r.checkedAt])
      await client.query("COMMIT")
      return inserted.rowCount ? "recorded" as const : "alreadyRecorded" as const
    } catch (error) { await client.query("ROLLBACK"); throw error } finally { client.release() }
  }

  async findUnknown(provider: string, limit: number) {
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 500) throw new Error("Invalid reconciliation limit")
    const ids = (await this.pool.query<{ id: string }>(`SELECT a.id FROM social_publish_attempts a
      JOIN social_publish_results r ON r.attempt_id=a.id AND r.status='unknownOutcome'
      JOIN social_provider_publish_requests j ON j.attempt_id=a.id AND j.provider=$1
      WHERE NOT EXISTS (SELECT 1 FROM social_publish_reconciliations c WHERE c.attempt_id=a.id
        AND c.status IN ('publicationFound','confirmedAbsent','publicationFailed'))
      ORDER BY r.recorded_at,a.id LIMIT $2`, [provider, limit])).rows
    const candidates = await Promise.all(ids.map(({ id }) => this.correlationByAttempt(id)))
    return candidates.filter((value): value is PublishReconciliationCorrelation => value !== null)
  }

  async findOrphaned(cutoff: Date, limit: number) {
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 500) throw new Error("Invalid orphan recovery limit")
    const ids = (await this.pool.query<{ id: string }>(`SELECT a.id FROM social_publish_attempts a
      JOIN social_provider_publish_requests j ON j.attempt_id=a.id LEFT JOIN social_publish_results r ON r.attempt_id=a.id
      WHERE r.id IS NULL AND a.attempted_at <= $1 ORDER BY a.attempted_at,a.id LIMIT $2`, [cutoff, limit])).rows
    const candidates = await Promise.all(ids.map(({ id }) => this.correlationByAttempt(id)))
    return candidates.filter((value): value is PublishReconciliationCorrelation => value !== null)
  }
}
