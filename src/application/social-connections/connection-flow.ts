import type { ProviderBindingHealth, ProviderProfileRecord, SocialConnectionChannel, SocialConnectionsStore, SocialConnectionScope } from "./connection-store"

export type PageChoice = { readonly id: string; readonly name: string }
export type VerifiedConnection = ProviderBindingHealth & {
  readonly providerAccountRef: string
  readonly nativeAccountRef: string | null
  readonly channel: SocialConnectionChannel
  readonly username: string | null
  readonly displayName: string | null
  readonly profileUrl: string | null
}
export interface SocialConnectionProvider {
  ensureProfile(brandId: string): Promise<string>
  connectUrl(channel: SocialConnectionChannel, profileRef: string, callbackUrl: string): Promise<string>
  callback(channel: SocialConnectionChannel, profileRef: string, query: URLSearchParams): Promise<
    { readonly type: "selection"; readonly context: string; readonly pages: readonly PageChoice[] }
    | { readonly type: "connected"; readonly account: VerifiedConnection }>
  selectPage(profileRef: string, context: string, pageId: string): Promise<VerifiedConnection>
}
export type EncryptedConnectionContext = { readonly ciphertext: Buffer; readonly iv: Buffer; readonly tag: Buffer }
export interface ConnectionContextCipher {
  seal(value: string, intentId: string): EncryptedConnectionContext
  open(value: EncryptedConnectionContext, intentId: string): string
}
export type ConnectionIntent = {
  readonly id: string
  readonly provider: string
  readonly profileRef: string
  readonly channel: SocialConnectionChannel
  readonly digest: Buffer
  readonly step: "initiated" | "select_page" | "completed" | "failed"
  readonly pages: readonly PageChoice[]
  readonly context: EncryptedConnectionContext | null
  readonly expiresAt: Date
  readonly consumedAt: Date | null
}
export interface ConnectionFlowSession {
  readonly scope: SocialConnectionScope
  readonly accounts: SocialConnectionsStore
  readonly intent: ConnectionIntent | null
  profile(provider: string): Promise<ProviderProfileRecord | null>
  createIntent(input: Omit<ConnectionIntent, "step" | "pages" | "consumedAt">): Promise<void>
  select(pages: readonly PageChoice[], context: EncryptedConnectionContext): Promise<void>
  consume(step: "completed" | "failed"): Promise<void>
}
export interface SocialConnectionFlowStore {
  transaction<T>(ownerId: string, target: { brandId: string } | { intentId: string }, work: (session: ConnectionFlowSession) => Promise<T>): Promise<T>
}
export class ConnectionFlowError extends Error {
  constructor(readonly code: "invalidFlow" | "expired" | "providerRejected" | "accountMismatch" | "rateLimited" | "unavailable") {
    super(`Social connection failed: ${code}`)
    this.name = "ConnectionFlowError"
  }
}
