import { createHash, randomUUID } from "node:crypto"
import type { Pool } from "pg"
import type { SocialContentPublishAttempt, SocialContentPublishResult } from "../../blueprints/social"
import type { SocialContentPublishAttemptClaim, SocialContentPublishResultRecord, SocialContentPublishStore } from "../../application/publishing/publish-store"
import type { ProviderDeliveryRequest, ProviderDeliveryStore, ProviderMediaUpload, ProviderRequestState, ProviderResponseRecord } from "../../application/publishing/delivery-store"

type AttemptRow = { id: string; idempotency_key: string; attempt_number: number; content_id: string; draft_id: string; draft_version: number; schedule_id: string; schedule_revision: number; publishing_account_id: string; channel: "facebook" | "instagram"; publish_at: Date; attempted_at: Date }
type ResultRow = { id: string; attempt_id: string; recorded_at: Date; status: SocialContentPublishResult["status"]; provider_publication_ref: string | null; published_at: Date | null; error_code: string | null; message: string | null; retry_after: Date | null }
const attemptFrom = (r: AttemptRow): SocialContentPublishAttempt => ({ id: r.id, idempotencyKey: r.idempotency_key, attemptNumber: r.attempt_number,
  contentId: r.content_id, draftId: r.draft_id, draftVersion: r.draft_version, scheduleId: r.schedule_id, scheduleRevision: r.schedule_revision,
  publishingAccountId: r.publishing_account_id, channel: r.channel, publishAt: r.publish_at.toISOString(), attemptedAt: r.attempted_at.toISOString() }) as SocialContentPublishAttempt
function resultFrom(r: ResultRow, attempt: SocialContentPublishAttempt): SocialContentPublishResult {
  const base = { id: r.id, attemptId: r.attempt_id, idempotencyKey: attempt.idempotencyKey, contentId: attempt.contentId, draftId: attempt.draftId,
    draftVersion: attempt.draftVersion, scheduleId: attempt.scheduleId, scheduleRevision: attempt.scheduleRevision,
    publishingAccountId: attempt.publishingAccountId, channel: attempt.channel, recordedAt: r.recorded_at.toISOString() }
  if (r.status === "published") return { ...base, status: "published", providerPublicationRef: r.provider_publication_ref!, publishedAt: r.published_at!.toISOString() } as SocialContentPublishResult
  return { ...base, status: r.status, errorCode: r.error_code!, ...(r.message ? { message: r.message } : {}),
    ...(r.status === "retryableFailure" && r.retry_after ? { retryAfter: r.retry_after.toISOString() } : {}) } as SocialContentPublishResult
}
const fingerprint = (a: SocialContentPublishAttempt) => createHash("sha256").update(JSON.stringify({ idempotencyKey: a.idempotencyKey,
  attemptNumber: a.attemptNumber, contentId: a.contentId, draftId: a.draftId, draftVersion: a.draftVersion, scheduleId: a.scheduleId,
  scheduleRevision: a.scheduleRevision, publishingAccountId: a.publishingAccountId, channel: a.channel, publishAt: a.publishAt })).digest("hex")

export class PostgresSocialPublishStore implements SocialContentPublishStore, ProviderDeliveryStore {
  constructor(private readonly pool: Pool) {}

