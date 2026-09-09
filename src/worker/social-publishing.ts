import type { Pool } from "pg"
import { createIsoDateTime } from "../core/domain/primitives"
import { runSocialPublishQueue, recoverOrphanedPublishAttempts, pollUnknownPublishOutcomes } from "../application/publishing"
import { PostgresPublicationAssetSource, PostgresSocialPublicationStore, PostgresSocialPublishStore,
  PostgresSocialReconciliationStore } from "../infrastructure/postgres"
import { createZernioClient } from "../infrastructure/zernio/client"
import { createZernioMediaUploader } from "../infrastructure/zernio/media"
import { createZernioPublisher } from "../infrastructure/zernio/publisher"
import { createZernioReconciler } from "../infrastructure/zernio/reconciliation"
import type { ZernioEnvironment } from "../infrastructure/zernio/environment"

export async function runSocialPublishingTick(pool: Pool, environment: ZernioEnvironment) {
  if (!environment.publishingEnabled) return { status: "disabled" as const }
  const client = createZernioClient(environment)
  const attempts = new PostgresSocialPublishStore(pool)
  const reconciliations = new PostgresSocialReconciliationStore(pool)
  const now = () => createIsoDateTime(new Date().toISOString())
  const publisher = createZernioPublisher({ client, journal: attempts, assets: new PostgresPublicationAssetSource(pool),
    media: createZernioMediaUploader(client), now })
  const results = await Promise.allSettled([
    runSocialPublishQueue({ publications: new PostgresSocialPublicationStore(pool), attempts,
      publisherFor: (provider) => { if (provider !== "zernio") throw new Error(`Unsupported social provider: ${provider}`); return publisher },
      now, maxAttempts: environment.publishMaxAttempts, unresolvedAttemptGraceMs: environment.publishAttemptGraceSeconds * 1000 }),
    recoverOrphanedPublishAttempts({ reconciliations, publishes: attempts, now,
      graceMs: environment.publishAttemptGraceSeconds * 1000 }),
    pollUnknownPublishOutcomes({ provider: "zernio", store: reconciliations, reconcile: createZernioReconciler(client), now,
      retryPolicy: { maxAttempts: environment.publishMaxAttempts } }),
  ])
  return { status: "ran" as const, results }
}
