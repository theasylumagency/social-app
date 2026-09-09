import type { Pool } from "pg"
import { createIsoDateTime } from "../core/domain/primitives"
import { processNextProviderWebhook } from "../application/publishing/process-provider-webhooks"
import { PostgresSocialReconciliationStore, PostgresSocialWebhookStore } from "../infrastructure/postgres"
import { interpretZernioWebhook } from "../infrastructure/zernio/webhooks"
import { createZernioClient } from "../infrastructure/zernio/client"
import { readZernioAccountHealth } from "../infrastructure/zernio/accounts"
import type { ZernioEnvironment } from "../infrastructure/zernio/environment"

export async function runSocialWebhookTick(pool: Pool, environment: ZernioEnvironment, handleAnalytics: (profile: string | null) => Promise<void> = async () => {}) {
  if (!environment.publishingEnabled) return { status: "disabled" as const }
  const client = createZernioClient(environment)
  return processNextProviderWebhook({ inbox: new PostgresSocialWebhookStore(pool), reconciliations: new PostgresSocialReconciliationStore(pool),
    interpret: (provider, payload) => { if (provider !== "zernio") return { type: "ignored" }; return interpretZernioWebhook(payload) },
    now: () => createIsoDateTime(new Date().toISOString()), retryPolicy: { maxAttempts: environment.publishMaxAttempts },
    handleAccount: async (provider, providerAccountRef) => {
      if (provider !== "zernio") return
      const health = await readZernioAccountHealth(client, providerAccountRef)
      const result = await pool.query<{ id: string }>(`UPDATE social_provider_account_bindings SET connection_status=$2,can_publish=$3,
        can_fetch_analytics=$4,capabilities=$5::jsonb,health_checked_at=now(),updated_at=now(),
        connected_at=CASE WHEN $2='connected' AND connection_status<>'connected' THEN now() ELSE connected_at END,
        disconnected_at=CASE WHEN $2='disconnected' AND connection_status<>'disconnected' THEN now() ELSE disconnected_at END
        WHERE provider='zernio' AND provider_account_ref=$1 AND binding_status='active' RETURNING id`,
      [providerAccountRef, health.connectionStatus, health.canPublish, health.canFetchAnalytics, JSON.stringify(health.capabilities)])
      if (!result.rowCount) throw new Error("Provider account binding not found")
    },
    handleAnalytics: async (provider, profile) => { if (provider === "zernio") await handleAnalytics(profile) },
  })
}
