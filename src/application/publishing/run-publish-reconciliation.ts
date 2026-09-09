import type {
  SocialContentPublishReconciliationOutcome,
  SocialContentPublishRetryPolicy,
} from "../../blueprints/social"
import {
  assembleSocialContentPublishReconciliation,
  assembleSocialContentPublishResult,
  resolveSocialContentPublishReconciliationDecision,
} from "../../blueprints/social"
import { createIsoDateTime, type IsoDateTime } from "../../core/domain"
import type { SocialContentPublishStore } from "./publish-store"
import type { PublishReconciliationCorrelation, SocialPublishReconciliationStore } from "./reconciliation-store"

export type SocialContentPublishReconciler = (
  correlation: PublishReconciliationCorrelation,
) => Promise<SocialContentPublishReconciliationOutcome>

export async function reconcileSocialContentPublish(input: {
  readonly correlation: PublishReconciliationCorrelation
  readonly outcome: SocialContentPublishReconciliationOutcome
  readonly reconciliationId: string
  readonly checkedAt: IsoDateTime
  readonly retryPolicy: SocialContentPublishRetryPolicy
}, store: SocialPublishReconciliationStore) {
  if (input.correlation.result?.status !== "unknownOutcome") throw new Error("Reconciliation requires an unknown publish result")
  const reconciliation = assembleSocialContentPublishReconciliation({
    id: input.reconciliationId as Parameters<typeof assembleSocialContentPublishReconciliation>[0]["id"],
    attempt: input.correlation.attempt,
    unknownResult: input.correlation.result,
    outcome: input.outcome,
    checkedAt: input.checkedAt,
  })
  const persisted = await store.append(reconciliation)
  return { reconciliation, persisted, decision: resolveSocialContentPublishReconciliationDecision({
    attempt: input.correlation.attempt, reconciliation, policy: input.retryPolicy,
  }) }
}

/** Records durable outcomes for attempts whose owner died before a result was written. */
export async function recoverOrphanedPublishAttempts(deps: {
  readonly reconciliations: SocialPublishReconciliationStore
  readonly publishes: SocialContentPublishStore
  readonly now: () => IsoDateTime
  readonly graceMs: number
  readonly limit?: number
}) {
  if (!Number.isSafeInteger(deps.graceMs) || deps.graceMs < 1) throw new Error("Orphan grace must be a positive safe integer")
  const now = deps.now()
  const cutoff = new Date(Date.parse(now) - deps.graceMs)
  const candidates = await deps.reconciliations.findOrphaned(cutoff, deps.limit ?? 50)
  let recorded = 0
  for (const candidate of candidates) {
    const afterDispatch = candidate.request.dispatchStartedAt !== null
    const result = assembleSocialContentPublishResult({
      id: `orphan:${candidate.attempt.id}` as Parameters<typeof assembleSocialContentPublishResult>[0]["id"],
      attempt: candidate.attempt,
      outcome: afterDispatch
        ? { status: "unknownOutcome", errorCode: "providerResponseMissing" }
        : { status: "retryableFailure", errorCode: "providerRequestNotDispatched" },
      recordedAt: createIsoDateTime(new Date(Math.max(Date.parse(now), Date.parse(candidate.attempt.attemptedAt))).toISOString()),
    })
    await deps.publishes.recordResult(result)
    recorded += 1
  }
  return { inspected: candidates.length, recorded }
}

export async function pollUnknownPublishOutcomes(deps: {
  readonly provider: string
  readonly store: SocialPublishReconciliationStore
  readonly reconcile: SocialContentPublishReconciler
  readonly now: () => IsoDateTime
  readonly retryPolicy: SocialContentPublishRetryPolicy
  readonly limit?: number
}) {
  const candidates = await deps.store.findUnknown(deps.provider, deps.limit ?? 50)
  let reconciled = 0
  const failures: string[] = []
  for (const candidate of candidates) {
    try {
      const checkedAt = deps.now()
      const outcome = await deps.reconcile(candidate)
      await reconcileSocialContentPublish({ correlation: candidate, outcome,
        reconciliationId: `poll:${candidate.attempt.id}:${checkedAt}`, checkedAt, retryPolicy: deps.retryPolicy }, deps.store)
      reconciled += 1
    } catch { failures.push(candidate.attempt.id) }
  }
  return { inspected: candidates.length, reconciled, failures }
}
