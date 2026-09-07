import { createHash, randomBytes, randomUUID, timingSafeEqual } from "node:crypto"
import type { SocialPublishingAccountId } from "../../blueprints/social/content-publish-eligibility"
import { ConnectionFlowError, type ConnectionContextCipher, type ConnectionFlowSession, type ConnectionIntent,
  type SocialConnectionFlowStore, type SocialConnectionProvider, type VerifiedConnection } from "./connection-flow"
import type { SocialConnectionChannel } from "./connection-store"
import type { SocialProviderRegistry } from "./provider-registry"

export const isConnectionIntentId = (value: string) => /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/iu.test(value)
const digest = (value: string) => createHash("sha256").update(value).digest()
type ContextEnvelope = { targetAccountId: string | null; providerContext: string | null }

export class SocialConnectionService {
  constructor(private readonly store: SocialConnectionFlowStore,
    private readonly providers: SocialProviderRegistry<SocialConnectionProvider>,
    private readonly cipher: ConnectionContextCipher, private readonly origin: string) {}

  async begin(ownerId: string, brandId: string, channel: SocialConnectionChannel, targetAccountId: string | null = null) {
    if (!["facebook", "instagram"].includes(channel) || !brandId || brandId.length > 160) throw new ConnectionFlowError("invalidFlow")
    return this.store.transaction(ownerId, { brandId }, async (session) => {
      if (targetAccountId && !(await session.accounts.listAccounts(session.scope)).some((a) => a.id === targetAccountId && a.channel === channel)) {
        throw new ConnectionFlowError("accountMismatch")
      }
      const provider = this.providers.resolve("zernio")
      let profile = await session.profile("zernio")
      if (!profile) profile = await session.accounts.saveProfile(session.scope, { id: `profile:${randomUUID()}`, provider: "zernio",
        providerProfileRef: await provider.ensureProfile(brandId) })
      if (profile.status !== "active") throw new ConnectionFlowError("unavailable")
      const id = randomUUID()
      const flow = `${id}.${randomBytes(32).toString("base64url")}`
      await session.createIntent({ id, provider: "zernio", profileRef: profile.providerProfileRef, channel, digest: digest(flow),
        expiresAt: new Date(Date.now() + 10 * 60_000), context: this.cipher.seal(JSON.stringify({ targetAccountId, providerContext: null }), id) })
      const callback = new URL("/api/social/connections/zernio/callback", this.origin)
      callback.searchParams.set("flow", flow)
      return { authUrl: await provider.connectUrl(channel, profile.providerProfileRef, callback.href) }
    })
  }

  private live(intent: ConnectionIntent | null, step: ConnectionIntent["step"]): asserts intent is ConnectionIntent {
    if (!intent) throw new ConnectionFlowError("invalidFlow")
    if (intent.expiresAt.getTime() <= Date.now()) throw new ConnectionFlowError("expired")
    if (intent.consumedAt || intent.step !== step) throw new ConnectionFlowError("invalidFlow")
  }

  private envelope(intent: ConnectionIntent): ContextEnvelope {
    if (!intent.context) throw new ConnectionFlowError("invalidFlow")
    try {
      const value = JSON.parse(this.cipher.open(intent.context, intent.id)) as ContextEnvelope
      if (!value || !(value.targetAccountId === null || typeof value.targetAccountId === "string")
        || !(value.providerContext === null || typeof value.providerContext === "string")) throw Error()
      return value
    } catch { throw new ConnectionFlowError("invalidFlow") }
  }

