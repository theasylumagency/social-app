import type { SocialContentPublishAttempt } from "../../blueprints/social"

export type ProviderRequestState = "prepared" | "preparingMedia" | "readyToDispatch" | "dispatchStarted" | "responseReceived"
export type ProviderDeliveryRequest = {
  attemptId: string
  providerBindingId: string
  provider: string
  providerProfileRef: string
  providerAccountRef: string
  publishingAccountId: string
  channel: "facebook" | "instagram"
  requestId: string
  requestFingerprint: string
  state: ProviderRequestState
  bindingStatus: "active" | "retired"
  connectionStatus: "connected" | "disconnected" | "error"
  canPublish: boolean
  profileStatus: "active" | "disabled" | "error"
  dispatchStartedAt: string | null
  providerPublicationRef: string | null
  duplicatePublicationRef: string | null
}
export type ProviderMediaUpload = {
  attemptId: string
  ordinal: number
  sourceAssetId: string
  mediaType: "image" | "video"
  contentSha256: string
  providerPublicUrl: string
  expiresAt: string
}
export type ProviderResponseRecord = {
  httpStatus: number | null
  providerPublicationRef?: string
  duplicatePublicationRef?: string
  errorCode?: string
}

/** Provider-neutral journal subordinate to the canonical attempt claim. */
export interface ProviderDeliveryStore {
  loadRequest(attemptId: SocialContentPublishAttempt["id"]): Promise<ProviderDeliveryRequest | null>
  transition(attemptId: string, expected: readonly ProviderRequestState[], next: ProviderRequestState, response?: ProviderResponseRecord): Promise<ProviderDeliveryRequest>
  recordMedia(upload: ProviderMediaUpload): Promise<void>
  listMedia(attemptId: string): Promise<readonly ProviderMediaUpload[]>
}

export type PublishableAsset = {
  sourceAssetId: string
  filename: string
  contentType: "image/jpeg" | "image/jpg" | "image/png" | "image/webp" | "image/gif" | "video/mp4" | "video/mpeg" | "video/quicktime" | "video/avi" | "video/x-msvideo" | "video/webm" | "video/x-m4v"
  bytes: Uint8Array
}
export interface PublicationAssetSource {
  load(attempt: SocialContentPublishAttempt): Promise<readonly PublishableAsset[]>
}
