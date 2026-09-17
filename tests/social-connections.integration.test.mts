import assert from "node:assert/strict"
import test from "node:test"
import { randomUUID } from "node:crypto"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime"
import { ConnectionsClient } from "../src/app/workspace/connections-client"
import { ConnectionFlowError } from "../src/application/social-connections/connection-flow"
import { readConnectionAccounts } from "../src/application/social-connections/view"
import { createSocialConnectionHttp } from "../src/infrastructure/web/social-connection-http"
import { createWorkRequestAuthenticator } from "../src/lib/auth/work-request"
import { connectionFixture, origin, secrets } from "./social-connections-fixture"

test("Facebook selection is encrypted, explicit, single-use and reconnect preserves canonical identity", async (t) => {
  const f = await connectionFixture(t)
  const flow = await f.begin()
  const initiated = await f.row(flow.id)
  assert.equal(initiated.state_digest.length, 32)
  assert.ok(!JSON.stringify(initiated).includes(flow.query.get("flow")!))
  assert.equal((await f.service.callback("owner", flow.query)).type, "selection")
  const selection = await f.row(flow.id)
  assert.equal(selection.flow_step, "select_page")
  assert.ok(Buffer.isBuffer(selection.provider_context_ciphertext))
  const context = f.cipher.open({ ciphertext: selection.provider_context_ciphertext, iv: selection.provider_context_iv, tag: selection.provider_context_tag }, flow.id)
  assert.ok(context.includes(secrets[0]!))
  for (const secret of secrets) assert.ok(!JSON.stringify(selection).includes(secret!))
  const pages = await f.service.pages("owner", flow.id)
  assert.deepEqual(pages.pages, [{ id: "page-1", name: "First Page" }, { id: "page-2", name: "Chosen Page" }])
  assert.deepEqual(await f.accounts.listAccounts(f.scope), [], "callback must not create an account before a Page is chosen")
  await assert.rejects(f.service.selectPage("owner", flow.id, "not-offered"), ConnectionFlowError)
  assert.equal(f.fake.calls.filter((c) => c.method === "POST" && c.url.pathname.endsWith("select-page")).length, 0)
  await assert.rejects(f.service.callback("owner", flow.query), ConnectionFlowError)
  const outcomes = await Promise.allSettled([f.service.selectPage("owner", flow.id, "page-2"), f.service.selectPage("owner", flow.id, "page-2")])
  assert.equal(outcomes.filter((o) => o.status === "fulfilled").length, 1)
  assert.equal(f.fake.calls.filter((c) => c.method === "POST" && c.url.pathname.endsWith("select-page")).length, 1)
  const completed = await f.row(flow.id)
  assert.equal(completed.flow_step, "completed")
  assert.ok(completed.consumed_at)
  assert.equal(completed.provider_context_ciphertext, null)
  assert.equal(completed.provider_context_iv, null)
  assert.equal(completed.provider_context_tag, null)
  assert.deepEqual(completed.selection_options, [])
  await assert.rejects(f.service.pages("owner", flow.id))
  const [account] = await f.accounts.listAccounts(f.scope)
  assert.ok(account)
  assert.equal(account.nativeAccountRef, "page-2")
  const bindings = await f.accounts.listBindings(f.scope, account.id)
  assert.equal(bindings.length, 1)
  assert.equal(bindings[0]!.channel, "facebook")
  assert.equal((await f.accounts.resolveAccount(f.scope, account.id))?.account.providerAccountRef, "account-facebook")
  const reconnect = await f.begin("facebook", account.id)
  await f.service.callback("owner", reconnect.query)
  await f.service.selectPage("owner", reconnect.id, "page-2")
  assert.deepEqual((await f.accounts.listAccounts(f.scope)).map((a) => a.id), [account.id])
  assert.equal((await f.accounts.listBindings(f.scope, account.id))[0]!.id, bindings[0]!.id)
  assert.equal(f.fake.calls.filter((c) => c.method === "POST" && c.url.pathname.endsWith("/profiles")).length, 1)
  assert.deepEqual(await readConnectionAccounts(f.accounts, f.scope), [{ id: account.id, channel: "facebook", name: "Connected account", connected: true, canPublish: true, canFetchAnalytics: true }])
  const wrong = await f.begin("facebook", account.id)
  await f.service.callback("owner", wrong.query)
  await assert.rejects(f.service.selectPage("owner", wrong.id, "page-1"), ConnectionFlowError)
  assert.equal((await f.accounts.listAccounts(f.scope))[0]!.nativeAccountRef, "page-2")
  assert.equal((await f.row(wrong.id)).flow_step, "failed")
  assert.equal((await f.pool.query("SELECT count(*)::int AS n FROM social_publish_attempts")).rows[0].n, 0)
  assert.equal((await f.pool.query("SELECT count(*)::int AS n FROM social_publish_results")).rows[0].n, 0)
})

