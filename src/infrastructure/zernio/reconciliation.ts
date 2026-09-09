import type { SocialContentPublishReconciliationOutcome } from "../../blueprints/social"
import { createIsoDateTime, isIsoDateTime } from "../../core/domain"
import type { SocialContentPublishReconciler } from "../../application/publishing/run-publish-reconciliation"
import type { createZernioClient } from "./client"

const object = (value: unknown): Record<string, unknown> | null => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null
const ref = (value: unknown) => {
  const raw = object(value)?._id ?? value
  return typeof raw === "string" && /^[A-Za-z0-9_-]{1,160}$/u.test(raw) ? raw : null
}
const instant = (value: unknown) => typeof value === "string" && isIsoDateTime(value) ? createIsoDateTime(value) : null

function interpret(post: Record<string, unknown>, expected: { channel: string; account: string }): SocialContentPublishReconciliationOutcome {
  const postRef = ref(post._id ?? post.id)
  const platforms = Array.isArray(post.platforms) ? post.platforms.map(object).filter((x): x is Record<string, unknown> => x !== null) : []
  if (!postRef || platforms.length !== 1 || platforms[0]!.platform !== expected.channel
    || ref(platforms[0]!.accountId) !== expected.account) return { status: "inconclusive", reasonCode: "providerProtocolError" }
  const status = platforms[0]!.status ?? post.status
  if (status === "published" && post.status === "published") {
    const publishedAt = instant(platforms[0]!.publishedAt) ?? instant(post.publishedAt)
    return publishedAt ? { status: "publicationFound", providerPublicationRef: postRef, publishedAt }
      : { status: "inconclusive", reasonCode: "providerProtocolError" }
  }
  if (status === "failed" || post.status === "failed") return { status: "publicationFailed", failureType: "permanent", reasonCode: "providerRejectedContent" }
  return { status: "inconclusive", reasonCode: "providerAcceptedPending" }
}

/** Read-only reconciliation adapter. It never invokes Zernio's retry endpoint. */
export function createZernioReconciler(client: ReturnType<typeof createZernioClient>): SocialContentPublishReconciler {
  return async (correlation) => {
    const knownRef = correlation.request.providerPublicationRef ?? correlation.request.duplicatePublicationRef
    if (knownRef) {
      const response = await client.request({ method: "GET", path: `posts/${knownRef}`, acceptedStatuses: [404] })
      if (response.status === 404) return { status: "inconclusive", reasonCode: "providerPublicationNotFound" }
      const post = object(object(response.data)?.post)
      return post ? interpret(post, { channel: correlation.request.channel, account: correlation.request.providerAccountRef })
        : { status: "inconclusive", reasonCode: "providerProtocolError" }
    }
    const response = await client.request({ method: "GET", path: "posts", query: { profileId: correlation.request.providerProfileRef,
      accountId: correlation.request.providerAccountRef, sortBy: "created-desc", page: "1", limit: "100" } })
    const posts = object(response.data)?.posts
    if (!Array.isArray(posts)) return { status: "inconclusive", reasonCode: "providerProtocolError" }
    const match = posts.map(object).find((post) => object(post?.metadata)?.undaAttemptId === correlation.attempt.id)
    return match ? interpret(match, { channel: correlation.request.channel, account: correlation.request.providerAccountRef })
      : { status: "inconclusive", reasonCode: "providerRequestNotLocated" }
  }
}
