import assert from "node:assert/strict"
import { randomBytes, randomUUID } from "node:crypto"
import { readdir, readFile } from "node:fs/promises"
import test from "node:test"
import { Pool } from "pg"
import { getMigrations } from "better-auth/db/migration"
import { createAuth } from "../src/lib/auth/create-auth"
import { authOrigin } from "../src/lib/auth/environment"
import { createEmailSender, type AuthEmail } from "../src/lib/auth/email"
import { safeReturnPath } from "../src/lib/auth/policy"
import { ensurePersonalWorkspace } from "../src/infrastructure/postgres/workspace-store"
import { PostgresIngestionStore } from "../src/infrastructure/postgres/ingestion-store"
import { createBrandOnboarding } from "../src/application/onboarding/create-brand"

test("return paths and production configuration reject unsafe defaults", () => {
  for (const path of ["https://evil.example", "//evil.example", "/\\evil.example", "/\nevil", "/api/auth/sign-out", ["/account"]]) assert.equal(safeReturnPath(path), "/")
  assert.equal(safeReturnPath("/account?tab=security"), "/account?tab=security")
  assert.throws(() => authOrigin({ NODE_ENV: "production", BETTER_AUTH_URL: "http://localhost:3000" }))
  assert.throws(() => createEmailSender({ NODE_ENV: "production", AUTH_EMAIL_MODE: "preview" }))
})