test("Instagram refetch binds once and reconnect reuses the same stable account", async (t) => {
  const f = await connectionFixture(t)
  const flow = await f.begin("instagram")
  const outcomes = await Promise.allSettled([f.service.callback("owner", flow.query), f.service.callback("owner", flow.query)])
  assert.equal(outcomes.filter((o) => o.status === "fulfilled").length, 1)
  const [account] = await f.accounts.listAccounts(f.scope)
  assert.ok(account)
  assert.equal(account.channel, "instagram")
  assert.equal(account.nativeAccountRef, null)
  const reconnect = await f.begin("instagram", account.id)
  await f.service.callback("owner", reconnect.query)
  assert.equal((await f.accounts.listAccounts(f.scope)).length, 1)
  assert.equal((await f.accounts.listAccounts(f.scope))[0]!.id, account.id)
  assert.equal((await f.row(flow.id)).provider_context_ciphertext, null)
  assert.equal(f.fake.calls.filter((c) => c.url.pathname.includes("select-page")).length, 0)
})

test("Facebook and Instagram disconnect through the stored provider binding while preserving UNDA history", async (t) => {
  const f = await connectionFixture(t)
  for (const channel of ["facebook", "instagram"] as const) {
    const flow = await f.begin(channel)
    if (channel === "facebook") {
      await f.service.callback("owner", flow.query)
      await f.service.selectPage("owner", flow.id, "page-2")
    } else await f.service.callback("owner", flow.query)
  }
  const accounts = await f.accounts.listAccounts(f.scope)
  assert.equal(accounts.length, 2)
  const facebook = accounts.find((account) => account.channel === "facebook")!
  const instagram = accounts.find((account) => account.channel === "instagram")!
  const historyBefore = await f.pool.query("SELECT count(*)::int AS n FROM social_publishing_accounts")
  const bindingsBefore = await f.pool.query("SELECT count(*)::int AS n FROM social_provider_account_bindings")

  await f.service.disconnect("owner", f.scope.brandId, facebook.id)
  await f.service.disconnect("owner", f.scope.brandId, instagram.id)

  assert.deepEqual(f.fake.calls.filter((call) => call.method === "DELETE").map((call) => call.url.pathname).sort(), [
    "/api/v1/accounts/account-facebook", "/api/v1/accounts/account-instagram",
  ])
  assert.equal((await f.pool.query("SELECT count(*)::int AS n FROM social_publishing_accounts")).rows[0]!.n, historyBefore.rows[0]!.n)
  assert.equal((await f.pool.query("SELECT count(*)::int AS n FROM social_provider_account_bindings")).rows[0]!.n, bindingsBefore.rows[0]!.n)
  for (const account of [facebook, instagram]) {
    const [binding] = await f.accounts.listBindings(f.scope, account.id)
    assert.equal(binding!.connectionStatus, "disconnected")
    assert.equal(binding!.canPublish, false)
    assert.equal(binding!.canFetchAnalytics, false)
    assert.deepEqual(binding!.capabilities, { publish: false, analytics: false })
  }
  assert.deepEqual(await readConnectionAccounts(f.accounts, f.scope), [
    { id: facebook.id, channel: "facebook", name: "Connected account", connected: false, canPublish: false, canFetchAnalytics: false },
    { id: instagram.id, channel: "instagram", name: "Connected account", connected: false, canPublish: false, canFetchAnalytics: false },
  ])
  await f.service.disconnect("owner", f.scope.brandId, facebook.id)
  assert.equal(f.fake.calls.filter((call) => call.method === "DELETE" && call.url.pathname.endsWith("account-facebook")).length, 1, "a stale second request is safe")
})

