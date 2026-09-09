export type ProviderWebhookEvent = {
  readonly provider: string
  readonly eventId: string
  readonly eventType: string
  readonly payloadHash: string
  readonly payload: Readonly<Record<string, unknown>>
}

export type ClaimedProviderWebhookEvent = ProviderWebhookEvent & {
  readonly leaseToken: string
  readonly processingAttempts: number
}

export interface ProviderWebhookStore {
  receive(event: ProviderWebhookEvent): Promise<"received" | "duplicate">
  claim(now: Date, leaseMs: number): Promise<ClaimedProviderWebhookEvent | null>
  complete(event: ClaimedProviderWebhookEvent, status: "processed" | "ignored"): Promise<void>
  retry(event: ClaimedProviderWebhookEvent, nextAttemptAt: Date, errorCode: string, maxAttempts: number): Promise<void>
}
