import assert from "node:assert/strict"
import test from "node:test"
import { attempt, prepareSchedule, socialDeliveryFixture } from "./social-delivery-fixture"
import { PostgresSocialPublishStore } from "../src/infrastructure/postgres/social-publish-store"
import { PostgresSocialAnalyticsStore } from "../src/infrastructure/postgres/social-analytics-store"
import { PostgresSocialConnectionsStore } from "../src/infrastructure/postgres/social-connections-store"
import { ingestSocialAnalytics } from "../src/application/analytics/ingest-social-analytics"
import { SocialAnalyticsCursorExpiredError, type NormalizedSocialAnalytics } from "../src/application/analytics/social-analytics-store"
import { createZernioAnalyticsSource } from "../src/infrastructure/zernio/analytics"

const metrics = (likes: number | null) => ({ impressions: 0, reach: null, likes, comments: 2, shares: null, saves: 0,
  clicks: null, views: 12, follows: null, engagementRate: null })
const observation = (updated: string, likes: number | null, provider = "zernio", profile = "provider-profile",
  account = "provider-account", publication = "provider-post"): NormalizedSocialAnalytics => ({ provider, providerProfileRef: profile,
  providerAccountRef: account, channel: "facebook", providerPublicationRef: publication, nativePublicationRef: "native-post",
  publicationUrl: "https://www.facebook.com/example/posts/native-post", providerUpdatedAt: updated,
  observedAt: "2026-09-09T13:00:00.000Z", metrics: metrics(likes), availability: { impressions: true, reach: false,
    likes: likes !== null, comments: true, shares: false, saves: true, clicks: false, views: true, follows: false, engagementRate: false },
  rawMetrics: Object.fromEntries(Object.entries(metrics(likes)).filter(([, value]) => value !== null)) as Record<string, number> })

test("analytics bootstrap precedes cursor deltas and commits normalized snapshots atomically", async (t) => {
  const { pool } = await socialDeliveryFixture(t)
  const publishing = new PostgresSocialPublishStore(pool)
  const a = attempt("analytics")
  await prepareSchedule(pool, a)
  await publishing.claimAttempt(a)
  await publishing.transition(a.id, ["prepared"], "responseReceived", { httpStatus: 201, providerPublicationRef: "provider-post" })
  await publishing.recordResult({ id: "published-result" as never, attemptId: a.id, idempotencyKey: a.idempotencyKey,
    contentId: a.contentId, draftId: a.draftId, draftVersion: a.draftVersion, scheduleId: a.scheduleId,
    scheduleRevision: a.scheduleRevision, publishingAccountId: a.publishingAccountId, channel: a.channel,
    recordedAt: "2026-09-09T12:01:00.000Z", status: "published", providerPublicationRef: "provider-post",
    publishedAt: "2026-09-09T12:00:30.000Z" } as never)
  const store = new PostgresSocialAnalyticsStore(pool)
  const calls: string[] = []
  let deltaCall = 0
  const source = { bootstrap: async (_profile: unknown, page: number) => { calls.push(`bootstrap:${page}`); return {
    observations: [observation("2026-09-09T12:30:00.000Z", null)], nextCursor: null, hasMore: false } },
  delta: async (_profile: unknown, cursor: string | null) => { calls.push(`delta:${cursor}`); deltaCall++
    return deltaCall === 1 ? { observations: [], nextCursor: "cursor-0", hasMore: false }
      : { observations: [observation("2026-09-09T12:45:00.000Z", 0)], nextCursor: "cursor-1", hasMore: false } } }
  await ingestSocialAnalytics({ provider: "zernio", source, store })
  await ingestSocialAnalytics({ provider: "zernio", source, store })
  assert.deepEqual(calls, ["bootstrap:1", "delta:null", "delta:cursor-0"])
  assert.deepEqual(await store.readCursor({ provider: "zernio", providerProfileRef: "provider-profile" }), { cursor: "cursor-1", bootstrapped: true })
  const results = await store.listResults({ ownerId: "owner", brandId: "brand" })
  assert.equal(results.length, 2)
  assert.equal(results[0]!.metrics.likes, 0)
  assert.equal(results[1]!.metrics.likes, null)
  await store.commit({ provider: "zernio", providerProfileRef: "provider-profile" }, [observation("2026-09-09T12:45:00.000Z", 0)], "cursor-1")
  assert.equal((await store.listResults({ ownerId: "owner", brandId: "brand" })).length, 2)
  await assert.rejects(store.commit({ provider: "zernio", providerProfileRef: "provider-profile" },
    [{ ...observation("2026-09-09T12:50:00.000Z", 1), providerAccountRef: "wrong" }], "cursor-bad"), /not an UNDA publication/)
  assert.equal((await store.readCursor({ provider: "zernio", providerProfileRef: "provider-profile" }))?.cursor, "cursor-1")
})

