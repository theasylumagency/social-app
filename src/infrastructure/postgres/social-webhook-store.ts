import { randomUUID } from "node:crypto"
import type { Pool } from "pg"
import type { ClaimedProviderWebhookEvent, ProviderWebhookEvent, ProviderWebhookStore } from "../../application/publishing/webhook-store"

export class PostgresSocialWebhookStore implements ProviderWebhookStore {
  constructor(private readonly pool: Pool) {}

  async receive(event: ProviderWebhookEvent) {
    const inserted = await this.pool.query(`INSERT INTO social_provider_webhook_events(provider,event_id,event_type,payload_hash,payload)
      VALUES($1,$2,$3,$4,$5::jsonb) ON CONFLICT(provider,event_id) DO NOTHING RETURNING event_id`,
    [event.provider, event.eventId, event.eventType, event.payloadHash, JSON.stringify(event.payload)])
    if (inserted.rowCount) return "received" as const
    const old = (await this.pool.query<{ event_type: string; payload_hash: string }>(`SELECT event_type,payload_hash
      FROM social_provider_webhook_events WHERE provider=$1 AND event_id=$2`, [event.provider, event.eventId])).rows[0]
    if (!old || old.event_type !== event.eventType || old.payload_hash !== event.payloadHash) throw new Error("Webhook event identity conflict")
    return "duplicate" as const
  }

  async claim(now: Date, leaseMs: number) {
    if (!Number.isSafeInteger(leaseMs) || leaseMs < 1 || leaseMs > 3_600_000) throw new Error("Invalid webhook lease")
    const leaseToken = randomUUID()
    const leaseUntil = new Date(now.getTime() + leaseMs)
    const row = (await this.pool.query(`WITH candidate AS (
        SELECT provider,event_id FROM social_provider_webhook_events
        WHERE (status='pending' AND next_attempt_at <= $1) OR (status='processing' AND lease_until <= $1)
        ORDER BY received_at,provider,event_id FOR UPDATE SKIP LOCKED LIMIT 1)
      UPDATE social_provider_webhook_events e SET status='processing',processing_attempts=processing_attempts+1,
        lease_token=$2,lease_until=$3,last_error_code=NULL FROM candidate c
      WHERE e.provider=c.provider AND e.event_id=c.event_id
      RETURNING e.provider,e.event_id AS "eventId",e.event_type AS "eventType",e.payload_hash AS "payloadHash",e.payload,
        e.lease_token::text AS "leaseToken",e.processing_attempts AS "processingAttempts"`, [now, leaseToken, leaseUntil])).rows[0]
    return row as ClaimedProviderWebhookEvent | undefined ?? null
  }

  async complete(event: ClaimedProviderWebhookEvent, status: "processed" | "ignored") {
    const result = await this.pool.query(`UPDATE social_provider_webhook_events SET status=$4,lease_token=NULL,lease_until=NULL,
      processed_at=now(),last_error_code=NULL WHERE provider=$1 AND event_id=$2 AND lease_token=$3`,
    [event.provider, event.eventId, event.leaseToken, status])
    if (!result.rowCount) throw new Error("Webhook lease lost")
  }

  async retry(event: ClaimedProviderWebhookEvent, nextAttemptAt: Date, errorCode: string, maxAttempts: number) {
    if (!Number.isSafeInteger(maxAttempts) || maxAttempts < 1 || !errorCode.trim()) throw new Error("Invalid webhook retry")
    const terminal = event.processingAttempts >= maxAttempts
    const result = await this.pool.query(`UPDATE social_provider_webhook_events SET status=$4,lease_token=NULL,lease_until=NULL,
      next_attempt_at=$5,last_error_code=$6,processed_at=CASE WHEN $4='failed' THEN now() ELSE NULL END
      WHERE provider=$1 AND event_id=$2 AND lease_token=$3`, [event.provider, event.eventId, event.leaseToken,
      terminal ? "failed" : "pending", nextAttemptAt, errorCode.trim()])
    if (!result.rowCount) throw new Error("Webhook lease lost")
  }
}
