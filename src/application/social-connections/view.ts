import type { SocialConnectionChannel, SocialConnectionsStore, SocialConnectionScope } from "./connection-store"

export type ConnectionAccountView = { id: string; channel: SocialConnectionChannel; name: string; connected: boolean; canPublish: boolean; canFetchAnalytics: boolean }

/** Only display fields cross the server/client boundary. */
export async function readConnectionAccounts(store: SocialConnectionsStore, scope: SocialConnectionScope): Promise<ConnectionAccountView[]> {
  const accounts = await store.listAccounts(scope)
  return Promise.all(accounts.map(async (account) => {
    const resolved = await store.resolveAccount(scope, account.id)
    return { id: account.id, channel: account.channel, name: account.displayName ?? account.username ?? account.channel,
      connected: resolved?.binding.connectionStatus === "connected", canPublish: resolved?.account.connected ?? false,
      canFetchAnalytics: resolved?.binding.canFetchAnalytics ?? false }
  }))
}
