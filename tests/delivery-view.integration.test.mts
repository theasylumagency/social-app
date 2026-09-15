import assert from "node:assert/strict"
import test from "node:test"
import { readDeliveryRecords } from "../src/infrastructure/postgres/delivery-view-store"
import { deliveryItem } from "../src/application/publishing/delivery-view"
import { PostgresSocialPublishStore } from "../src/infrastructure/postgres/social-publish-store"
import { PostgresSocialReconciliationStore } from "../src/infrastructure/postgres/social-reconciliation-store"
import { reconcileSocialContentPublish } from "../src/application/publishing/run-publish-reconciliation"
import { createIsoDateTime } from "../src/core/domain/primitives"
import { attempt, prepareSchedule, socialDeliveryFixture, unknownResult } from "./social-delivery-fixture"

test("scoped projection preserves reschedule, cancellation and ambiguous delivery without mutating records", async (t) => {
  const { pool } = await socialDeliveryFixture(t)
  const a = attempt("projection")
  await prepareSchedule(pool, a)
  const store = new PostgresSocialPublishStore(pool)
  await store.claimAttempt(a)
  await store.transition(a.id, ["prepared"], "dispatchStarted")
  await store.recordResult(unknownResult(a))
  await pool.query(`INSERT INTO social_content_schedule_events(id,schedule_id,revision,event_type,publish_at,actor_user_id,occurred_at)
    VALUES('moved',$1,1,'rescheduled','2026-09-10T12:00Z','owner','2026-09-09T12:02Z'),
      ('cancelled',$1,2,'cancelled',NULL,'owner','2026-09-09T12:03Z')`, [a.scheduleId])
  await pool.query("UPDATE social_provider_account_bindings SET binding_status='retired' WHERE id='binding'")
  const scope = { ownerId: "owner", brandId: "brand" }
  const records = await readDeliveryRecords(pool, scope)
  assert.equal(records.length, 1)
  assert.equal(records[0]!.publishAt, "2026-09-10T12:00:00.000Z")
  assert.equal(records[0]!.cancelled, true)
  assert.equal(records[0]!.canPublish, false)
  assert.equal(records[0]!.week, "2030-01-07")
  assert.equal(records[0]!.attempts.length, 1)
  assert.equal(deliveryItem(records[0]!, { enabled: true, maxAttempts: 3, graceMs: 120_000 }, "2026-09-09T12:10:00Z").state, "unconfirmed")
  await assert.rejects(readDeliveryRecords(pool, { ...scope, ownerId: "another-owner" }), /access denied/)
  await assert.rejects(readDeliveryRecords(pool, { ...scope, brandId: "another-brand" }), /access denied/)
  await readDeliveryRecords(pool, scope)
  assert.deepEqual((await pool.query(`SELECT (SELECT count(*)::int FROM social_publish_attempts) AS attempts,
    (SELECT count(*)::int FROM social_content_schedule_events) AS events,
    (SELECT count(*)::int FROM social_publish_results) AS results`)).rows[0], { attempts: 1, events: 2, results: 1 })
  assert.doesNotMatch(JSON.stringify(records), /provider-account|provider-profile|providerResponseMissing|bundle/)
})

test("terminal reconciliation replaces inconclusive observations and survives retired provider bindings", async (t) => {
  const { pool } = await socialDeliveryFixture(t)
  const a = attempt("confirmed")
  await prepareSchedule(pool, a)
  const store = new PostgresSocialPublishStore(pool)
  const reconciliations = new PostgresSocialReconciliationStore(pool)
  await store.claimAttempt(a)
  await store.recordResult(unknownResult(a))
  const correlation = await reconciliations.findCorrelation({ provider: "zernio", attemptId: a.id })
  assert.ok(correlation)
  const reconcile = (reconciliationId: string, outcome: Parameters<typeof reconcileSocialContentPublish>[0]["outcome"], checkedAt: string) => reconcileSocialContentPublish({ correlation, reconciliationId, outcome, checkedAt: createIsoDateTime(checkedAt), retryPolicy: { maxAttempts: 3 } }, reconciliations)
  await reconcile("inconclusive", { status: "inconclusive", reasonCode: "waiting" }, "2026-09-09T12:02:00Z")
  await reconcile("confirmed", { status: "publicationFound", providerPublicationRef: "private-post-ref", publishedAt: createIsoDateTime("2026-09-09T12:02:30Z") }, "2026-09-09T12:03:00Z")
  await pool.query("UPDATE social_provider_account_bindings SET binding_status='retired' WHERE id='binding'")
  const records = await readDeliveryRecords(pool, { ownerId: "owner", brandId: "brand" })
  assert.equal(records.length, 1)
  assert.equal(records[0]!.attempts.length, 1, "multiple reconciliations must not duplicate attempts")
  assert.equal(records[0]!.attempts[0]!.reconciliation, "publicationFound")
  const item = deliveryItem(records[0]!, null, "2026-09-09T12:10:00Z")
  assert.equal(item.state, "published")
  assert.equal(Date.parse(item.publishedAt!), Date.parse("2026-09-09T12:02:30Z"))
  assert.doesNotMatch(JSON.stringify(records), /private-post-ref/)
})
