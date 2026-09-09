import type { SocialContentPublishRetryPolicy } from "../../blueprints/social"
import type { IsoDateTime } from "../../core/domain"
import type { ProviderWebhookStore } from "./webhook-store"
import type { SocialPublishReconciliationStore } from "./reconciliation-store"
import { reconcileSocialContentPublish } from "./run-publish-reconciliation"

export type ProviderWebhookInterpretation =
  | { readonly type: "ignored" }
  | { readonly type: "account"; readonly connected: boolean; readonly providerAccountRef: string }
  | { readonly type: "analytics"; readonly providerProfileRef: string | null }
  | { readonly type: "reconciliation"; readonly lookup: { readonly provider: string; readonly providerPublicationRef?: string; readonly attemptId?: string };
      readonly providerAccountRef: string; readonly channel: "facebook" | "instagram";
      readonly outcome: Parameters<typeof reconcileSocialContentPublish>[0]["outcome"] }

export async function processNextProviderWebhook(deps: {
  readonly inbox: ProviderWebhookStore
  readonly reconciliations: SocialPublishReconciliationStore
  readonly interpret: (provider: string, payload: Readonly<Record<string, unknown>>) => ProviderWebhookInterpretation
  readonly now: () => IsoDateTime
  readonly retryPolicy: SocialContentPublishRetryPolicy
  readonly handleAccount: (provider: string, providerAccountRef: string, connected: boolean) => Promise<void>
  readonly handleAnalytics: (provider: string, providerProfileRef: string | null) => Promise<void>
  readonly leaseMs?: number
  readonly maxAttempts?: number
}) {
  const event = await deps.inbox.claim(new Date(deps.now()), deps.leaseMs ?? 30_000)
  if (!event) return { status: "idle" as const }
  try {
    const notification = deps.interpret(event.provider, event.payload)
    if (notification.type === "ignored") await deps.inbox.complete(event, "ignored")
    else if (notification.type === "account") {
      // The handler must refetch provider health. Webhook state is only a trigger.
      await deps.handleAccount(event.provider, notification.providerAccountRef, notification.connected)
      await deps.inbox.complete(event, "processed")
    } else if (notification.type === "analytics") {
      await deps.handleAnalytics(event.provider, notification.providerProfileRef)
      await deps.inbox.complete(event, "processed")
    } else {
      const correlation = await deps.reconciliations.findCorrelation(notification.lookup)
      if (!correlation || correlation.result === null) throw new Error("providerEventOutOfOrder")
      if (correlation.result.status !== "unknownOutcome") await deps.inbox.complete(event, "ignored")
      else {
        if (correlation.request.providerAccountRef !== notification.providerAccountRef || correlation.request.channel !== notification.channel) {
          throw new Error("providerEventScopeMismatch")
        }
        await reconcileSocialContentPublish({ correlation, outcome: notification.outcome,
          reconciliationId: `webhook:${event.provider}:${event.eventId}`, checkedAt: deps.now(), retryPolicy: deps.retryPolicy }, deps.reconciliations)
        await deps.inbox.complete(event, "processed")
      }
    }
    return { status: "processed" as const, eventId: event.eventId }
  } catch (error) {
    const code = error instanceof Error && ["providerEventOutOfOrder", "providerEventScopeMismatch"].includes(error.message)
      ? error.message : "providerWebhookProcessingFailed"
    const delay = Math.min(300_000, 1_000 * 2 ** Math.min(event.processingAttempts - 1, 8))
    await deps.inbox.retry(event, new Date(Date.parse(deps.now()) + delay), code, deps.maxAttempts ?? 8)
    return { status: "retryScheduled" as const, eventId: event.eventId, errorCode: code }
  }
}