  async claimAttempt(attempt: SocialContentPublishAttempt): Promise<SocialContentPublishAttemptClaim> {
    const client = await this.pool.connect()
    try {
      await client.query("BEGIN")
      const located = await client.query<{ brand_id: string }>("SELECT brand_id FROM social_publishing_accounts WHERE id=$1 AND channel=$2", [attempt.publishingAccountId, attempt.channel])
      const brandId = located.rows[0]?.brand_id
      if (!brandId) throw new Error("Publishing account not found")
      await client.query("SELECT id FROM brands WHERE id=$1 FOR UPDATE", [brandId])
      const binding = await client.query<{ id: string; provider: string }>(`SELECT b.id,b.provider FROM social_provider_account_bindings b
        JOIN social_provider_profiles p ON p.brand_id=b.brand_id AND p.provider=b.provider AND p.provider_profile_ref=b.provider_profile_ref
        WHERE b.publishing_account_id=$1 AND b.brand_id=$2 AND b.channel=$3 AND b.binding_status='active'
          AND b.connection_status='connected' AND b.can_publish=true AND p.status='active' FOR UPDATE OF b`, [attempt.publishingAccountId, brandId, attempt.channel])
      if (!binding.rows[0]) throw new Error("Publishing account has no active capable provider binding")
      const inserted = await client.query(`INSERT INTO social_publish_attempts(id,idempotency_key,attempt_number,content_id,draft_id,draft_version,
        schedule_id,schedule_revision,publishing_account_id,channel,publish_at,attempted_at)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) ON CONFLICT(idempotency_key,attempt_number) DO NOTHING RETURNING id`,
      [attempt.id, attempt.idempotencyKey, attempt.attemptNumber, attempt.contentId, attempt.draftId, attempt.draftVersion, attempt.scheduleId,
        attempt.scheduleRevision, attempt.publishingAccountId, attempt.channel, attempt.publishAt, attempt.attemptedAt])
      if (inserted.rowCount) {
        await client.query(`INSERT INTO social_provider_publish_requests(attempt_id,provider_binding_id,provider,request_id,request_fingerprint)
          VALUES($1,$2,$3,$4,$5)`, [attempt.id, binding.rows[0].id, binding.rows[0].provider, randomUUID(), fingerprint(attempt)])
        await client.query("COMMIT")
        return { status: "acquired" }
      }
      const storedRow = (await client.query<AttemptRow>("SELECT * FROM social_publish_attempts WHERE idempotency_key=$1 AND attempt_number=$2", [attempt.idempotencyKey, attempt.attemptNumber])).rows[0]!
      const stored = attemptFrom(storedRow)
      const resultRow = (await client.query<ResultRow>("SELECT * FROM social_publish_results WHERE attempt_id=$1", [stored.id])).rows[0]
      await client.query("COMMIT")
      return { status: "alreadyRecorded", attempt: stored, result: resultRow ? resultFrom(resultRow, stored) : null }
    } catch (error) { await client.query("ROLLBACK"); throw error } finally { client.release() }
  }

  async recordResult(result: SocialContentPublishResult): Promise<SocialContentPublishResultRecord> {
    const inserted = await this.pool.query(`INSERT INTO social_publish_results(id,attempt_id,recorded_at,status,provider_publication_ref,published_at,error_code,message,retry_after)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT(attempt_id) DO NOTHING RETURNING id`, [result.id, result.attemptId, result.recordedAt,
      result.status, result.status === "published" ? result.providerPublicationRef : null, result.status === "published" ? result.publishedAt : null,
      result.status === "published" ? null : result.errorCode, result.status === "published" ? null : result.message ?? null,
      result.status === "retryableFailure" ? result.retryAfter ?? null : null])
    if (inserted.rowCount) return { status: "recorded" }
    const attemptRow = (await this.pool.query<AttemptRow>("SELECT * FROM social_publish_attempts WHERE id=$1", [result.attemptId])).rows[0]
    const row = (await this.pool.query<ResultRow>("SELECT * FROM social_publish_results WHERE attempt_id=$1", [result.attemptId])).rows[0]
    if (!attemptRow || !row) throw new Error("Canonical publish result not found")
    return { status: "alreadyRecorded", result: resultFrom(row, attemptFrom(attemptRow)) }
  }

