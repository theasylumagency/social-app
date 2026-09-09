import type {
  SocialContentPublishAttempt,
  SocialContentPublishReconciliation,
  SocialContentPublishResult,
} from "../../blueprints/social"
import type { ProviderDeliveryRequest } from "./delivery-store"

export type PublishReconciliationCorrelation = {
  readonly attempt: SocialContentPublishAttempt
  readonly result: SocialContentPublishResult | null
  readonly request: ProviderDeliveryRequest
}

export type PublishReconciliationLookup = {
  readonly provider: string
  readonly providerPublicationRef?: string
  readonly attemptId?: string
}

export interface SocialPublishReconciliationStore {
  findCorrelation(lookup: PublishReconciliationLookup): Promise<PublishReconciliationCorrelation | null>
  findUnknown(provider: string, limit: number): Promise<readonly PublishReconciliationCorrelation[]>
  append(reconciliation: SocialContentPublishReconciliation): Promise<"recorded" | "alreadyRecorded">
  findOrphaned(cutoff: Date, limit: number): Promise<readonly PublishReconciliationCorrelation[]>
}
