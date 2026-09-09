import type { ProviderBindingHealth } from "../../application/social-connections/connection-store"
import type { createZernioClient } from "./client"

const object = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid Zernio account response")
  return value as Record<string, unknown>
}

/** Refetches provider state; webhook claims are never trusted as account truth. */
export async function readZernioAccountHealth(client: ReturnType<typeof createZernioClient>, accountRef: string): Promise<ProviderBindingHealth> {
  if (!/^[A-Za-z0-9_-]{1,160}$/u.test(accountRef)) throw new Error("Invalid Zernio account reference")
  const data = object((await client.request({ method: "GET", path: `accounts/${accountRef}/health` })).data)
  const token = object(data.tokenStatus)
  const permissions = object(data.permissions)
  if (typeof permissions.canPost !== "boolean" || typeof permissions.canFetchAnalytics !== "boolean" || typeof token.valid !== "boolean") {
    throw new Error("Invalid Zernio account health")
  }
  const healthy = token.valid && (data.status === "healthy" || data.status === "warning")
  return { connectionStatus: healthy ? "connected" : "disconnected", canPublish: healthy && permissions.canPost,
    canFetchAnalytics: healthy && permissions.canFetchAnalytics,
    capabilities: { publish: healthy && permissions.canPost, analytics: healthy && permissions.canFetchAnalytics } }
}
