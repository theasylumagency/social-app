import type { SocialPublishingAccount, SocialPublishingAccountId } from "../../blueprints/social/content-publish-eligibility"
import type { SOCIAL_CHANNELS } from "../../blueprints/social/tokens"

export type SocialConnectionChannel = keyof typeof SOCIAL_CHANNELS
export type SocialConnectionScope = { readonly ownerId: string; readonly brandId: string }

export type PublishingAccountRecord = {
  readonly id: SocialPublishingAccountId
  readonly brandId: string
  readonly channel: SocialConnectionChannel
  /** Verified native platform identity, never an intermediary's account ID. */
  readonly nativeAccountRef: string | null
  readonly username: string | null
  readonly displayName: string | null
  readonly profileUrl: string | null
}

export type ProviderProfileRecord = {
  readonly id: string
  readonly brandId: string
  readonly provider: string
  readonly providerProfileRef: string
  readonly status: "active" | "disabled" | "error"
}

export type ProviderBindingHealth = {
  readonly connectionStatus: "connected" | "disconnected" | "error"
  readonly canPublish: boolean
  readonly canFetchAnalytics: boolean
  /** Allowlisted capability names/booleans only; not a raw provider response. */
  readonly capabilities: Readonly<Record<string, boolean>>
}

export type ProviderAccountBinding = ProviderBindingHealth & {
  readonly id: string
  readonly publishingAccountId: SocialPublishingAccountId
  readonly channel: SocialConnectionChannel
  readonly provider: string
  readonly providerProfileRef: string
  readonly providerAccountRef: string
  readonly bindingStatus: "active" | "retired"
}

export type ActivateProviderBindingInput = Omit<ProviderAccountBinding, "bindingStatus"> & {
  /** Compare-and-swap token. Null means this is the account's first binding. */
  readonly expectedActiveBindingId: string | null
  /** Obtained from verified provider identity; required to replace a binding. */
  readonly verifiedNativeAccountRef: string | null
}

export interface SocialConnectionsStore {
  saveProfile(scope: SocialConnectionScope, profile: Omit<ProviderProfileRecord, "brandId" | "status">): Promise<ProviderProfileRecord>
  saveAccount(scope: SocialConnectionScope, account: Omit<PublishingAccountRecord, "brandId">): Promise<PublishingAccountRecord>
  listAccounts(scope: SocialConnectionScope): Promise<readonly PublishingAccountRecord[]>
  listBindings(scope: SocialConnectionScope, accountId: SocialPublishingAccountId): Promise<readonly ProviderAccountBinding[]>
  activateBinding(scope: SocialConnectionScope, input: ActivateProviderBindingInput): Promise<ProviderAccountBinding>
  updateBindingHealth(scope: SocialConnectionScope, bindingId: string, health: ProviderBindingHealth): Promise<void>
  resolveAccount(scope: SocialConnectionScope, accountId: SocialPublishingAccountId): Promise<{
    readonly account: SocialPublishingAccount
    readonly binding: ProviderAccountBinding
  } | null>
}

export class SocialConnectionConflict extends Error {
  constructor(message: string) { super(message); this.name = "SocialConnectionConflict" }
}
