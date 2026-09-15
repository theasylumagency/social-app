import "server-only"
import type { Pool } from "pg"
import { loadDeliverySnapshot, type DeliveryPolicy } from "../../application/publishing/delivery-view"
import { readDeliveryRecords } from "../../infrastructure/postgres/delivery-view-store"
import { readZernioEnvironment } from "../../infrastructure/zernio/environment"

export function readDeliveryView(pool: Pool, scope: { ownerId: string; brandId: string }) {
  let policy: DeliveryPolicy | null = null
  try {
    const env = readZernioEnvironment()
    policy = { enabled: env.publishingEnabled, maxAttempts: env.publishMaxAttempts, graceMs: env.publishAttemptGraceSeconds * 1000 }
  } catch { /* Invalid configuration must not imply an enabled publishing service. */ }
  return loadDeliverySnapshot(() => readDeliveryRecords(pool, scope), policy, new Date().toISOString())
}
