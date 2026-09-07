import { createHash } from "node:crypto"
import { ConnectionFlowError, type PageChoice, type SocialConnectionProvider, type VerifiedConnection } from "../../application/social-connections/connection-flow"
import type { SocialConnectionChannel } from "../../application/social-connections/connection-store"
import { ZernioClientError, type createZernioClient } from "./client"

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new ConnectionFlowError("providerRejected")
  return value as Record<string, unknown>
}
function text(value: unknown, max = 8000): string {
  if (typeof value !== "string" || !value.trim() || value.length > max) throw new ConnectionFlowError("providerRejected")
  return value
}
function ref(value: unknown): string {
  const result = typeof value === "object" && value !== null ? record(value)._id : value
  const id = text(result, 160)
  if (!/^[A-Za-z0-9_-]+$/u.test(id)) throw new ConnectionFlowError("providerRejected")
  return id
}
type FacebookContext = { tempToken: string; connectToken: string; userProfile: Record<string, unknown> }

/** All Zernio response shapes and temporary credential handling stay in infrastructure. */
export function createZernioConnectionProvider(client: ReturnType<typeof createZernioClient>): SocialConnectionProvider {
  const request = async (input: Parameters<typeof client.request>[0]) => record((await client.request(input)).data)
  const verify = async (channel: SocialConnectionChannel, profileRef: string, accountRef: string, selectedPage?: string): Promise<VerifiedConnection> => {
    const result = await request({ method: "GET", path: "accounts", query: { profileId: profileRef, platform: channel } })
    if (!Array.isArray(result.accounts)) throw new ConnectionFlowError("providerRejected")
    const account = result.accounts.map(record).find((a) => a._id === accountRef)
    if (!account || account.platform !== channel || ref(account.profileId) !== profileRef || account.isActive !== true) throw new ConnectionFlowError("accountMismatch")
    const health = await request({ method: "GET", path: `accounts/${ref(accountRef)}/health` })
    if (health.accountId !== accountRef || health.platform !== channel || record(health.tokenStatus).valid !== true) throw new ConnectionFlowError("accountMismatch")
    const permissions = record(health.permissions)
    if (typeof permissions.canPost !== "boolean" || typeof permissions.canFetchAnalytics !== "boolean") throw new ConnectionFlowError("providerRejected")
    let nativeAccountRef: string | null = null
    if (channel === "facebook") {
      const page = await request({ method: "GET", path: `accounts/${ref(accountRef)}/facebook-page` })
      nativeAccountRef = ref(page.selectedPageId)
      if (!selectedPage || nativeAccountRef !== selectedPage) throw new ConnectionFlowError("accountMismatch")
    }
    // The account-list contract does not promise a native Instagram ID. Never
    // substitute Zernio's _id or a username; reconnect uses the verified binding.
    let profileUrl: string | null = null
    if (typeof account.profileUrl === "string") {
      try { const url = new URL(account.profileUrl); if (url.protocol === "https:" && !url.username && !url.password) profileUrl = url.href } catch { /* Optional display metadata. */ }
    }
    return { channel, providerAccountRef: accountRef, nativeAccountRef, username: typeof account.username === "string" ? account.username.slice(0, 200) : null,
      displayName: typeof account.displayName === "string" ? account.displayName.slice(0, 200) : null, profileUrl,
      connectionStatus: "connected", canPublish: permissions.canPost, canFetchAnalytics: permissions.canFetchAnalytics,
      capabilities: { publish: permissions.canPost, analytics: permissions.canFetchAnalytics } }
  }
  return {
    async ensureProfile(brandId) {
      const identity = createHash("sha256").update(brandId).digest("hex")
      const name = `UNDA ${identity}`
      const lookup = async () => {
        const data = await request({ method: "GET", path: "profiles", query: { name, includeOverLimit: "true" } })
        if (!Array.isArray(data.profiles)) throw new ConnectionFlowError("providerRejected")
        const profiles = data.profiles.map(record).filter((p) => p.name === name)
        if (profiles.length > 1) throw new ConnectionFlowError("providerRejected")
        return profiles[0] ? ref(profiles[0]._id) : null
      }
      const existing = await lookup()
      if (existing) return existing
      try {
        const result = await request({ method: "POST", path: "profiles", idempotencyKey: `unda-profile-${identity}`, body: { name } })
        const profile = record(result.profile)
        if (profile.name !== name) throw new ConnectionFlowError("providerRejected")
        return ref(profile._id)
      } catch (error) {
        if (error instanceof ZernioClientError && error.status === 409) { const found = await lookup(); if (found) return found }
        throw error
      }
    },
    async connectUrl(channel, profileRef, callbackUrl) {
      const data = await request({ method: "GET", path: `connect/${channel}`, query: { profileId: profileRef, redirect_url: callbackUrl,
        ...(channel === "facebook" ? { headless: "true" } : { loginMethod: "instagram_login" }) } })
      let url: URL
      try { url = new URL(text(data.authUrl)) } catch { throw new ConnectionFlowError("providerRejected") }
      if (url.protocol !== "https:" || url.username || url.password
        || !["facebook.com", "www.facebook.com", "m.facebook.com", "instagram.com", "www.instagram.com", "zernio.com"].includes(url.hostname)) throw new ConnectionFlowError("providerRejected")
      return url.href
    },
    async callback(channel, profileRef, query) {
      if (query.has("error")) throw new ConnectionFlowError("providerRejected")
      if (query.get("profileId") !== profileRef) throw new ConnectionFlowError("accountMismatch")
      if (channel === "instagram") {
        if (query.get("connected") !== "instagram" || query.has("step")) throw new ConnectionFlowError("accountMismatch")
        return { type: "connected", account: await verify(channel, profileRef, ref(query.get("accountId"))) }
      }
      if (query.get("platform") !== "facebook" || query.get("step") !== "select_page") throw new ConnectionFlowError("accountMismatch")
      let userProfile: Record<string, unknown>
      // URLSearchParams already decodes the callback once. Do not double-decode.
      try { userProfile = record(JSON.parse(text(query.get("userProfile")))) } catch { throw new ConnectionFlowError("providerRejected") }
      ref(userProfile.id)
      const context: FacebookContext = { userProfile, tempToken: text(query.get("tempToken")), connectToken: text(query.get("connect_token")) }
      const data = await request({ method: "GET", path: "connect/facebook/select-page", query: { profileId: profileRef, tempToken: context.tempToken }, connectToken: context.connectToken })
      if (!Array.isArray(data.pages) || data.pages.length > 1000) throw new ConnectionFlowError("providerRejected")
      const pages: PageChoice[] = data.pages.map((value) => { const p = record(value); return { id: ref(p.id), name: text(p.name, 300) } })
      if (new Set(pages.map((p) => p.id)).size !== pages.length) throw new ConnectionFlowError("providerRejected")
      return { type: "selection", pages, context: JSON.stringify(context) }
    },
    async selectPage(profileRef, sealedContext, pageId) {
      const context = record(JSON.parse(sealedContext))
      const data = await request({ method: "POST", path: "connect/facebook/select-page", connectToken: text(context.connectToken),
        body: { profileId: profileRef, pageId, tempToken: text(context.tempToken), userProfile: record(context.userProfile) } })
      const selected = record(data.account)
      if (selected.platform !== "facebook") throw new ConnectionFlowError("accountMismatch")
      return verify("facebook", profileRef, ref(selected.accountId), pageId)
    },
  }
}