test("authentication and workspace isolation against PostgreSQL", { skip: !process.env.DATABASE_URL }, async (t) => {
  const admin = new Pool({ connectionString: process.env.DATABASE_URL })
  const schema = `auth_test_${randomUUID().replaceAll("-", "")}`
  assert.match(schema, /^auth_test_[a-f0-9]{32}$/)
  await admin.query(`CREATE SCHEMA "${schema}"`)
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, options: `-c search_path=${schema}` })
  t.after(async () => { await pool.end(); await admin.query(`DROP SCHEMA "${schema}" CASCADE`); await admin.end() })
  for (const file of (await readdir(new URL("../db/migrations/", import.meta.url))).filter((name) => name.endsWith(".sql")).sort()) {
    await pool.query(await readFile(new URL(`../db/migrations/${file}`, import.meta.url), "utf8"))
  }
  const messages: AuthEmail[] = []
  const origin = "http://localhost:3000"
  let googleEmail = "google@example.test"
  const auth = createAuth({
    pool, origin, secret: randomBytes(48).toString("base64url"),
    sendEmail: async (message) => { messages.push(message) },
    providers: { google: {
      clientId: "test-google-client", clientSecret: "test-google-secret",
      getUserInfo: async () => ({ user: { name: "Google User", email: googleEmail, emailVerified: true }, data: {
        sub: googleEmail, email: googleEmail, email_verified: true,
        aud: "test-google-client", azp: "test-google-client", iss: "https://accounts.google.com",
        exp: Math.floor(Date.now() / 1000) + 3600, iat: Math.floor(Date.now() / 1000),
        name: "Google User", given_name: "Google", family_name: "User", picture: "",
      } }),
    } },
  })
  let clientNumber = 0
  function browser() {
    const cookies = new Map<string, string>()
    const ip = `192.0.2.${++clientNumber}`
    return {
      cookies,
      async request(path: string, body?: Record<string, unknown>, requestOrigin = origin) {
        const response = await auth.handler(new Request(new URL(path.startsWith("/api/") ? path : `/api/auth${path}`, origin), {
          method: body ? "POST" : "GET",
          headers: { origin: requestOrigin, "content-type": "application/json", "x-forwarded-for": ip, cookie: [...cookies].map(([key, value]) => `${key}=${value}`).join("; ") },
          ...(body ? { body: JSON.stringify(body) } : {}),
        }))
        for (const cookie of response.headers.getSetCookie()) {
          const pair = cookie.split(";")[0]!
          const index = pair.indexOf("=")
          const name = pair.slice(0, index)
          if (/Max-Age=0/i.test(cookie)) cookies.delete(name)
          else cookies.set(name, pair.slice(index + 1))
        }
        return response
      },
    }
  }
  const password = "a long test-only passphrase"
  const email = "owner@example.test"
  const owner = browser()
  let ownerId = ""

  function emailURL(to: string, subject: string) {
    const message = messages.findLast((item) => item.to === to && item.subject.includes(subject))
    assert.ok(message, "Expected authentication email")
    const match = message.text.match(/http:\/\/localhost:3000\S+/)
    assert.ok(match)
    return new URL(match[0])
  }
  async function googleLogin(client: ReturnType<typeof browser>, rememberMe: boolean) {
    const start = await client.request("/sign-in/social", { provider: "google", callbackURL: "/account", additionalData: { rememberMe } })
    assert.equal(start.status, 200)
    const url = new URL((await start.json()).url)
    assert.equal(url.origin, "https://accounts.google.com")
    assert.ok(url.searchParams.get("code_challenge"), "OAuth must use PKCE")
    const originalFetch = globalThis.fetch
    globalThis.fetch = async (input, init) => {
      if (String(input) === "https://oauth2.googleapis.com/token") return Response.json({ access_token: "test-google-access-token", token_type: "Bearer", expires_in: 3600 })
      return originalFetch(input, init)
    }
    try { return await client.request(`/callback/google?code=test-code&state=${encodeURIComponent(url.searchParams.get("state")!)}`) }
    finally { globalThis.fetch = originalFetch }
  }

  await t.test("checked-in migration matches the installed auth schema", async () => {
    const migration = await getMigrations(auth.options)
    assert.equal(migration.toBeCreated.length, 0)
    assert.equal(migration.toBeAdded.length, 0)
    assert.equal(migration.toBeAddedIndexes.length, 0)
  })

  await t.test("registration requires verification and stores a password hash", async () => {
    const response = await owner.request("/sign-up/email", { name: "Owner", email, password, callbackURL: "/login?verified=1" })
    assert.equal(response.status, 200)
    assert.equal(owner.cookies.has("unda.session_token"), false)
    const signin = await owner.request("/sign-in/email", { email, password, rememberMe: false })
    assert.equal(signin.status, 403)
    const stored = await pool.query('SELECT password FROM auth_account WHERE "providerId" = \'credential\'')
    assert.ok(stored.rows[0].password)
    assert.notEqual(stored.rows[0].password, password)
    const link = emailURL(email, "დაადასტურე")
    const verified = await owner.request(link.pathname + link.search)
    assert.equal(verified.status, 302)
    assert.equal(owner.cookies.has("unda.session_token"), false)
  })

  await t.test("remembered login persists, logout revokes, temporary login does not persist", async () => {
    const remembered = await owner.request("/sign-in/email", { email, password, rememberMe: true })
    assert.equal(remembered.status, 200)
    assert.match(remembered.headers.getSetCookie().find((cookie) => cookie.startsWith("unda.session_token="))!, /Max-Age=2592000/i)
    ownerId = (await remembered.json()).user.id
    const oldCookie = owner.cookies.get("unda.session_token")!
    assert.equal((await owner.request("/sign-out", {})).status, 200)
    const stale = browser(); stale.cookies.set("unda.session_token", oldCookie)
    assert.equal(await (await stale.request("/get-session")).json(), null)
    const temporary = await owner.request("/sign-in/email", { email, password, rememberMe: false })
    const tokenCookie = temporary.headers.getSetCookie().find((cookie) => cookie.startsWith("unda.session_token="))!
    assert.doesNotMatch(tokenCookie, /Max-Age|Expires=/i)
    assert.match(tokenCookie, /HttpOnly/i)
    const session = await (await owner.request("/get-session")).json()
    assert.ok(new Date(session.session.expiresAt).getTime() - Date.now() <= 86_400_000)
  })

  await t.test("cross-origin mutations and unbound OAuth callbacks are rejected", async () => {
    const response = await owner.request("/sign-in/email", { email, password }, "https://evil.example")
    assert.equal(response.status, 403)
    const callback = await browser().request("/callback/google?code=test&state=forged")
    assert.ok(callback.status >= 300)
    assert.equal(callback.headers.getSetCookie().some((cookie) => cookie.startsWith("unda.session_token=")), false)
  })

  await t.test("Google login respects both remember choices and links verified same-email accounts", async () => {
    googleEmail = email
    const google = browser()
    const response = await googleLogin(google, false)
    assert.equal(response.status, 302)
    assert.equal(response.headers.get("location"), "/account")
    assert.doesNotMatch(response.headers.getSetCookie().find((cookie) => cookie.startsWith("unda.session_token="))!, /Max-Age|Expires=/i)
    const session = await (await google.request("/get-session")).json()
    assert.equal(session.user.id, ownerId)
    assert.ok(new Date(session.session.expiresAt).getTime() - Date.now() <= 86_400_000)
    await google.request("/sign-out", {})
    const remembered = await googleLogin(google, true)
    assert.match(remembered.headers.getSetCookie().find((cookie) => cookie.startsWith("unda.session_token="))!, /Max-Age=2592000/i)
  })

  await t.test("Google-only user adds a password with a one-use email link and keeps the same identity", async () => {
    googleEmail = "google-only@example.test"
    const google = browser()
    await googleLogin(google, true)
    const before = await (await google.request("/get-session")).json()
    assert.ok(before.user.id)
    await google.request("/request-password-reset", { email: googleEmail, redirectTo: "/reset-password" })
    const url = emailURL(googleEmail, "პაროლის")
    const callback = await google.request(url.pathname + url.search)
    const token = new URL(callback.headers.get("location")!, origin).searchParams.get("token")
    const changed = await google.request("/reset-password", { token, newPassword: password })
    assert.equal(changed.status, 200)
    assert.equal(await (await google.request("/get-session")).json(), null)
    assert.equal((await google.request("/reset-password", { token, newPassword: password })).status, 400)
    const login = await google.request("/sign-in/email", { email: googleEmail, password, rememberMe: false })
    assert.equal(login.status, 200)
    assert.equal((await login.json()).user.id, before.user.id)
    const accounts = await pool.query('SELECT "providerId" FROM auth_account WHERE "userId" = $1', [before.user.id])
    assert.deepEqual(accounts.rows.map((row) => row.providerId).sort(), ["credential", "google"])
  })

  await t.test("an unverified local account cannot be silently linked to Google", async () => {
    const client = browser()
    googleEmail = "unverified@example.test"
    await client.request("/sign-up/email", { name: "Unverified", email: googleEmail, password })
    const result = await googleLogin(client, true)
    assert.match(result.headers.get("location")!, /account_not_linked/)
    assert.equal(client.cookies.has("unda.session_token"), false)
  })

  await t.test("revoking other devices keeps only the requesting device signed in", async () => {
    const first = browser(), second = browser()
    await first.request("/sign-in/email", { email, password, rememberMe: true })
    await second.request("/sign-in/email", { email, password, rememberMe: true })
    assert.equal((await first.request("/revoke-other-sessions", {})).status, 200)
    assert.ok((await (await first.request("/get-session")).json()).user)
    assert.equal(await (await second.request("/get-session")).json(), null)
  })

  await t.test("expired reset links cannot change a password and recovery does not enumerate accounts", async () => {
    const client = browser()
    const real = await client.request("/request-password-reset", { email, redirectTo: "/reset-password" })
    const missing = await client.request("/request-password-reset", { email: "nobody@example.test", redirectTo: "/reset-password" })
    assert.equal(real.status, missing.status)
    assert.deepEqual(await real.json(), await missing.json())
    const link = emailURL(email, "პაროლის")
    const callback = await client.request(link.pathname + link.search)
    const token = new URL(callback.headers.get("location")!, origin).searchParams.get("token")
    await pool.query('UPDATE auth_verification SET "expiresAt" = now() - interval \'1 minute\' WHERE value = $1', [ownerId])
    assert.equal((await client.request("/reset-password", { token, newPassword: "changed test-only password" })).status, 400)
    assert.equal((await client.request("/sign-in/email", { email, password })).status, 200)
  })

  await t.test("login attempts are rate limited", async () => {
    const attacker = browser()
    let response: Response | undefined
    for (let index = 0; index < 6; index++) response = await attacker.request("/sign-in/email", { email: "missing@example.test", password })
    assert.equal(response!.status, 429)
  })

  await t.test("workspace creation is idempotent and stored brands cannot cross workspaces", async () => {
    const first = await ensurePersonalWorkspace(pool, ownerId)
    assert.deepEqual(await ensurePersonalWorkspace(pool, ownerId), first)
    const otherId = (await pool.query('SELECT id FROM auth_user WHERE email = $1', ["google-only@example.test"])).rows[0].id
    const second = await ensurePersonalWorkspace(pool, otherId)
    const ownStore = new PostgresIngestionStore(pool, first)
    const result = await createBrandOnboarding({ businessName: "Private brand", language: "ka", services: ["Content"] }, ownStore)
    assert.ok(await ownStore.loadBySnapshotId(result.snapshotId))
    assert.equal(await new PostgresIngestionStore(pool, second).loadBySnapshotId(result.snapshotId), undefined)
    const forged = new PostgresIngestionStore(pool, { workspaceId: first.workspaceId, userId: otherId })
    await assert.rejects(forged.loadBySnapshotId(result.snapshotId), /access denied/)
    await assert.rejects(createBrandOnboarding({ businessName: "Forged", language: "ka", services: ["Content"] }, forged), /access denied/)
  })
})
