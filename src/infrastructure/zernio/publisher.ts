import type { SocialContentPublishProviderOutcome, SocialContentPublisher, SocialContentPublisherInput } from "../../blueprints/social"
import { createIsoDateTime, type IsoDateTime } from "../../core/domain"
import type { ProviderDeliveryStore, PublicationAssetSource, ProviderMediaUpload } from "../../application/publishing/delivery-store"
import { ZernioClientError, type createZernioClient } from "./client"
import type { createZernioMediaUploader } from "./media"

const object = (value: unknown): Record<string, unknown> | null => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null
const reference = (value: unknown) => {
  const raw = object(value)?._id ?? value
  return typeof raw === "string" && /^[A-Za-z0-9_-]{1,160}$/u.test(raw) ? raw : null
}
const copy = (input: SocialContentPublisherInput) => input.draft.format === "staticPost" ? input.draft.text
  : input.draft.format === "carousel" || input.draft.format === "reel" ? input.draft.caption ?? "" : ""
function retryAfter(header: string | undefined): IsoDateTime | undefined {
  if (!header) return undefined
  const seconds = Number(header)
  const instant = Number.isFinite(seconds) && seconds >= 0 ? Date.now() + seconds * 1000 : Date.parse(header)
  return Number.isFinite(instant) && instant > Date.now() ? createIsoDateTime(new Date(instant).toISOString()) : undefined
}
function mediaRequirement(input: SocialContentPublisherInput, assets: readonly { contentType: string }[]) {
  if (input.draft.format === "reel") return assets.length === 1 && assets[0]!.contentType.startsWith("video/") ? null : "mediaManifestIncomplete"
  if (input.draft.format === "carousel" || input.draft.format === "story") return assets.length === input.draft.frames.length ? null : "mediaManifestIncomplete"
  return input.contentExecutionSpec.visualDependency === "essential" && assets.length < 1 ? "mediaManifestIncomplete" : null
}

