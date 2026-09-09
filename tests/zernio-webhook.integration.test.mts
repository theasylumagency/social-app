import assert from "node:assert/strict"
import { createHmac } from "node:crypto"
import test from "node:test"
import { createIsoDateTime } from "../src/core/domain/primitives"
import { processNextProviderWebhook } from "../src/application/publishing/process-provider-webhooks"
import { PostgresSocialPublishStore } from "../src/infrastructure/postgres/social-publish-store"
import { PostgresSocialReconciliationStore } from "../src/infrastructure/postgres/social-reconciliation-store"
import { PostgresSocialWebhookStore } from "../src/infrastructure/postgres/social-webhook-store"
import { createZernioWebhookHttp, interpretZernioWebhook } from "../src/infrastructure/zernio/webhooks"
import { attempt, prepareSchedule, socialDeliveryFixture, unknownResult } from "./social-delivery-fixture"

const secret = "webhook-test-secret"
function signed(raw: string, eventId?: string, signature = createHmac("sha256", secret).update(raw).digest("hex")) {
  return new Request("https://app.unda.pro/api/webhooks/zernio", { method: "POST", body: raw,
    headers: { "content-type": "application/json", "x-zernio-signature": signature, ...(eventId ? { "x-zernio-event-id": eventId } : {}) } })
}
const payload = (id: string, event = "post.published") => ({ id, event, timestamp: "2026-09-09T12:00:30.000Z",
  post: { _id: "provider-post", publishedAt: "2026-09-09T12:00:30.000Z", metadata: { undaAttemptId: "webhook-attempt" },
    platforms: [{ platform: "facebook", accountId: { _id: "provider-account" }, status: event.includes("failed") ? "failed" : "published" }] } })

test("Zernio webhook receipt verifies the raw body and deduplicates durably", async (t) => {
  const { pool } = await socialDeliveryFixture(t)
  const store = new PostgresSocialWebhookStore(pool)
  const receive = createZernioWebhookHttp({ secret, store, maxBodyBytes: 10_000 })
  const raw = JSON.stringify(payload("event-1"))
  assert.equal((await receive(signed(raw, "event-1"))).status, 204)
  assert.equal((await receive(signed(raw, "event-1"))).status, 204)
  assert.equal((await pool.query("SELECT count(*)::int AS count FROM social_provider_webhook_events")).rows[0].count, 1)
  assert.equal((await receive(signed(raw, "other"))).status, 400)
  assert.equal((await receive(signed(raw, "event-1", "0".repeat(64)))).status, 400)
  assert.equal((await receive(signed(JSON.stringify({ ...payload("event-1"), timestamp: "2026-09-09T13:00:00Z" }), "event-1"))).status, 409)
  assert.equal((await receive(signed("x".repeat(10_001)))).status, 413)
})

test("async webhook processing tolerates result races and never regresses a terminal reconciliation", async (t) => {
  const { pool } = await socialDeliveryFixture(t)
  const publishes = new PostgresSocialPublishStore(pool)
  const reconciliations = new PostgresSocialReconciliationStore(pool)
  const inbox = new PostgresSocialWebhookStore(pool)
  const publication = attempt("webhook-attempt")
  await prepareSchedule(pool, publication)
  await publishes.claimAttempt(publication)
  await publishes.transition(publication.id, ["prepared"], "dispatchStarted")
  await publishes.transition(publication.id, ["dispatchStarted"], "responseReceived", { httpStatus: 201, providerPublicationRef: "provider-post" })
  const receive = createZernioWebhookHttp({ secret, store: inbox })
  const raw = JSON.stringify(payload("published-event"))
  assert.equal((await receive(signed(raw, "published-event"))).status, 204)
  let now = "2026-09-09T12:02:00.000Z"
  const process = () => processNextProviderWebhook({ inbox, reconciliations,
    interpret: (provider, body) => { assert.equal(provider, "zernio"); return interpretZernioWebhook(body) },
    now: () => createIsoDateTime(now), retryPolicy: { maxAttempts: 3 },
    handleAccount: async () => assert.fail("unexpected account event"), handleAnalytics: async () => assert.fail("unexpected analytics event") })
  assert.equal((await process()).status, "retryScheduled")
  await publishes.recordResult(unknownResult(publication))
  now = "2026-09-09T12:02:02.000Z"
  assert.equal((await process()).status, "processed")
  assert.equal((await pool.query("SELECT status FROM social_publish_reconciliations")).rows[0].status, "publicationFound")

  const older = JSON.stringify(payload("scheduled-event", "post.scheduled"))
  assert.equal((await receive(signed(older, "scheduled-event"))).status, 204)
  now = "2026-09-09T12:02:03.000Z"
  assert.equal((await process()).status, "processed")
  const rows = await pool.query("SELECT status FROM social_publish_reconciliations ORDER BY created_at")
  assert.deepEqual(rows.rows.map((row) => row.status), ["publicationFound"])
})
