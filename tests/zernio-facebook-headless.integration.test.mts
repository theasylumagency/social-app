import assert from "node:assert/strict"
import test from "node:test"
import { randomUUID } from "node:crypto"
import { createConnectionContextCipher } from "../src/infrastructure/zernio/connection-context"
import { fakeZernio, facebookQuery, instagramQuery, origin, secrets, userProfile } from "./social-connections-fixture"

test("profile creation uses a deterministic name and idempotency key; lookup recovers a remote success", async () => {
  const f = fakeZernio()
  assert.equal(await f.provider.ensureProfile("brand-owner"), "profile-1")
  assert.equal(await f.provider.ensureProfile("brand-owner"), "profile-1")
  const writes = f.calls.filter((c) => c.method === "POST")
  assert.equal(writes.length, 1)
  assert.match(writes[0]!.headers.get("idempotency-key")!, /^unda-profile-[a-f0-9]{64}$/u)
  assert.equal(writes[0]!.body!.name, `UNDA ${writes[0]!.headers.get("idempotency-key")!.slice(13)}`)
  assert.equal(f.calls[0]!.url.searchParams.get("includeOverLimit"), "true")
})

test("Facebook is headless; Instagram explicitly uses instagram_login", async () => {
  const f = fakeZernio()
  for (const channel of ["facebook", "instagram"] as const) {
    await f.provider.connectUrl(channel, "profile-1", `${origin}/callback?flow=opaque`)
    const query = f.calls.at(-1)!.url.searchParams
    assert.equal(query.get("profileId"), "profile-1")
    assert.equal(query.get("redirect_url"), `${origin}/callback?flow=opaque`)
    assert.equal(query.get("headless"), channel === "facebook" ? "true" : null)
    assert.equal(query.get("loginMethod"), channel === "instagram" ? "instagram_login" : null)
    assert.ok(!query.toString().includes("facebook_login"))
  }
  f.state.transform = () => ({ authUrl: "https://attacker.example/oauth" })
  await assert.rejects(f.provider.connectUrl("facebook", "profile-1", `${origin}/callback`))
})

test("headless pages are display-only; selection sends decoded userProfile and verifies the selected Page", async () => {
  const f = fakeZernio()
  // Simulate the browser's URL encoding exactly once, including +, % and Unicode.
  const encoded = facebookQuery(`${origin}/callback?flow=opaque`).toString()
  const result = await f.provider.callback("facebook", "profile-1", new URLSearchParams(encoded))
  assert.equal(result.type, "selection")
  if (result.type !== "selection") throw Error("expected selection")
  assert.deepEqual(result.pages, [{ id: "page-1", name: "First Page" }, { id: "page-2", name: "Chosen Page" }])
  for (const secret of secrets) assert.ok(!JSON.stringify(result.pages).includes(secret!))
  assert.equal(f.calls.filter((c) => c.method === "POST").length, 0, "listing must never select the first Page")
  assert.equal(f.calls[0]!.headers.get("x-connect-token"), secrets[1])
  const account = await f.provider.selectPage("profile-1", result.context, "page-2")
  const selected = f.calls.find((c) => c.method === "POST")!
  assert.deepEqual(selected.body, { profileId: "profile-1", pageId: "page-2", tempToken: secrets[0], userProfile, redirect_url: `${origin}/workspace/connections?connection=connected` })
  assert.equal(selected.headers.get("x-connect-token"), secrets[1])
  assert.equal(account.nativeAccountRef, "page-2")
  assert.equal(account.providerAccountRef, "account-facebook")
  assert.ok(f.calls.some((c) => c.url.pathname.endsWith("/facebook-page")))
  for (const secret of secrets) assert.ok(!JSON.stringify(account).includes(secret!))
})

test("empty and single-Page lists still require a separate explicit selection", async () => {
  for (const count of [0, 1]) {
    const f = fakeZernio()
    f.state.pages = f.state.pages.slice(0, count)
    const result = await f.provider.callback("facebook", "profile-1", facebookQuery(`${origin}/callback`))
    assert.equal(result.type, "selection")
    assert.equal(f.calls.filter((c) => c.method === "POST").length, 0)
  }
})

test("Instagram callback refetch rejects wrong account, profile, channel, inactive account and invalid token", async (t) => {
  for (const fault of ["account", "profile", "channel", "inactive", "token", "health-account", "health-channel", "health-error", "health-unknown"]) {
    await t.test(fault, async () => {
      const f = fakeZernio()
      f.state.transform = (url, data) => {
        if (url.pathname.endsWith("/accounts")) {
          const a = (data.accounts as Record<string, unknown>[])[0]!
          if (fault === "account") a._id = "other-account"
          if (fault === "profile") a.profileId = { _id: "other-profile" }
          if (fault === "channel") a.platform = "facebook"
          if (fault === "inactive") a.isActive = false
        } else if (url.pathname.endsWith("/health")) {
          if (fault === "token") data.tokenStatus = { valid: false }
          if (fault === "health-account") data.accountId = "other-account"
          if (fault === "health-channel") data.platform = "facebook"
          if (fault === "health-error") data.status = "error"
          if (fault === "health-unknown") data.status = "future-status"
        }
        return data
      }
      await assert.rejects(f.provider.callback("instagram", "profile-1", instagramQuery(`${origin}/callback`)))
    })
  }
  const f = fakeZernio()
  const query = instagramQuery(`${origin}/callback`)
  query.set("platform", "facebook")
  await assert.rejects(f.provider.callback("instagram", "profile-1", query))
  assert.equal(f.calls.length, 0)
  query.delete("platform")
  const verified = await f.provider.callback("instagram", "profile-1", query)
  assert.equal(verified.type, "connected")
  if (verified.type === "connected") assert.equal(verified.account.nativeAccountRef, null, "never invent a native ID from a provider ID")
})

test("Facebook verification refuses a different native Page", async () => {
  const f = fakeZernio()
  const result = await f.provider.callback("facebook", "profile-1", facebookQuery(`${origin}/callback`))
  assert.equal(result.type, "selection")
  if (result.type !== "selection") throw Error()
  f.state.transform = (url, data) => url.pathname.endsWith("/facebook-page") ? { selectedPageId: "wrong-page" } : data
  await assert.rejects(f.provider.selectPage("profile-1", result.context, "page-2"))
})

test("AES-GCM context is randomized and bound to its intent; tampering and wrong keys fail closed", () => {
  const cipher = createConnectionContextCipher(Buffer.alloc(32, 7).toString("base64"))
  const id = randomUUID()
  const sealed = cipher.seal(secrets[0]!, id)
  assert.equal(cipher.open(sealed, id), secrets[0])
  assert.notDeepEqual(sealed.ciphertext, cipher.seal(secrets[0]!, id).ciphertext)
  assert.throws(() => cipher.open(sealed, randomUUID()))
  const tampered = Buffer.from(sealed.ciphertext); tampered[0] = tampered[0]! ^ 1
  assert.throws(() => cipher.open({ ...sealed, ciphertext: tampered }, id))
  assert.throws(() => createConnectionContextCipher(Buffer.alloc(32, 8).toString("base64")).open(sealed, id))
  assert.throws(() => createConnectionContextCipher("invalid"))
})
