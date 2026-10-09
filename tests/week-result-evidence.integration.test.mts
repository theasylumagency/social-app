import assert from "node:assert/strict"
import test from "node:test"
import { randomUUID } from "node:crypto"
import type { Pool } from "pg"
import { attempt, prepareSchedule, socialDeliveryFixture, unknownResult } from "./social-delivery-fixture"
import { confirmedPublication } from "./week-result-fixture"
import { PostgresSocialPublishStore } from "../src/infrastructure/postgres/social-publish-store"
import { PostgresSocialAnalyticsStore } from "../src/infrastructure/postgres/social-analytics-store"
import { PostgresSocialConnectionsStore } from "../src/infrastructure/postgres/social-connections-store"
import { readWeekResultEvidence } from "../src/infrastructure/postgres/week-result-evidence-store"
import { readWeekEvidence, saveWeekEvidence } from "../src/infrastructure/postgres/social-strategy-store"
import { PostgresSocialReconciliationStore } from "../src/infrastructure/postgres/social-reconciliation-store"
import { reconcileSocialContentPublish } from "../src/application/publishing/run-publish-reconciliation"
import { createIsoDateTime } from "../src/core/domain/primitives"
import { subscribeFixture, strategicBrandFixture } from "./strategic-integration-fixture"
import { beginWeeklyPlanning } from "../src/infrastructure/postgres/weekly-planning-store"
import { currentWeek } from "../src/application/dashboard/model"
import { compilePlanningContext } from "../src/application/weekly-planning/advance"

const scope = { ownerId: "owner", brandId: "brand" }
const profile = { provider: "zernio", providerProfileRef: "provider-profile" }
const observation = (id: string, at: string, likes: number) => ({ ...confirmedPublication(id).measurement!, providerProfileRef: profile.providerProfileRef,
  metrics: { ...confirmedPublication(id).measurement!.metrics, likes }, rawMetrics: { impressions: 0, likes }, providerUpdatedAt: at })
async function publish(pool: Pool, id: string, publishedAt = "2026-09-09T12:00:30.000Z", accountId = "account", brandId = "brand") {
  const a = { ...attempt(id, new Date(Date.parse(publishedAt) - 30_000).toISOString()), publishingAccountId: accountId } as ReturnType<typeof attempt>
  await prepareSchedule(pool, a, { ownerId: "owner", brandId })
  const store = new PostgresSocialPublishStore(pool)
  await store.claimAttempt(a)
  await store.transition(a.id, ["prepared"], "responseReceived", { httpStatus: 201, providerPublicationRef: id })
  await store.recordResult({ ...a, id: "result:" + id, attemptId: a.id, recordedAt: new Date(Date.parse(publishedAt) + 30_000).toISOString(),
    status: "published", providerPublicationRef: id, publishedAt } as never)
  return a
}

test("period evidence uses one latest snapshot, trusted historical lineage and a reproducible ingestion cutoff", async t => {
  const { pool } = await socialDeliveryFixture(t)
  await subscribeFixture(pool, "owner")
  await publish(pool, "post")
  const analytics = new PostgresSocialAnalyticsStore(pool)
  await analytics.commit(profile, [observation("post", "2026-09-10T12:00:00.000Z", 5), observation("post", "2026-09-11T12:00:00.000Z", 0)], null)
  await saveWeekEvidence(pool, "owner", "brand", { week: "2026-09-07", reviewedAt: "forged", availability: "available", observations: [
    { level: "connected", observation: "Owner reported sales", source: "CRM export" }], execution: ["Owner claims five publications"], unknowns: [], businessContext: "Promotion" })
  const cutoff = new Date().toISOString()
  const evidence = (await readWeekResultEvidence(pool, "owner", "brand", "2026-09-07", cutoff))[0]!
  assert.equal(evidence.results!.publicationCount, 1, "source plan's 2030 week must not override actual 2026 publication week")
  assert.equal(evidence.results!.measuredPostCount, 1)
  assert.equal(evidence.availability, "partial")
  assert.equal(evidence.results!.posts[0]!.measurement!.metrics.likes, 0)
  assert.equal(evidence.results!.posts[0]!.measurement!.metrics.reach, null)
  assert.equal(evidence.results!.posts[0]!.lineage[0]!.draftVersion, 1)
  assert.equal(evidence.results!.posts[0]!.measurement!.metricContract, "zernio.reported-fields.v1")
  assert.equal(evidence.observations[0]!.provenance, "manual")
  assert.equal((await readWeekEvidence(pool, "owner", "brand"))[0]!.availability, "unavailable")
  assert.deepEqual((await readWeekResultEvidence(pool, "owner", "brand", "2026-09-07", cutoff))[0], evidence, "historical backfill projection is idempotent")
  await new Promise(resolve => setTimeout(resolve, 10))
  await analytics.commit(profile, [observation("post", "2026-09-12T12:00:00.000Z", 9)], null)
  assert.deepEqual((await readWeekResultEvidence(pool, "owner", "brand", "2026-09-07", cutoff))[0], evidence, "late ingestion excluded even with old source and observed dates")
  const fresh = (await readWeekResultEvidence(pool, "owner", "brand", "2026-09-07"))[0]!
  assert.equal(fresh.results!.posts[0]!.measurement!.metrics.likes, 9)
  await analytics.commit(profile, [{ ...observation("post", "2026-09-13T12:00:00.000Z", 10), nativePublicationRef: null }], null)
  assert.equal((await readWeekResultEvidence(pool, "owner", "brand", "2026-09-07"))[0]!.results!.posts[0]!.measurement!.nativePublicationRef, "post", "missing latest identity retains an earlier unambiguous native link")
  await analytics.commit(profile, [{ ...observation("post", "2026-09-14T12:00:00.000Z", 11), nativePublicationRef: "contradictory-native" }], null)
  assert.equal((await readWeekResultEvidence(pool, "owner", "brand", "2026-09-07"))[0]!.results!.measuredPostCount, 0, "contradictory native identity cannot authorize metrics")
  assert.equal((await readWeekResultEvidence(pool, "other", "brand", "2026-09-07"))[0]!.results!.publicationCount, 0)
  assert.deepEqual((await readWeekResultEvidence(pool, "owner", "missing", "2026-09-07"))[0]!.observations, [])
})

