import type { ProviderRequestState } from "./delivery-store"
import type { SocialContentPublishResult } from "../../blueprints/social/content-publish-result"
import type { SocialContentPublishReconciliationOutcome } from "../../blueprints/social/content-publish-reconciliation"

export type DeliveryAttempt = {
  number: number; attemptedAt: string; requestState: ProviderRequestState | null
  result: SocialContentPublishResult["status"] | null; recordedAt: string | null; retryAfter: string | null
  publishedAt: string | null; reconciliation: SocialContentPublishReconciliationOutcome["status"] | null
  reconciledAt: string | null; reconciledPublishedAt: string | null; failureType: "retryable" | "permanent" | null
}
export type DeliveryRecord = {
  id: string; week: string; runId: string; version: number; postKey: string; channel: "facebook" | "instagram"
  accountName: string; publishAt: string; cancelled: boolean; canPublish: boolean; attempts: DeliveryAttempt[]
}
export type DeliveryPolicy = { enabled: boolean; maxAttempts: number; graceMs: number }
export type DeliveryState = "published" | "cancelled" | "scheduled" | "queued" | "sending" | "retrying" | "confirming" | "unconfirmed" | "failed" | "delayed" | "disconnected" | "disabled" | "unavailable"
export type DeliveryItem = Omit<DeliveryRecord, "attempts" | "canPublish"> & {
  state: DeliveryState; attention: boolean; unresolvedAttempt: boolean; publishedAt: string | null; lastActivityAt: string | null; attempts: number
}
export type DeliverySnapshot = { availability: "available"; checkedAt: string; publishingEnabled: boolean | null; items: DeliveryItem[] }
  | { availability: "unavailable"; checkedAt: string }

const attentionStates = new Set<DeliveryState>(["unconfirmed", "failed", "delayed", "disconnected", "disabled", "unavailable"])

/** Observation only: never retries, dispatches, or grants publishing authority. */
export function deliveryItem(record: DeliveryRecord, policy: DeliveryPolicy | null, now: string): DeliveryItem {
  const attempts = [...record.attempts].sort((a, b) => b.number - a.number)
  const latest = attempts[0]
  const published = attempts.find((a) => a.reconciliation === "publicationFound" || a.result === "published")
  const unresolved = attempts.find((a) => (!a.reconciliation || a.reconciliation === "inconclusive") &&
    (a.result === "unknownOutcome" || (!a.result && (a.requestState === "dispatchStarted" || a.requestState === "responseReceived"))))
  const age = (date: string) => Date.parse(now) - Date.parse(date)
  const late = (date: string) => policy !== null && age(date) > policy.graceMs
  let state: DeliveryState
  // Cancellation, replacement bindings and later retries cannot erase delivery evidence.
  if (published) state = "published"
  else if (unresolved) state = !policy || late(unresolved.recordedAt ?? unresolved.attemptedAt) ? "unconfirmed" : "confirming"
  else if (latest && !latest.result) state = !policy ? "unavailable" : late(latest.attemptedAt) ? "delayed" : "sending"
  else if (record.cancelled) state = "cancelled"
  else if (latest?.result === "permanentFailure" || (latest?.reconciliation === "publicationFailed" && latest.failureType === "permanent")) state = "failed"
  else if (!policy) state = "unavailable"
  else if (latest && latest.number >= policy.maxAttempts) state = "failed"
  else if (!policy.enabled) state = "disabled"
  else if (!record.canPublish) state = "disconnected"
  else if (latest) {
    const next = latest.retryAfter ?? latest.reconciledAt ?? latest.recordedAt ?? latest.attemptedAt
    // A rescheduled retry must also wait until the new scheduled instant.
    const dueAt = Date.parse(next) > Date.parse(record.publishAt) ? next : record.publishAt
    state = late(dueAt) ? "delayed" : "retrying"
  } else if (age(record.publishAt) < 0) state = "scheduled"
  else state = late(record.publishAt) ? "delayed" : "queued"
  const { attempts: _attempts, canPublish: _canPublish, ...identity } = record
  void _attempts; void _canPublish
  return { ...identity, state, attention: attentionStates.has(state) || Boolean(published && unresolved), unresolvedAttempt: Boolean(unresolved), attempts: attempts.length,
    publishedAt: published ? published.reconciledPublishedAt ?? published.publishedAt : null,
    lastActivityAt: latest?.reconciledAt ?? latest?.recordedAt ?? latest?.attemptedAt ?? null }
}

export async function loadDeliverySnapshot(read: () => Promise<DeliveryRecord[]>, policy: DeliveryPolicy | null, now: string): Promise<DeliverySnapshot> {
  try {
    const records = await read()
    return { availability: "available", checkedAt: now, publishingEnabled: policy?.enabled ?? null,
      items: records.map((record) => deliveryItem(record, policy, now)) }
  } catch {
    // Missing evidence is a distinct state, never a successful empty queue.
    return { availability: "unavailable", checkedAt: now }
  }
}