  private async bind(session: ConnectionFlowSession, verified: VerifiedConnection, targetAccountId: string | null) {
    const intent = session.intent!
    if (verified.channel !== intent.channel) throw new ConnectionFlowError("accountMismatch")
    const accounts = await session.accounts.listAccounts(session.scope)
    let match = accounts.find((a) => a.channel === verified.channel && verified.nativeAccountRef !== null && a.nativeAccountRef === verified.nativeAccountRef)
    // The provider reference is a secondary reconnect lookup, never canonical identity.
    for (const account of accounts.filter((a) => a.channel === verified.channel)) {
      const bindings = await session.accounts.listBindings(session.scope, account.id)
      if (bindings.some((b) => b.provider === intent.provider && b.providerAccountRef === verified.providerAccountRef)) {
        if (match && match.id !== account.id) throw new ConnectionFlowError("accountMismatch")
        match = account
      }
    }
    if (targetAccountId && match?.id !== targetAccountId) throw new ConnectionFlowError("accountMismatch")
    if (match?.nativeAccountRef && verified.nativeAccountRef && match.nativeAccountRef !== verified.nativeAccountRef) throw new ConnectionFlowError("accountMismatch")
    const id = match?.id ?? `social-account:${randomUUID()}` as SocialPublishingAccountId
    const saved = await session.accounts.saveAccount(session.scope, { id, channel: verified.channel,
      nativeAccountRef: verified.nativeAccountRef ?? match?.nativeAccountRef ?? null, username: verified.username,
      displayName: verified.displayName, profileUrl: verified.profileUrl })
    const bindings = await session.accounts.listBindings(session.scope, id)
    const active = bindings.find((b) => b.bindingStatus === "active")
    if (active?.provider === intent.provider && active.providerAccountRef === verified.providerAccountRef) {
      if (active.providerProfileRef !== intent.profileRef) throw new ConnectionFlowError("accountMismatch")
      await session.accounts.updateBindingHealth(session.scope, active.id, verified)
    } else {
      await session.accounts.activateBinding(session.scope, { ...verified, id: `social-binding:${randomUUID()}`, publishingAccountId: id,
        provider: intent.provider, providerProfileRef: intent.profileRef, expectedActiveBindingId: active?.id ?? null,
        verifiedNativeAccountRef: verified.nativeAccountRef })
    }
    await session.consume("completed")
    return { type: "connected" as const, brandId: saved.brandId }
  }

  async callback(ownerId: string, query: URLSearchParams) {
    const flow = query.get("flow") ?? ""
    const id = flow.split(".")[0] ?? ""
    if (!isConnectionIntentId(id) || !/^[a-f0-9-]{36}\.[A-Za-z0-9_-]{43}$/iu.test(flow)) throw new ConnectionFlowError("invalidFlow")
    let verifiedState = false
    try {
      return await this.store.transaction(ownerId, { intentId: id }, async (session) => {
        this.live(session.intent, "initiated")
        if (!timingSafeEqual(session.intent.digest, digest(flow))) throw new ConnectionFlowError("invalidFlow")
        verifiedState = true
        const context = this.envelope(session.intent)
        const result = await this.providers.resolve(session.intent.provider).callback(session.intent.channel, session.intent.profileRef, query)
        if (result.type === "connected") return this.bind(session, result.account, context.targetAccountId)
        if (session.intent.channel !== "facebook") throw new ConnectionFlowError("invalidFlow")
        await session.select(result.pages, this.cipher.seal(JSON.stringify({ ...context, providerContext: result.context }), id))
        return { type: "selection" as const, intentId: id, brandId: session.scope.brandId }
      })
    } catch (error) {
      if (verifiedState) await this.fail(ownerId, id)
      throw error
    }
  }

  async pages(ownerId: string, intentId: string) {
    if (!isConnectionIntentId(intentId)) throw new ConnectionFlowError("invalidFlow")
    return this.store.transaction(ownerId, { intentId }, async (session) => {
      this.live(session.intent, "select_page")
      return { intentId, brandId: session.scope.brandId, pages: session.intent.pages }
    })
  }

  async selectPage(ownerId: string, intentId: string, pageId: string) {
    if (!isConnectionIntentId(intentId)) throw new ConnectionFlowError("invalidFlow")
    let accepted = false
    try {
      return await this.store.transaction(ownerId, { intentId }, async (session) => {
        this.live(session.intent, "select_page")
        if (!session.intent.pages.some((p) => p.id === pageId)) throw new ConnectionFlowError("invalidFlow")
        accepted = true
        const context = this.envelope(session.intent)
        if (!context.providerContext) throw new ConnectionFlowError("invalidFlow")
        const account = await this.providers.resolve(session.intent.provider).selectPage(session.intent.profileRef, context.providerContext, pageId)
        return this.bind(session, account, context.targetAccountId)
      })
    } catch (error) {
      if (accepted) await this.fail(ownerId, intentId)
      throw error
    }
  }

  private async fail(ownerId: string, intentId: string) {
    await this.store.transaction(ownerId, { intentId }, async (session) => {
      if (session.intent && !session.intent.consumedAt) await session.consume("failed")
    })
  }
}