test("analytics lineage survives a safe provider-binding replacement", async (t) => {
  const { pool } = await socialDeliveryFixture(t)
  const publishing = new PostgresSocialPublishStore(pool)
  const oldAttempt = attempt("old-binding")
  await prepareSchedule(pool, oldAttempt)
  await publishing.claimAttempt(oldAttempt)
  await publishing.transition(oldAttempt.id, ["prepared"], "responseReceived", { httpStatus: 201, providerPublicationRef: "old-post" })
  await publishing.recordResult({ id: "old-result" as never, attemptId: oldAttempt.id, idempotencyKey: oldAttempt.idempotencyKey,
    contentId: oldAttempt.contentId, draftId: oldAttempt.draftId, draftVersion: 1, scheduleId: oldAttempt.scheduleId,
    scheduleRevision: 0, publishingAccountId: oldAttempt.publishingAccountId, channel: oldAttempt.channel,
    recordedAt: "2026-09-09T12:01:00.000Z", status: "published", providerPublicationRef: "old-post", publishedAt: "2026-09-09T12:00:30.000Z" } as never)
  const analytics = new PostgresSocialAnalyticsStore(pool)
  await analytics.commit({ provider: "zernio", providerProfileRef: "provider-profile" },
    [observation("2026-09-09T12:30:00.000Z", 4, "zernio", "provider-profile", "provider-account", "old-post")], null, { markBootstrapped: true })
  await pool.query("INSERT INTO social_provider_profiles(id,brand_id,provider,provider_profile_ref) VALUES('meta-profile','brand','meta','meta-profile-ref')")
  await new PostgresSocialConnectionsStore(pool).activateBinding({ ownerId: "owner", brandId: "brand" }, { id: "meta-binding",
    publishingAccountId: "account" as never, channel: "facebook", provider: "meta", providerProfileRef: "meta-profile-ref",
    providerAccountRef: "native-page", expectedActiveBindingId: "binding", verifiedNativeAccountRef: "native-page",
    connectionStatus: "connected", canPublish: true, canFetchAnalytics: true, capabilities: { publish: true, analytics: true } })
  const results = await analytics.listResults({ ownerId: "owner", brandId: "brand" })
  assert.equal(results[0]!.publishingAccountId, "account")
  assert.equal(results[0]!.providerBindingId, "binding")
  assert.equal((await pool.query("SELECT binding_status FROM social_provider_account_bindings WHERE id='binding'")).rows[0].binding_status, "retired")
  assert.deepEqual(await analytics.listResults({ ownerId: "owner", brandId: "missing" }), [])
})

test("an expired delta cursor is reset only if it is still current, then bootstrapped again", async (t) => {
  const { pool } = await socialDeliveryFixture(t)
  const store = new PostgresSocialAnalyticsStore(pool)
  const profile = { provider: "zernio", providerProfileRef: "provider-profile" }
  await store.commit(profile, [], "expired-cursor", { markBootstrapped: true })
  const calls: string[] = []
  const source = {
    bootstrap: async () => {
      calls.push("bootstrap")
      return { observations: [], nextCursor: null, hasMore: false }
    },
    delta: async (_profile: unknown, cursor: string | null) => {
      calls.push(`delta:${cursor}`)
      if (cursor === "expired-cursor") throw new SocialAnalyticsCursorExpiredError()
      return { observations: [], nextCursor: "fresh-cursor", hasMore: false }
    },
  }
  assert.equal(await store.resetCursor(profile, "stale-cursor"), false)
  const [result] = await ingestSocialAnalytics({ provider: "zernio", source, store })
  assert.equal(result?.status, "fulfilled")
  assert.deepEqual(calls, ["delta:expired-cursor", "bootstrap", "delta:null"])
  assert.deepEqual(await store.readCursor(profile), { cursor: "fresh-cursor", bootstrapped: true })
})

test("Zernio normalization preserves measured zero and unavailable null", async () => {
  const client = { request: async () => ({ status: 200, data: { posts: [{ postId: "post", platformAnalytics: [{ platform: "facebook",
    accountId: "account", platformPostId: "native", platformPostUrl: "https://facebook.com/p/native", analytics: {
      impressions: 0, likes: 3, lastUpdated: "2026-09-09T12:00:00Z" } }] }], hasMore: false } }) } as never
  const page = await createZernioAnalyticsSource(client, () => "2026-09-09T13:00:00.000Z")
    .bootstrap({ provider: "zernio", providerProfileRef: "profile" }, 1)
  assert.equal(page.observations[0]!.metrics.impressions, 0)
  assert.equal(page.observations[0]!.metrics.reach, null)
})