test("prepared and cancelled schedules are not exposure; terminal reconciliation without a journal ref admits its exact analytics link", async t => {
  const { pool } = await socialDeliveryFixture(t)
  const publishing = new PostgresSocialPublishStore(pool), analytics = new PostgresSocialAnalyticsStore(pool)
  const prepared = attempt("prepared")
  await prepareSchedule(pool, prepared); await publishing.claimAttempt(prepared)
  await publishing.transition(prepared.id, ["prepared"], "responseReceived", { providerPublicationRef: "prepared", httpStatus: 201 })
  await analytics.commit(profile, [observation("prepared", "2026-09-10T12:00:00.000Z", 99)], null)
  const cancelled = attempt("cancelled")
  await prepareSchedule(pool, cancelled)
  await pool.query("INSERT INTO social_content_schedule_events(id,schedule_id,revision,event_type,actor_user_id,reason) VALUES('cancel', $1,1,'cancelled','owner','Cancelled before dispatch')", [cancelled.scheduleId])
  const unknown = attempt("unknown")
  await prepareSchedule(pool, unknown); await publishing.claimAttempt(unknown)
  await publishing.transition(unknown.id, ["prepared"], "dispatchStarted")
  await publishing.recordResult(unknownResult(unknown))
  assert.equal((await readWeekResultEvidence(pool, "owner", "brand", "2026-09-07"))[0]!.results!.publicationCount, 0)
  await assert.rejects(analytics.commit(profile, [observation("found", "2026-09-10T12:00:00.000Z", 0)], null), /not an UNDA publication/)
  const reconciliations = new PostgresSocialReconciliationStore(pool)
  const correlation = (await reconciliations.findCorrelation({ provider: "zernio", attemptId: unknown.id }))!
  await reconcileSocialContentPublish({ correlation, reconciliationId: "found", checkedAt: createIsoDateTime("2026-09-09T12:03:00.000Z"),
    retryPolicy: { maxAttempts: 3 }, outcome: { status: "publicationFound", providerPublicationRef: "found", publishedAt: createIsoDateTime("2026-09-09T12:00:30.000Z") } }, reconciliations)
  await analytics.commit(profile, [observation("found", "2026-09-10T12:00:00.000Z", 0)], null)
  const evidence = (await readWeekResultEvidence(pool, "owner", "brand", "2026-09-07"))[0]!
  assert.equal(evidence.results!.publicationCount, 1); assert.equal(evidence.results!.measuredPostCount, 1)
  assert.equal(evidence.results!.posts[0]!.lineage[0]!.attemptId, unknown.id)
})