  async loadRequest(attemptId: SocialContentPublishAttempt["id"]): Promise<ProviderDeliveryRequest | null> {
    const r = await this.pool.query(`SELECT j.attempt_id AS "attemptId",j.provider_binding_id AS "providerBindingId",j.provider,
      j.request_id::text AS "requestId",j.request_fingerprint AS "requestFingerprint",j.state,
      j.dispatch_started_at AS "dispatchStartedAt",j.provider_publication_ref AS "providerPublicationRef",
      j.duplicate_publication_ref AS "duplicatePublicationRef",b.provider_profile_ref AS "providerProfileRef",
      b.provider_account_ref AS "providerAccountRef",b.publishing_account_id AS "publishingAccountId",b.channel,
      b.binding_status AS "bindingStatus",b.connection_status AS "connectionStatus",b.can_publish AS "canPublish",p.status AS "profileStatus"
      FROM social_provider_publish_requests j JOIN social_provider_account_bindings b ON b.id=j.provider_binding_id
      JOIN social_provider_profiles p ON p.brand_id=b.brand_id AND p.provider=b.provider AND p.provider_profile_ref=b.provider_profile_ref
      WHERE j.attempt_id=$1`, [attemptId])
    const row = r.rows[0]
    return row ? { ...row, dispatchStartedAt: row.dispatchStartedAt?.toISOString() ?? null } as ProviderDeliveryRequest : null
  }

  async transition(attemptId: string, expected: readonly ProviderRequestState[], next: ProviderRequestState, response: ProviderResponseRecord = { httpStatus: null }) {
    const r = await this.pool.query(`UPDATE social_provider_publish_requests SET state=$3,
      dispatch_started_at=CASE WHEN $3='dispatchStarted' THEN coalesce(dispatch_started_at,now()) ELSE dispatch_started_at END,
      response_received_at=CASE WHEN $3='responseReceived' THEN coalesce(response_received_at,now()) ELSE response_received_at END,
      http_status=coalesce($4,http_status),provider_publication_ref=coalesce($5,provider_publication_ref),
      duplicate_publication_ref=coalesce($6,duplicate_publication_ref),last_error_code=coalesce($7,last_error_code),updated_at=now()
      WHERE attempt_id=$1 AND (state=ANY($2::text[]) OR state=$3) RETURNING attempt_id`, [attemptId, [...expected], next, response.httpStatus,
      response.providerPublicationRef ?? null, response.duplicatePublicationRef ?? null, response.errorCode ?? null])
    if (!r.rowCount) throw new Error("Provider request state transition rejected")
    const loaded = await this.loadRequest(attemptId as SocialContentPublishAttempt["id"])
    if (!loaded) throw new Error("Provider request journal missing")
    return loaded
  }

  async recordMedia(upload: ProviderMediaUpload) {
    const r = await this.pool.query(`INSERT INTO social_provider_media_uploads(attempt_id,ordinal,source_asset_id,media_type,content_sha256,provider_public_url,expires_at)
      VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(attempt_id,ordinal) DO NOTHING RETURNING ordinal`, [upload.attemptId, upload.ordinal,
      upload.sourceAssetId, upload.mediaType, upload.contentSha256, upload.providerPublicUrl, upload.expiresAt])
    if (!r.rowCount) {
      const old = (await this.pool.query("SELECT * FROM social_provider_media_uploads WHERE attempt_id=$1 AND ordinal=$2", [upload.attemptId, upload.ordinal])).rows[0]
      if (!old || old.source_asset_id !== upload.sourceAssetId || old.content_sha256 !== upload.contentSha256 || old.provider_public_url !== upload.providerPublicUrl) {
        throw new Error("Provider media journal conflict")
      }
    }
  }
  async listMedia(attemptId: string): Promise<readonly ProviderMediaUpload[]> {
    const r = await this.pool.query(`SELECT attempt_id AS "attemptId",ordinal,source_asset_id AS "sourceAssetId",media_type AS "mediaType",
      content_sha256 AS "contentSha256",provider_public_url AS "providerPublicUrl",expires_at AS "expiresAt"
      FROM social_provider_media_uploads WHERE attempt_id=$1 ORDER BY ordinal`, [attemptId])
    return r.rows.map((row) => ({ ...row, expiresAt: row.expiresAt.toISOString() }))
  }
}
