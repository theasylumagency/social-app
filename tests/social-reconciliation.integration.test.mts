import assert from "node:assert/strict"
import test from "node:test"
import { createIsoDateTime } from "../src/core/domain/primitives"
import { reconcileSocialContentPublish, recoverOrphanedPublishAttempts } from "../src/application/publishing/run-publish-reconciliation"
import { PostgresSocialPublishStore } from "../src/infrastructure/postgres/social-publish-store"
import { PostgresSocialReconciliationStore } from "../src/infrastructure/postgres/social-reconciliation-store"
import { createZernioReconciler } from "../src/infrastructure/zernio/reconciliation"
import type { createZernioClient } from "../src/infrastructure/zernio/client"
import { attempt, prepareSchedule, socialDeliveryFixture, unknownResult } from "./social-delivery-fixture"

test("orphan recovery distinguishes pre-dispatch work from ambiguous dispatch", async (t) => {
  const { pool } = await socialDeliveryFixture(t)
  const publishes = new PostgresSocialPublishStore(pool)
  const reconciliations = new PostgresSocialReconciliationStore(pool)
  const prepared = attempt("orphan-prepared")
  const dispatched = attempt("orphan-dispatched")
  await prepareSchedule(pool, prepared)
  await prepareSchedule(pool, dispatched)
  await publishes.claimAttempt(prepared)
  await publishes.claimAttempt(dispatched)
  await publishes.transition(dispatched.id, ["prepared"], "dispatchStarted")
  assert.deepEqual(await recoverOrphanedPublishAttempts({ reconciliations, publishes, graceMs: 60_000,
    now: () => createIsoDateTime("2026-09-09T12:10:00.000Z") }), { inspected: 2, recorded: 2 })
  const rows = await pool.query("SELECT a.id,r.status,r.error_code FROM social_publish_attempts a JOIN social_publish_results r ON r.attempt_id=a.id ORDER BY a.id")
  assert.deepEqual(rows.rows, [
    { id: "orphan-dispatched", status: "unknownOutcome", error_code: "providerResponseMissing" },
    { id: "orphan-prepared", status: "retryableFailure", error_code: "providerRequestNotDispatched" },
  ])
  assert.deepEqual(await recoverOrphanedPublishAttempts({ reconciliations, publishes, graceMs: 60_000,
    now: () => createIsoDateTime("2026-09-09T12:11:00.000Z") }), { inspected: 0, recorded: 0 })
})

test("terminal reconciliation is append-only and drives retry decisions", async (t) => {
  const { pool } = await socialDeliveryFixture(t)
  const publishes = new PostgresSocialPublishStore(pool)
  const store = new PostgresSocialReconciliationStore(pool)
  const publication = attempt("terminal")
  await prepareSchedule(pool, publication)
  await publishes.claimAttempt(publication)
  await publishes.transition(publication.id, ["prepared"], "dispatchStarted")
  await publishes.recordResult(unknownResult(publication))
  const correlation = await store.findCorrelation({ provider: "zernio", attemptId: publication.id })
  assert.ok(correlation)
  const first = await reconcileSocialContentPublish({ correlation, reconciliationId: "terminal-failure",
    checkedAt: createIsoDateTime("2026-09-09T12:02:00.000Z"), retryPolicy: { maxAttempts: 3 },
    outcome: { status: "publicationFailed", failureType: "retryable", reasonCode: "providerTemporaryFailure" } }, store)
  assert.deepEqual(first.decision, { decision: "retryAllowed", nextAttemptNumber: 2 })
  const duplicate = await reconcileSocialContentPublish({ correlation, reconciliationId: "late-success",
    checkedAt: createIsoDateTime("2026-09-09T12:03:00.000Z"), retryPolicy: { maxAttempts: 3 },
    outcome: { status: "publicationFound", providerPublicationRef: "post", publishedAt: createIsoDateTime("2026-09-09T12:02:30.000Z") } }, store)
  assert.equal(duplicate.persisted, "alreadyRecorded")
  assert.equal((await pool.query("SELECT count(*)::int AS count FROM social_publish_reconciliations")).rows[0].count, 1)
})

test("Zernio polling never treats one 404 as confirmed absence", async (t) => {
  const { pool } = await socialDeliveryFixture(t)
  const publishes = new PostgresSocialPublishStore(pool)
  const store = new PostgresSocialReconciliationStore(pool)
  const publication = attempt("polling")
  await prepareSchedule(pool, publication)
  await publishes.claimAttempt(publication)
  await publishes.transition(publication.id, ["prepared"], "dispatchStarted")
  await publishes.transition(publication.id, ["dispatchStarted"], "responseReceived", { providerPublicationRef: "post-missing", httpStatus: 201 })
  await publishes.recordResult(unknownResult(publication))
  const correlation = await store.findCorrelation({ provider: "zernio", attemptId: publication.id })
  assert.ok(correlation)
  const client = { async request() { return { status: 404, data: { error: "Not found" } } } } as ReturnType<typeof createZernioClient>
  assert.deepEqual(await createZernioReconciler(client)(correlation), { status: "inconclusive", reasonCode: "providerPublicationNotFound" })
})