test("reconnecting a provider retains measured lineage and cannot duplicate a physical publication", async t => {
  const { pool } = await socialDeliveryFixture(t)
  const a = await publish(pool, "old-post")
  const analytics = new PostgresSocialAnalyticsStore(pool)
  await analytics.commit(profile, [observation("old-post", "2026-09-10T12:00:00.000Z", 3)], null)
  await pool.query("INSERT INTO social_provider_profiles(id,brand_id,provider,provider_profile_ref) VALUES('meta-profile','brand','meta','meta-profile-ref')")
  await new PostgresSocialConnectionsStore(pool).activateBinding(scope, { id: "meta-binding", publishingAccountId: "account" as never,
    channel: "facebook", provider: "meta", providerProfileRef: "meta-profile-ref", providerAccountRef: "native-page", expectedActiveBindingId: "binding",
    verifiedNativeAccountRef: "native-page", connectionStatus: "connected", canPublish: true, canFetchAnalytics: true, capabilities: { publish: true, analytics: true } })
  const replacement = { ...a, id: "reconnected-attempt", idempotencyKey: "intent:reconnected", attemptNumber: 1 } as ReturnType<typeof attempt>
  const store = new PostgresSocialPublishStore(pool)
  await store.claimAttempt(replacement)
  await store.transition(replacement.id, ["prepared"], "responseReceived", { httpStatus: 201, providerPublicationRef: "meta-post" })
  await store.recordResult({ ...replacement, id: "meta-result", attemptId: replacement.id, recordedAt: "2026-09-09T12:02:00.000Z",
    status: "published", providerPublicationRef: "meta-post", publishedAt: "2026-09-09T12:00:30.000Z" } as never)
  await analytics.commit({ provider: "meta", providerProfileRef: "meta-profile-ref" }, [{ ...observation("meta-post", "2026-09-11T12:00:00.000Z", 4),
    provider: "meta", providerProfileRef: "meta-profile-ref", providerAccountRef: "native-page", nativePublicationRef: "old-post", metricContract: "meta.reported-fields.v1" }], null)
  const evidence = (await readWeekResultEvidence(pool, "owner", "brand", "2026-09-07"))[0]!
  assert.equal(evidence.results!.publicationCount, 1); assert.equal(evidence.results!.posts[0]!.lineage.length, 2)
  assert.equal(evidence.results!.posts[0]!.measurement!.providerBindingId, "meta-binding")
  assert.equal(evidence.results!.posts[0]!.measurement!.metrics.likes, 4, "different-source snapshots are not summed")
})

test("new planning runs freeze the same measured evidence shown in results and compact its model context", async t => {
  const { pool } = await socialDeliveryFixture(t)
  await subscribeFixture(pool, "owner")
  const brandId = await strategicBrandFixture(pool)
  await pool.query("INSERT INTO social_provider_profiles(id,brand_id,provider,provider_profile_ref) VALUES('p2',$1,'zernio','profile2')", [brandId])
  await pool.query("INSERT INTO social_publishing_accounts(id,brand_id,channel,native_account_ref,display_name) VALUES('account2',$1,'facebook','native2','Page 2')", [brandId])
  await pool.query(`INSERT INTO social_provider_account_bindings(id,publishing_account_id,brand_id,channel,provider,provider_profile_ref,provider_account_ref,
    connection_status,can_publish,can_fetch_analytics,capabilities) VALUES('binding2','account2',$1,'facebook','zernio','profile2','provider-account2','connected',true,true,'{}')`, [brandId])
  const publishedAt = new Date(Date.now() - 60_000).toISOString()
  await publish(pool, "current-post", publishedAt, "account2", brandId)
  const analytics = new PostgresSocialAnalyticsStore(pool), week = currentWeek()
  const current = { ...observation("current-post", new Date(Date.now() - 20_000).toISOString(), 2), providerProfileRef: "profile2", providerAccountRef: "provider-account2",
    observedAt: new Date(Date.now() - 10_000).toISOString() }
  await analytics.commit({ provider: "zernio", providerProfileRef: "profile2" }, [current], null)
  const run = await beginWeeklyPlanning(pool, "owner", { id: randomUUID(), brandId, week, priority: "" })
  const frozen = structuredClone(run.payload.evidence!), captured = frozen.find(e => e.week === week)!
  assert.equal(captured.results!.posts[0]!.measurement!.metrics.likes, 2)
  assert.deepEqual(await readWeekResultEvidence(pool, "owner", brandId, week, captured.results!.asOf), frozen)
  const context = compilePlanningContext(run)
  assert.equal(context.dataAvailability.performance, "partial"); assert.equal(context.recentResults.length, 1)
  assert.doesNotMatch(JSON.stringify(context.evidenceReview), /publicationInputId|snapshotId|providerProfileRef|rawMetrics/)
  assert.ok(JSON.stringify(context.evidenceReview).length < JSON.stringify(frozen).length)
  await new Promise(resolve => setTimeout(resolve, 10))
  await analytics.commit({ provider: "zernio", providerProfileRef: "profile2" }, [{ ...current, providerUpdatedAt: new Date(Date.now() - 5_000).toISOString(),
    metrics: { ...current.metrics, likes: 8 } }], null)
  await saveWeekEvidence(pool, "owner", brandId, { week, reviewedAt: "", availability: "available", observations: [], execution: [], unknowns: [], businessContext: "Changed business context" })
  const fresh = (await readWeekResultEvidence(pool, "owner", brandId, week))[0]!
  assert.equal(fresh.results!.posts[0]!.measurement!.metrics.likes, 8)
  assert.equal(fresh.businessContext, "Changed business context")
  assert.deepEqual((await pool.query("SELECT payload FROM weekly_planning_runs WHERE id=$1", [run.id])).rows[0].payload.evidence, frozen)
  const duplicate = await beginWeeklyPlanning(pool, "owner", { id: run.id, brandId, week, priority: "" })
  assert.deepEqual(duplicate.payload.evidence, frozen, "idempotent begin does not recapture newer observations")
})