/** Immediate-only adapter at the existing SocialContentPublisher boundary. */
export function createZernioPublisher(deps: { client: ReturnType<typeof createZernioClient>; journal: ProviderDeliveryStore;
  assets: PublicationAssetSource; media: ReturnType<typeof createZernioMediaUploader>; now?: () => IsoDateTime }): SocialContentPublisher {
  const now = deps.now ?? (() => createIsoDateTime(new Date().toISOString()))
  return async (input): Promise<SocialContentPublishProviderOutcome> => {
    const request = await deps.journal.loadRequest(input.attempt.id)
    if (!request || request.provider !== "zernio" || request.publishingAccountId !== input.publishingAccount.id
      || request.providerAccountRef !== input.publishingAccount.providerAccountRef || request.channel !== input.publishingAccount.channel) {
      return { status: "permanentFailure", errorCode: "providerProtocolError" }
    }
    if (request.bindingStatus !== "active") {
      return { status: "retryableFailure", errorCode: "providerUnavailableBeforeDispatch" }
    }
    if (request.connectionStatus === "disconnected") return { status: "permanentFailure", errorCode: "publishingAccountDisconnected" }
    if (request.profileStatus !== "active" || request.connectionStatus === "error" || !request.canPublish) {
      return { status: "permanentFailure", errorCode: "providerAuthenticationFailed" }
    }
    await deps.journal.transition(input.attempt.id, ["prepared"], "preparingMedia")
    let assets
    try { assets = await deps.assets.load(input.attempt) }
    catch { return { status: "retryableFailure", errorCode: "mediaUploadFailed" } }
    const requirement = mediaRequirement(input, assets)
    if (requirement) return { status: "permanentFailure", errorCode: requirement }
    const uploads: ProviderMediaUpload[] = []
    const oldUploads = await deps.journal.listMedia(input.attempt.id)
    try {
      for (const [ordinal, asset] of assets.entries()) {
        const old = oldUploads.find((item) => item.ordinal === ordinal)
        const uploaded = old && new Date(old.expiresAt).getTime() > Date.now() + 60_000 ? old : await deps.media.upload(asset)
        const record = { ...uploaded, attemptId: input.attempt.id, ordinal }
        if (!old) await deps.journal.recordMedia(record)
        uploads.push(record)
      }
    } catch {
      return { status: "retryableFailure", errorCode: "mediaUploadFailed" }
    }
    await deps.journal.transition(input.attempt.id, ["preparingMedia"], "readyToDispatch")
    const body = {
      content: copy(input),
      ...(uploads.length ? { mediaItems: uploads.map((item) => ({ type: item.mediaType, url: item.providerPublicUrl })) } : {}),
      platforms: [{ platform: input.publishingAccount.channel, accountId: input.publishingAccount.providerAccountRef }],
      publishNow: true,
      metadata: { undaAttemptId: input.attempt.id, undaScheduleId: input.attempt.scheduleId },
    }
    await deps.journal.transition(input.attempt.id, ["readyToDispatch"], "dispatchStarted")
    try {
      const response = await deps.client.request({ method: "POST", path: "posts", body, requestId: request.requestId,
        acceptedStatuses: [400, 401, 402, 403, 409, 429, 500, 502, 503, 504] })
      const data = object(response.data)
      const post = object(data?.post) ?? object(data?.existingPost)
      const providerRef = reference(post?._id)
      const duplicateRef = reference(object(data?.details)?.existingPostId ?? data?.existingPostId)
      if (response.status === 409 && duplicateRef) {
        await deps.journal.transition(input.attempt.id, ["dispatchStarted"], "responseReceived", { httpStatus: 409,
          duplicatePublicationRef: duplicateRef, errorCode: "providerDuplicatePossible" })
        return { status: "unknownOutcome", errorCode: "providerDuplicatePossible" }
      }
      if (response.status === 429) {
        await deps.journal.transition(input.attempt.id, ["dispatchStarted"], "responseReceived", { httpStatus: 429, errorCode: "providerRateLimited" })
        const retry = retryAfter(response.retryAfter)
        return { status: "retryableFailure", errorCode: "providerRateLimited", ...(retry ? { retryAfter: retry } : {}) }
      }
      if ([400, 401, 402, 403].includes(response.status)) {
        const code = response.status === 401 ? "providerAuthenticationFailed" : "providerRejectedContent"
        await deps.journal.transition(input.attempt.id, ["dispatchStarted"], "responseReceived", { httpStatus: response.status, errorCode: code })
        return { status: "permanentFailure", errorCode: code }
      }
      if (response.status >= 500) {
        await deps.journal.transition(input.attempt.id, ["dispatchStarted"], "responseReceived", { httpStatus: response.status, errorCode: "providerResponseMissing" })
        return { status: "unknownOutcome", errorCode: "providerResponseMissing" }
      }
      if (![200, 201].includes(response.status) || !providerRef || !post) {
        await deps.journal.transition(input.attempt.id, ["dispatchStarted"], "responseReceived", { httpStatus: response.status, errorCode: "providerProtocolError" })
        return { status: "unknownOutcome", errorCode: "providerProtocolError" }
      }
      const platforms = Array.isArray(post.platforms) ? post.platforms.map(object) : []
      if (platforms.length !== 1 || platforms[0]?.platform !== input.publishingAccount.channel
        || reference(platforms[0]?.accountId) !== input.publishingAccount.providerAccountRef) {
        await deps.journal.transition(input.attempt.id, ["dispatchStarted"], "responseReceived", { httpStatus: response.status,
          providerPublicationRef: providerRef, errorCode: "providerProtocolError" })
        return { status: "unknownOutcome", errorCode: "providerProtocolError" }
      }
      const platformStatus = platforms[0]?.status
      await deps.journal.transition(input.attempt.id, ["dispatchStarted"], "responseReceived", { httpStatus: response.status, providerPublicationRef: providerRef })
      if (post.status === "published" && platformStatus === "published") return { status: "published", providerPublicationRef: providerRef, publishedAt: now() }
      if (platformStatus === "failed" || post.status === "failed") return { status: "permanentFailure", errorCode: "providerRejectedContent" }
      return { status: "unknownOutcome", errorCode: "providerAcceptedPending" }
    } catch (error) {
      const code = error instanceof ZernioClientError && error.code === "invalidResponse" ? "providerProtocolError" : "providerResponseMissing"
      await deps.journal.transition(input.attempt.id, ["dispatchStarted"], "responseReceived", { httpStatus: error instanceof ZernioClientError ? error.status : null, errorCode: code })
      return { status: "unknownOutcome", errorCode: code }
    }
  }
}
