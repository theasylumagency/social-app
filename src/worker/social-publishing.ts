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

export function socialPublishingTasks(pool: Pool, environment: ZernioEnvironment) {
  const disabled = async () => ({ status: "disabled" as const })
  if (!environment.publishingEnabled) return { publish: disabled, recover: disabled, reconcile: disabled }
  const client = createZernioClient(environment)
  const attempts = new PostgresSocialPublishStore(pool)
  const reconciliations = new PostgresSocialReconciliationStore(pool)
  const now = () => createIsoDateTime(new Date().toISOString())
  const publisher = createZernioPublisher({ client, journal: attempts, assets: new PostgresPublicationAssetSource(pool),
    media: createZernioMediaUploader(client), now })
  return {
    publish: () => runSocialPublishQueue({ publications: new PostgresSocialPublicationStore(pool), attempts,
      publisherFor: (provider) => { if (provider !== "zernio") throw new Error(`Unsupported social provider: ${provider}`); return publisher },
      now, maxAttempts: environment.publishMaxAttempts, unresolvedAttemptGraceMs: environment.publishAttemptGraceSeconds * 1000 }),
    recover: () => recoverOrphanedPublishAttempts({ reconciliations, publishes: attempts, now,
      graceMs: environment.publishAttemptGraceSeconds * 1000 }),
    reconcile: () => pollUnknownPublishOutcomes({ provider: "zernio", store: reconciliations, reconcile: createZernioReconciler(client), now,
      retryPolicy: { maxAttempts: environment.publishMaxAttempts } }),
  }
}

/** Backwards-compatible one-shot entry; the daemon runs these tasks on independent loops. */
export async function runSocialPublishingTick(pool: Pool, environment: ZernioEnvironment) {
  if (!environment.publishingEnabled) return { status: "disabled" as const }
  const tasks = socialPublishingTasks(pool, environment)
  const results = await Promise.allSettled([tasks.publish(), tasks.recover(), tasks.reconcile()])
  return { status: "ran" as const, results }
}
