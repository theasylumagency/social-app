import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { readdir, readFile } from "node:fs/promises"
import test from "node:test"
import { Pool } from "pg"
import { PostgresSocialConnectionsStore } from "../src/infrastructure/postgres/social-connections-store"
import { ensurePersonalWorkspace } from "../src/infrastructure/postgres/workspace-store"
import { SocialConnectionConflict, type ActivateProviderBindingInput } from "../src/application/social-connections/connection-store"
import { SocialProviderRegistry } from "../src/application/social-connections/provider-registry"
import type { SocialPublishingAccountId } from "../src/blueprints/social/content-publish-eligibility"
import { SOCIAL_CHANNELS } from "../src/blueprints/social/tokens"
import { attempt, prepareSchedule } from "./social-delivery-fixture"

test("social persistence preserves canonical accounts and isolates provider bindings", async (t) => {
  assert.ok(process.env.DATABASE_URL, "DATABASE_URL is required: foundation integration coverage must not be skipped")
  const admin = new Pool({ connectionString: process.env.DATABASE_URL })
  const schema = `social_test_${randomUUID().replaceAll("-", "")}`
  assert.match(schema, /^social_test_[a-f0-9]{32}$/)
  await admin.query(`CREATE SCHEMA "${schema}"`)
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, options: `-c search_path=${schema}` })
  t.after(async () => { await pool.end(); await admin.query(`DROP SCHEMA "${schema}" CASCADE`); await admin.end() })
  for (const file of (await readdir(new URL("../db/migrations/", import.meta.url))).filter((f) => f.endsWith(".sql")).sort()) {
    await pool.query(await readFile(new URL(`../db/migrations/${file}`, import.meta.url), "utf8"))
  }
  for (const id of ["owner", "other"]) {
    await pool.query('INSERT INTO auth_user(id,name,email,"emailVerified") VALUES($1,$1,$2,true)', [id, `${id}@example.test`])
    const workspace = await ensurePersonalWorkspace(pool, id)
    await pool.query("INSERT INTO brands(id,created_at,workspace_id) VALUES($1,now(),$2)", [`brand-${id}`, workspace.workspaceId])
  }
  const scope = { ownerId: "owner", brandId: "brand-owner" }
  const otherScope = { ownerId: "other", brandId: "brand-other" }
  const store = new PostgresSocialConnectionsStore(pool)
  const accountId = "account-facebook" as SocialPublishingAccountId
  const account = { id: accountId, channel: "facebook" as const, nativeAccountRef: "native-page", username: "brand",
    displayName: "My Page", profileUrl: "https://www.facebook.com/brand" }
  const profile = { id: "profile-zernio", provider: "zernio", providerProfileRef: "external-profile" }
  const health = { connectionStatus: "connected" as const, canPublish: true, canFetchAnalytics: true, capabilities: { publish: true } }
  const binding: ActivateProviderBindingInput = { id: "binding-zernio", publishingAccountId: accountId,
    channel: "facebook", provider: "zernio", providerProfileRef: profile.providerProfileRef, providerAccountRef: "zernio-page",
    expectedActiveBindingId: null, verifiedNativeAccountRef: "native-page", ...health }

  await t.test("canonical table has no provider identity or capability columns", async () => {
    const columns = (await pool.query<{ column_name: string }>(`SELECT column_name FROM information_schema.columns
      WHERE table_schema=$1 AND table_name='social_publishing_accounts'`, [schema])).rows.map((r) => r.column_name)
    assert.deepEqual(columns.sort(), ["id", "brand_id", "channel", "native_account_ref", "username", "display_name", "profile_url", "created_at", "updated_at"].sort())
  })
  await t.test("profile/account saves are idempotent and owner scoped", async () => {
    assert.deepEqual(await store.saveProfile(scope, profile), await store.saveProfile(scope, profile))
    assert.deepEqual(await store.saveAccount(scope, account), await store.saveAccount(scope, account))
    await assert.rejects(store.listAccounts({ ...scope, ownerId: "other" }), /Brand access denied/)
    await assert.rejects(store.saveAccount(otherScope, account), SocialConnectionConflict)
    await assert.rejects(store.saveProfile(scope, { ...profile, providerProfileRef: "other-profile" }), SocialConnectionConflict)
    assert.deepEqual(await store.listAccounts(otherScope), [])
    assert.equal(await store.resolveAccount(scope, accountId), null)
  })
  await t.test("native identities are unique by platform, and cannot be retargeted", async () => {
    await assert.rejects(store.saveAccount(scope, { ...account, id: "duplicate" as SocialPublishingAccountId }), { code: "23505" })
    await assert.rejects(store.saveAccount(scope, { ...account, nativeAccountRef: "other-page" }), SocialConnectionConflict)
    await store.saveAccount(scope, { ...account, id: "account-instagram" as SocialPublishingAccountId, channel: "instagram" })
    assert.equal((await store.listAccounts(scope)).length, 2)
  })
  await t.test("database rejects wrong channel and cross-brand profiles even without the store", async () => {
    await store.saveProfile(otherScope, { id: "other-profile", provider: "zernio", providerProfileRef: "other-external" })
    const insert = `INSERT INTO social_provider_account_bindings
      (id,publishing_account_id,brand_id,channel,provider,provider_profile_ref,provider_account_ref,connection_status)
      VALUES('bad',$1,$2,$3,'zernio',$4,'bad-ref','connected')`
    await assert.rejects(pool.query(insert, [accountId, scope.brandId, "instagram", profile.providerProfileRef]), { code: "23503" })
    await assert.rejects(pool.query(insert, [accountId, scope.brandId, "facebook", "other-external"]), { code: "23503" })
    await assert.rejects(pool.query(insert, [accountId, otherScope.brandId, "facebook", "other-external"]), { code: "23503" })
    await assert.rejects(store.activateBinding(scope, { ...binding, providerProfileRef: "other-external" }), /Active provider profile not found/)
  })
  await t.test("one active binding and exact domain hydration", async () => {
    const saved = await store.activateBinding(scope, binding)
    assert.deepEqual(await store.activateBinding(scope, binding), saved)
    const resolved = await store.resolveAccount(scope, accountId)
    assert.deepEqual(resolved?.account, { id: accountId, channel: SOCIAL_CHANNELS.facebook, providerAccountRef: "zernio-page", connected: true })
    await assert.rejects(pool.query(`INSERT INTO social_provider_account_bindings
      (id,publishing_account_id,brand_id,channel,provider,provider_profile_ref,provider_account_ref,connection_status)
      VALUES('duplicate',$1,$2,'facebook','zernio',$3,'duplicate','connected')`, [accountId, scope.brandId, profile.providerProfileRef]), { code: "23505" })
  })
  await t.test("health changes affect binding only and reconnect preserves identity", async () => {
    await store.updateBindingHealth(scope, binding.id, { ...health, connectionStatus: "disconnected" })
    assert.equal((await store.resolveAccount(scope, accountId))?.account.connected, false)
    assert.ok((await pool.query("SELECT disconnected_at FROM social_provider_account_bindings WHERE id=$1", [binding.id])).rows[0].disconnected_at)
    await store.updateBindingHealth(scope, binding.id, { ...health, canPublish: false })
    assert.equal((await store.resolveAccount(scope, accountId))?.account.connected, false)
    await store.updateBindingHealth(scope, binding.id, health)
    assert.equal((await store.resolveAccount(scope, accountId))?.account.connected, true)
    await pool.query("UPDATE social_provider_profiles SET status='disabled' WHERE id=$1", [profile.id])
    assert.equal((await store.resolveAccount(scope, accountId))?.account.connected, false)
    await pool.query("UPDATE social_provider_profiles SET status='active' WHERE id=$1", [profile.id])
    await assert.rejects(store.updateBindingHealth(scope, binding.id, { ...health, capabilities: { access_token: true } }), /Invalid connection capabilities/)
    await assert.rejects(store.updateBindingHealth(otherScope, binding.id, health), /Active provider binding not found/)
    assert.deepEqual((await store.listAccounts(scope)).find((a) => a.id === accountId), { ...account, brandId: scope.brandId })
  })
  await t.test("replacement requires verified native identity and no unresolved attempts", async () => {
    await store.saveProfile(scope, { id: "profile-meta", provider: "meta", providerProfileRef: "meta-profile" })
    const replacement = { ...binding, id: "binding-meta", provider: "meta", providerProfileRef: "meta-profile",
      providerAccountRef: "native-page", expectedActiveBindingId: binding.id }
    await assert.rejects(store.activateBinding(scope, { ...replacement, verifiedNativeAccountRef: "wrong" }), /Verified native account identity/)
    const legacyAttempt = { ...attempt("attempt"), idempotencyKey: "intent", contentId: "content", draftId: "draft",
      scheduleId: "schedule", publishingAccountId: accountId }
    await prepareSchedule(pool, legacyAttempt as never, scope)
    await pool.query(`INSERT INTO social_publish_attempts
      (id,idempotency_key,attempt_number,content_id,draft_id,draft_version,schedule_id,schedule_revision,publishing_account_id,channel,publish_at,attempted_at)
      VALUES('attempt','intent',1,'content','draft',1,'schedule',0,$1,'facebook',now(),now())`, [accountId])
    await assert.rejects(store.activateBinding(scope, replacement), /Unresolved publication attempt/)
    await pool.query("INSERT INTO social_publish_results(id,attempt_id,recorded_at,status,error_code) VALUES('result','attempt',now(),'unknownOutcome','test')")
    await assert.rejects(store.activateBinding(scope, replacement), /Unresolved publication attempt/)
    // Remove only this isolated fixture result; production never overwrites a result.
    await pool.query("DELETE FROM social_publish_results WHERE id='result'")
    await pool.query("INSERT INTO social_publish_results(id,attempt_id,recorded_at,status,error_code) VALUES('result','attempt',now(),'permanentFailure','test')")
    await store.activateBinding(scope, replacement)
    assert.equal((await store.resolveAccount(scope, accountId))?.account.providerAccountRef, "native-page")
    assert.equal((await store.resolveAccount(scope, accountId))?.account.id, accountId)
    assert.equal((await pool.query("SELECT publishing_account_id FROM social_publish_attempts WHERE id='attempt'")).rows[0].publishing_account_id, accountId)
    assert.equal((await store.listBindings(scope, accountId)).find((b) => b.id === binding.id)?.bindingStatus, "retired")
  })
  await t.test("retired history cannot be edited or reactivated", async () => {
    await assert.rejects(store.updateBindingHealth(scope, binding.id, health), /Active provider binding not found/)
    await assert.rejects(pool.query("UPDATE social_provider_account_bindings SET binding_status='active' WHERE id=$1", [binding.id]), { code: "23514" })
    await assert.rejects(pool.query("UPDATE social_provider_account_bindings SET provider_account_ref='repointed' WHERE id='binding-meta'"), { code: "23514" })
  })
  await t.test("concurrent replacements are compare-and-swap and retain the winner", async () => {
    const candidates = ["a", "b"].map((suffix) => store.activateBinding(scope, { ...binding, id: `race-${suffix}`,
      provider: "meta", providerProfileRef: "meta-profile", providerAccountRef: `meta-${suffix}`, expectedActiveBindingId: "binding-meta" }))
    const outcomes = await Promise.allSettled(candidates)
    assert.equal(outcomes.filter((o) => o.status === "fulfilled").length, 1)
    const rejected = outcomes.find((o) => o.status === "rejected")
    assert.ok(rejected?.status === "rejected" && rejected.reason instanceof SocialConnectionConflict)
    assert.equal((await store.listBindings(scope, accountId)).filter((b) => b.bindingStatus === "active").length, 1)
    assert.equal((await store.listAccounts(scope)).find((a) => a.id === accountId)?.nativeAccountRef, "native-page")
  })
  await t.test("failed replacement rolls retirement back", async () => {
    const current = (await store.resolveAccount(scope, accountId))!.binding
    await assert.rejects(store.activateBinding(scope, { ...binding, id: "new-binding", expectedActiveBindingId: current.id }), { code: "23505" })
    assert.equal((await store.resolveAccount(scope, accountId))?.binding.id, current.id)
  })
  await t.test("unknown native identity cannot be used to migrate providers", async () => {
    const unknownId = "unknown-native" as SocialPublishingAccountId
    await store.saveAccount(scope, { ...account, id: unknownId, nativeAccountRef: null })
    await store.activateBinding(scope, { ...binding, id: "unknown-binding", publishingAccountId: unknownId,
      providerAccountRef: "unknown-provider-ref", verifiedNativeAccountRef: null })
    await assert.rejects(store.activateBinding(scope, { ...binding, id: "unknown-replacement", publishingAccountId: unknownId,
      providerAccountRef: "new-ref", expectedActiveBindingId: "unknown-binding", verifiedNativeAccountRef: null }), /Verified native account identity/)
  })
})

test("provider registry routes without provider-specific imports or fallback", () => {
  const zernio = { name: "first" }, meta = { name: "second" }
  const registry = new SocialProviderRegistry([["zernio", zernio], ["meta", meta]])
  assert.equal(registry.resolve("zernio"), zernio)
  assert.equal(registry.resolve("meta"), meta)
  assert.throws(() => registry.resolve("missing"), /not configured/)
  assert.throws(() => new SocialProviderRegistry([["zernio", zernio], ["zernio", meta]]), /distinct/)
  assert.throws(() => new SocialProviderRegistry([[" ", zernio]]), /nonblank/)
})
