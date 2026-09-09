import assert from "node:assert/strict"
import test from "node:test"
import { PostgresSocialPublishStore } from "../src/infrastructure/postgres/social-publish-store"
import { PostgresSocialConnectionsStore } from "../src/infrastructure/postgres/social-connections-store"
import { attempt, prepareSchedule, socialDeliveryFixture, unknownResult } from "./social-delivery-fixture"

test("PostgreSQL publish store owns atomic claims, exact binding provenance, and idempotent results", async (t) => {
  const { pool } = await socialDeliveryFixture(t)
  const store = new PostgresSocialPublishStore(pool)
  const publication = attempt("atomic")
  await prepareSchedule(pool, publication)
  const claims = await Promise.all([store.claimAttempt(publication), store.claimAttempt(publication)])
  assert.equal(claims.filter((claim) => claim.status === "acquired").length, 1)
  assert.equal(claims.filter((claim) => claim.status === "alreadyRecorded").length, 1)
  const journal = await store.loadRequest(publication.id)
  assert.equal(journal?.providerBindingId, "binding")
  assert.equal(journal?.provider, "zernio")
  assert.match(journal?.requestId ?? "", /^[a-f0-9-]{36}$/u)
  const result = unknownResult(publication)
  assert.deepEqual(await store.recordResult(result), { status: "recorded" })
  assert.deepEqual(await store.recordResult({ ...result, id: "other-result" as never }), { status: "alreadyRecorded", result })
  assert.equal((await pool.query("SELECT count(*)::int AS count FROM social_publish_attempts")).rows[0].count, 1)
  assert.equal((await pool.query("SELECT count(*)::int AS count FROM social_provider_publish_requests")).rows[0].count, 1)
})

test("binding migration is safe before dispatch and blocked after ambiguous dispatch", async (t) => {
  const { pool } = await socialDeliveryFixture(t)
  const publishes = new PostgresSocialPublishStore(pool)
  const connections = new PostgresSocialConnectionsStore(pool)
  const scope = { ownerId: "owner", brandId: "brand" }
  const prepared = attempt("prepared")
  await prepareSchedule(pool, prepared)
  await publishes.claimAttempt(prepared)
  await pool.query(`INSERT INTO social_provider_profiles(id,brand_id,provider,provider_profile_ref)
    VALUES('meta-profile','brand','meta','meta-profile-ref')`)
  await connections.activateBinding(scope, { id: "meta-binding", publishingAccountId: "account" as never, channel: "facebook", provider: "meta",
    providerProfileRef: "meta-profile-ref", providerAccountRef: "native-page",
    expectedActiveBindingId: "binding", verifiedNativeAccountRef: "native-page", connectionStatus: "connected", canPublish: true,
    canFetchAnalytics: true, capabilities: { publish: true, analytics: true } })
  assert.equal((await publishes.loadRequest("prepared" as never))?.providerBindingId, "binding")

  const dispatched = attempt("dispatched")
  await prepareSchedule(pool, dispatched)
  await publishes.claimAttempt(dispatched)
  await publishes.transition(dispatched.id, ["prepared"], "dispatchStarted")
  await publishes.recordResult(unknownResult(dispatched))
  await assert.rejects(connections.activateBinding(scope, { id: "next-binding", publishingAccountId: "account" as never,
    channel: "facebook", provider: "zernio", providerProfileRef: "provider-profile", providerAccountRef: "provider-next",
    expectedActiveBindingId: "meta-binding", verifiedNativeAccountRef: "native-page",
    connectionStatus: "connected", canPublish: true, canFetchAnalytics: true, capabilities: { publish: true, analytics: true } }),
  /Unresolved publication attempt/)
})