test("disconnect enforces ownership and preserves local state when the provider outcome is unknown", async (t) => {
  const f = await connectionFixture(t)
  const flow = await f.begin("instagram")
  await f.service.callback("owner", flow.query)
  const [account] = await f.accounts.listAccounts(f.scope)
  assert.ok(account)
  const before = await f.accounts.listBindings(f.scope, account.id)
  await assert.rejects(f.service.disconnect("other", f.scope.brandId, account.id))
  await assert.rejects(f.service.disconnect("owner", "brand-other", account.id))
  assert.equal(f.fake.calls.filter((call) => call.method === "DELETE").length, 0)
  f.fake.state.failPath = "/api/v1/accounts/account-instagram"
  const diagnostics: unknown[] = []
  const error = console.error
  console.error = (...values: unknown[]) => { diagnostics.push(values) }
  try { await assert.rejects(f.service.disconnect("owner", f.scope.brandId, account.id)) }
  finally { console.error = error }
  for (const secret of secrets) assert.ok(!JSON.stringify(diagnostics).includes(secret), "disconnect diagnostics must not expose provider credentials")
  assert.deepEqual(await f.accounts.listBindings(f.scope, account.id), before)
  f.fake.state.failPath = ""
  f.fake.state.disconnectStatus = 404
  await f.service.disconnect("owner", f.scope.brandId, account.id)
  assert.equal((await f.accounts.listBindings(f.scope, account.id))[0]!.connectionStatus, "disconnected", "a confirmed provider absence is safe to disconnect locally")
})

test("owner, brand, hashed state and expiry are enforced before provider requests", async (t) => {
  const f = await connectionFixture(t)
  await assert.rejects(f.service.begin("other", "brand-owner", "facebook"))
  assert.equal(f.fake.calls.length, 0)
  const flow = await f.begin()
  const calls = f.fake.calls.length
  await assert.rejects(f.service.callback("other", flow.query))
  const tampered = new URLSearchParams(flow.query)
  tampered.set("flow", `${flow.id}.${"a".repeat(43)}`)
  await assert.rejects(f.service.callback("owner", tampered))
  assert.equal(f.fake.calls.length, calls)
  assert.equal((await f.row(flow.id)).flow_step, "initiated", "wrong state must not invalidate the owner's real flow")
  await f.service.callback("owner", flow.query)
  await assert.rejects(f.service.pages("other", flow.id))
  await assert.rejects(f.service.selectPage("other", flow.id, "page-2"))
  await f.pool.query("UPDATE social_connection_intents SET created_at=now()-interval '20 minutes',expires_at=now()-interval '1 minute' WHERE id=$1", [flow.id])
  await assert.rejects(f.service.pages("owner", flow.id), { code: "expired" })
  assert.equal((await f.row(flow.id)).provider_context_ciphertext, null)
  const expired = await f.begin("instagram")
  await f.pool.query("UPDATE social_connection_intents SET created_at=now()-interval '20 minutes',expires_at=now()-interval '1 minute' WHERE id=$1", [expired.id])
  const before = f.fake.calls.length
  await assert.rejects(f.service.callback("owner", expired.query), { code: "expired" })
  assert.equal(f.fake.calls.length, before)
  assert.equal((await f.row(expired.id)).provider_context_ciphertext, null)
})

test("verified provider rejection and binding failure erase context without partial account writes", async (t) => {
  const f = await connectionFixture(t)
  const mismatch = await f.begin("instagram")
  mismatch.query.set("profileId", "other-profile")
  await assert.rejects(f.service.callback("owner", mismatch.query), { code: "accountMismatch" })
  assert.equal((await f.row(mismatch.id)).flow_step, "failed")
  assert.equal((await f.row(mismatch.id)).provider_context_ciphertext, null)
  const denied = await f.begin()
  denied.query.set("error", "access_denied")
  await assert.rejects(f.service.callback("owner", denied.query))
  assert.equal((await f.row(denied.id)).provider_context_ciphertext, null)
  // Force a persistence failure after the canonical-account INSERT, before binding INSERT.
  await f.pool.query(`CREATE FUNCTION fail_test_binding() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'fixture failure'; END; $$;
    CREATE TRIGGER fail_test_binding BEFORE INSERT ON social_provider_account_bindings FOR EACH ROW EXECUTE FUNCTION fail_test_binding()`)
  const failed = await f.begin("instagram")
  await assert.rejects(f.service.callback("owner", failed.query))
  assert.deepEqual(await f.accounts.listAccounts(f.scope), [])
  assert.equal((await f.row(failed.id)).flow_step, "failed")
  assert.equal((await f.row(failed.id)).provider_context_ciphertext, null)
  assert.equal((await f.pool.query("SELECT count(*)::int AS n FROM social_provider_account_bindings")).rows[0].n, 0)
})

