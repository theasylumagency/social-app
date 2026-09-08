import assert from "node:assert/strict"
import { randomBytes, randomUUID } from "node:crypto"
import { readdir, readFile } from "node:fs/promises"
import type { TestContext } from "node:test"
import { Pool } from "pg"
import { SocialConnectionService } from "../src/application/social-connections/service"
import { SocialProviderRegistry } from "../src/application/social-connections/provider-registry"
import { PostgresSocialConnectionFlowStore } from "../src/infrastructure/postgres/social-connection-flow-store"
import { PostgresSocialConnectionsStore } from "../src/infrastructure/postgres/social-connections-store"
import { ensurePersonalWorkspace } from "../src/infrastructure/postgres/workspace-store"
import { createZernioClient } from "../src/infrastructure/zernio/client"
import { createZernioConnectionProvider } from "../src/infrastructure/zernio/connect"
import { createConnectionContextCipher } from "../src/infrastructure/zernio/connection-context"
import { readZernioEnvironment } from "../src/infrastructure/zernio/environment"

export const origin = "http://localhost:3000"
export const userProfile = { id: "facebook-user", name: "User + 100% / ქართული", email: "private@example.test" }
export const secrets = ["temporary-facebook-secret", "connect-token-secret", "page-access-secret", "private@example.test"]

/** In-process transport fake: no live provider credentials or endpoints are used. */
export function fakeZernio() {
  const calls: { url: URL; method: string; headers: Headers; body: Record<string, unknown> | undefined }[] = []
  const profiles = new Map<string, string>()
  const state = {
    callback: "", pageId: "page-2", pages: [{ id: "page-1", name: "First Page", access_token: secrets[2] }, { id: "page-2", name: "Chosen Page", access_token: secrets[2] }],
    failPath: "", transform: (_url: URL, data: Record<string, unknown>): Record<string, unknown> => data,
  }
  const fetcher: typeof fetch = async (input, init) => {
    const url = new URL(String(input))
    const method = init?.method ?? "GET"
    const body = init?.body ? JSON.parse(String(init.body)) as Record<string, unknown> : undefined
    calls.push({ url, method, headers: new Headers(init?.headers), body })
    if (state.failPath === url.pathname) return Response.json({ secret: secrets[0] }, { status: 503 })
    let data: Record<string, unknown>
    const path = url.pathname.replace("/api/v1/", "")
    if (path === "profiles" && method === "GET") {
      const name = url.searchParams.get("name")!
      data = { profiles: profiles.has(name) ? [{ _id: profiles.get(name), name }] : [] }
    } else if (path === "profiles" && method === "POST") {
      const name = String(body!.name)
      const id = `profile-${profiles.size + 1}`
      profiles.set(name, id)
      data = { profile: { _id: id, name } }
    } else if (["connect/facebook", "connect/instagram"].includes(path)) {
      state.callback = url.searchParams.get("redirect_url")!
      data = { authUrl: `https://www.${path.endsWith("facebook") ? "facebook" : "instagram"}.com/oauth?redirect_uri=${encodeURIComponent(state.callback)}` }
    } else if (path === "connect/facebook/select-page" && method === "GET") data = { pages: state.pages }
    else if (path === "connect/facebook/select-page" && method === "POST") {
      state.pageId = String(body!.pageId)
      data = { account: { accountId: "account-facebook", platform: "facebook" } }
    } else if (path === "accounts") {
      const platform = url.searchParams.get("platform")!
      data = { accounts: [{ _id: `account-${platform}`, platform, profileId: { _id: url.searchParams.get("profileId") }, isActive: true,
        displayName: "Connected account", username: "test-brand", profileUrl: `https://www.${platform}.com/brand`, access_token: secrets[2] }] }
    } else if (/^accounts\/account-(facebook|instagram)\/health$/u.test(path)) {
      const platform = path.includes("facebook") ? "facebook" : "instagram"
      data = { accountId: `account-${platform}`, platform, status: "healthy", tokenStatus: { valid: true }, permissions: { canPost: true, canFetchAnalytics: true } }
    } else if (path === "accounts/account-facebook/facebook-page") data = { selectedPageId: state.pageId, pages: state.pages }
    else throw new Error(`Unexpected fixture endpoint: ${method} ${path}`)
    return Response.json(state.transform(url, data))
  }
  const client = createZernioClient(readZernioEnvironment({ NODE_ENV: "test", BETTER_AUTH_URL: origin, ZERNIO_API_KEY: "fixture-api-key" }), { fetch: fetcher })
  return { calls, profiles, state, provider: createZernioConnectionProvider(client, origin) }
}

export function facebookQuery(callback: string) {
  const query = new URL(callback).searchParams
  for (const [key, value] of Object.entries({ profileId: "profile-1", platform: "facebook", step: "select_page",
    tempToken: secrets[0]!, connect_token: secrets[1]!, userProfile: JSON.stringify(userProfile) })) query.set(key, value)
  return query
}
export function instagramQuery(callback: string) {
  const query = new URL(callback).searchParams
  query.set("profileId", "profile-1"); query.set("connected", "instagram"); query.set("accountId", "account-instagram")
  return query
}

export async function connectionFixture(t: TestContext) {
  assert.ok(process.env.DATABASE_URL, "DATABASE_URL is required; connection integration coverage must not be skipped")
  const admin = new Pool({ connectionString: process.env.DATABASE_URL })
  const schema = `connection_test_${randomUUID().replaceAll("-", "")}`
  assert.match(schema, /^connection_test_[a-f0-9]{32}$/u)
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
  const fake = fakeZernio()
  const cipher = createConnectionContextCipher(randomBytes(32).toString("base64"))
  const accounts = new PostgresSocialConnectionsStore(pool)
  const service = new SocialConnectionService(new PostgresSocialConnectionFlowStore(pool), new SocialProviderRegistry([["zernio", fake.provider]]), cipher, origin)
  const scope = { ownerId: "owner", brandId: "brand-owner" }
  const begin = async (channel: "facebook" | "instagram" = "facebook", accountId?: string) => {
    await service.begin(scope.ownerId, scope.brandId, channel, accountId)
    const query = channel === "facebook" ? facebookQuery(fake.state.callback) : instagramQuery(fake.state.callback)
    return { query, id: query.get("flow")!.split(".")[0]! }
  }
  const row = async (id: string) => (await pool.query("SELECT * FROM social_connection_intents WHERE id=$1", [id])).rows[0]!
  return { pool, fake, cipher, accounts, service, scope, begin, row }
}