test("failed connect-URL requests remain durable and count toward the initiation rate limit", async (t) => {
  const f = await connectionFixture(t)
  f.fake.state.failPath = "/api/v1/connect/facebook"
  for (let i = 0; i < 10; i++) await assert.rejects(f.begin())
  const rows = (await f.pool.query("SELECT flow_step,provider_context_ciphertext FROM social_connection_intents")).rows
  assert.equal(rows.length, 10)
  assert.ok(rows.every((r) => r.flow_step === "failed" && r.provider_context_ciphertext === null))
  const before = f.fake.calls.length
  await assert.rejects(f.begin(), { code: "rateLimited" })
  assert.equal(f.fake.calls.length, before)
  assert.equal(f.fake.calls.filter((c) => c.method === "POST" && c.url.pathname.endsWith("/profiles")).length, 1)
})

test("HTTP routes enforce the shared auth/origin policy, owner scope and clean private redirects", async (t) => {
  const f = await connectionFixture(t)
  let current: { user: { id: string; emailVerified: boolean } } | null = { user: { id: "owner", emailVerified: true } }
  const remembered: string[] = []
  const session = async () => current
  const authenticate = createWorkRequestAuthenticator({ origin: () => origin, isDevelopment: () => false, session })
  const http = createSocialConnectionHttp({ authenticate, session, origin: () => origin, service: () => f.service,
    rememberBrand: async (id) => { remembered.push(id) } })
  const post = (body: unknown, requestOrigin: string | null = origin) => new Request(`${origin}/api/social/connections/facebook`, {
    method: "POST", headers: { "content-type": "application/json", ...(requestOrigin === null ? {} : { origin: requestOrigin }) }, body: JSON.stringify(body),
  })
  for (const requestOrigin of [null, "https://evil.example", "null", "http://127.0.0.1:3000"]) {
    assert.equal((await http.begin(post({ brandId: "brand-owner" }, requestOrigin), "facebook")).status, 403)
    assert.equal((await http.select(post({ intentId: randomUUID(), pageId: "page-1" }, requestOrigin))).status, 403)
    assert.equal((await http.disconnect(post({ brandId: "brand-owner", accountId: "not-owned" }, requestOrigin))).status, 403)
  }
  current = null
  assert.equal((await http.begin(post({ brandId: "brand-owner" }), "facebook")).status, 401)
  assert.equal((await http.pages(new Request(`${origin}/pages?intent=${randomUUID()}`))).status, 401)
  const unauthenticated = await http.callback(new Request(`${origin}/callback?tempToken=${secrets[0]}`))
  assert.ok(unauthenticated.headers.get("location")!.startsWith(`${origin}/login?`))
  current = { user: { id: "owner", emailVerified: false } }
  assert.equal((await http.begin(post({ brandId: "brand-owner" }), "facebook")).status, 401)
  assert.equal(f.fake.calls.length, 0)
  current = { user: { id: "other", emailVerified: true } }
  assert.equal((await http.begin(post({ brandId: "brand-owner" }), "facebook")).status, 422)
  assert.equal(f.fake.calls.length, 0)
  current = { user: { id: "owner", emailVerified: true } }
  assert.equal((await http.begin(post({ brandId: "brand-owner" }), "tiktok")).status, 422)
  assert.equal((await http.begin(post({ brandId: "a".repeat(4100) }), "facebook")).status, 422)
  const begun = await http.begin(post({ brandId: "brand-owner" }), "facebook")
  assert.equal(begun.status, 200)
  assert.deepEqual(Object.keys(await begun.json()), ["authUrl"])
  assert.equal(begun.headers.get("cache-control"), "private, no-store")
  // A separate valid intent makes it easy to inspect the callback state.
  const flow = await f.begin()
  const duplicate = new URLSearchParams(flow.query); duplicate.append("flow", flow.query.get("flow")!)
  const failed = await http.callback(new Request(`${origin}/callback?${duplicate}`))
  assert.equal(failed.headers.get("location"), `${origin}/workspace/connections?connection=failed`)
  const response = await http.callback(new Request(`${origin}/callback?${flow.query}`))
  assert.equal(response.status, 303)
  assert.equal(response.headers.get("referrer-policy"), "no-referrer")
  assert.equal(response.headers.get("cache-control"), "private, no-store")
  assert.equal(response.headers.get("location"), `${origin}/workspace/connections?intent=${flow.id}`)
  assert.deepEqual(remembered, ["brand-owner"])
  const pages = await http.pages(new Request(`${origin}/pages?intent=${flow.id}`))
  const publicPayload = await pages.text()
  for (const secret of [...secrets, flow.query.get("flow")!]) {
    assert.ok(!publicPayload.includes(secret!))
    assert.ok(!response.headers.get("location")!.includes(secret!))
  }
  assert.deepEqual(Object.keys(JSON.parse(publicPayload)).sort(), ["brandId", "intentId", "pages"])
  assert.equal((await http.select(post({ intentId: flow.id, pageId: "not-offered" }))).status, 422)
  current = { user: { id: "other", emailVerified: true } }
  assert.equal((await http.pages(new Request(`${origin}/pages?intent=${flow.id}`))).status, 422)
  assert.equal((await http.select(post({ intentId: flow.id, pageId: "page-2" }))).status, 422)
  current = { user: { id: "owner", emailVerified: true } }
  const selected = await http.select(post({ intentId: flow.id, pageId: "page-2" }))
  assert.equal(selected.status, 200)
  assert.deepEqual(await selected.json(), { redirect: "/workspace/connections?connection=connected" })
  const [account] = await f.accounts.listAccounts(f.scope)
  assert.ok(account)
  current = { user: { id: "other", emailVerified: true } }
  assert.equal((await http.disconnect(post({ brandId: "brand-owner", accountId: account.id }))).status, 422)
  current = { user: { id: "owner", emailVerified: true } }
  const disconnected = await http.disconnect(post({ brandId: "brand-owner", accountId: account.id }))
  assert.equal(disconnected.status, 200)
  assert.deepEqual(await disconnected.json(), { outcome: "disconnected" })
  assert.equal((await http.disconnect(post({ brandId: "brand-owner", accountId: account.id })).then((response) => response.json())).outcome, "alreadyDisconnected")
  const replay = await http.callback(new Request(`${origin}/callback?${flow.query}`))
  assert.equal(replay.headers.get("location"), `${origin}/workspace/connections?connection=failed`)
  f.fake.state.failPath = "/api/v1/connect/facebook"
  const providerError = await http.begin(post({ brandId: "brand-owner" }), "facebook")
  assert.equal(providerError.status, 503)
  const errorBody = await providerError.text()
  for (const secret of secrets) assert.ok(!errorBody.includes(secret!))
  assert.ok(!errorBody.includes("zernio.com"))
})

test("Connections UI renders canonical display data, escaped names and configuration-disabled actions", () => {
  const html = renderToStaticMarkup(createElement(AppRouterContext.Provider, { value: { refresh() {} } as never }, createElement(ConnectionsClient, { brandId: "brand-owner", available: false, intentId: "", outcome: "",
    accounts: [{ id: "canonical-account", channel: "facebook", name: "<script>unsafe</script>", connected: true, canPublish: false, canFetchAnalytics: true }] })))
  assert.ok(html.includes("1 დაკავშირებული"))
  assert.ok(html.includes("&lt;script&gt;unsafe&lt;/script&gt;"))
  assert.ok(!html.includes("<script>unsafe</script>"))
  assert.equal((html.match(/disabled=""/gu) ?? []).length, 3)
  assert.ok(!html.includes("providerAccountRef"))
  assert.ok(!html.includes("providerProfileRef"))
  assert.ok(html.includes("კავშირის გაუქმება"))
  assert.ok(!html.includes("ხელახლა დაკავშირება"))
  assert.ok(html.includes("დაკავშირება"), "the normal channel-level connect action remains available")
  assert.ok(html.includes("შემდეგ ეტაპზე"), "connection must not imply publishing is enabled")
})
