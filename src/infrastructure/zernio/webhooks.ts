import { createHash, createHmac, timingSafeEqual } from "node:crypto"
import type { ProviderWebhookStore } from "../../application/publishing/webhook-store"
import type { ProviderWebhookInterpretation } from "../../application/publishing/process-provider-webhooks"
import { createIsoDateTime, isIsoDateTime } from "../../core/domain"

const object = (value: unknown): Record<string, unknown> | null => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null
const text = (value: unknown, max: number) => typeof value === "string" && value.length > 0 && value.length <= max ? value : null
const ref = (value: unknown) => text(object(value)?._id ?? value, 160)

export function interpretZernioWebhook(payload: Readonly<Record<string, unknown>>): ProviderWebhookInterpretation {
  const event = text(payload.event, 100)
  if (!event) throw new Error("Invalid webhook event")
  if (event === "account.connected" || event === "account.disconnected") {
    const accountRef = ref(object(payload.account)?._id ?? object(payload.account)?.id)
    if (!accountRef) throw new Error("Invalid account webhook")
    return { type: "account", connected: event === "account.connected", providerAccountRef: accountRef }
  }
  if (event === "analytics.synced") return { type: "analytics", providerProfileRef: ref(object(payload.profile)?._id ?? payload.profileId) }
  if (!event.startsWith("post.")) return { type: "ignored" }
  const post = object(payload.post)
  const postRef = ref(post?._id ?? post?.id)
  const attemptId = text(object(post?.metadata)?.undaAttemptId, 300)
  if (!post || (!postRef && !attemptId)) throw new Error("Invalid post webhook")
  const payloadPlatform = object(payload.platform)
  const rollupPlatforms = Array.isArray(post.platforms) ? post.platforms.map(object).filter((item): item is Record<string, unknown> => item !== null) : []
  const platform = payloadPlatform ?? (rollupPlatforms.length === 1 ? rollupPlatforms[0]! : null)
  const channel = text(platform?.platform, 30)
  const providerAccountRef = ref(object(payload.account)?._id ?? object(payload.account)?.id ?? platform?.accountId)
  if ((channel !== "facebook" && channel !== "instagram") || !providerAccountRef) throw new Error("Invalid post webhook scope")
  const lookup = { provider: "zernio", ...(postRef ? { providerPublicationRef: postRef } : {}), ...(attemptId ? { attemptId } : {}) }
  if (event === "post.published" || event === "post.platform.published") {
    const rawInstant = object(payload.platform)?.publishedAt ?? post.publishedAt ?? payload.timestamp
    if (typeof rawInstant !== "string" || !isIsoDateTime(rawInstant) || !postRef) return { type: "reconciliation", lookup, channel, providerAccountRef,
      outcome: { status: "inconclusive", reasonCode: "providerProtocolError" } }
    return { type: "reconciliation", lookup, channel, providerAccountRef, outcome: { status: "publicationFound", providerPublicationRef: postRef,
      publishedAt: createIsoDateTime(rawInstant) } }
  }
  if (["post.failed", "post.platform.failed", "post.cancelled"].includes(event)) return { type: "reconciliation", lookup, channel, providerAccountRef,
    outcome: { status: "publicationFailed", failureType: "permanent", reasonCode: "providerRejectedContent" } }
  if (["post.scheduled", "post.partial"].includes(event)) return { type: "reconciliation", lookup, channel, providerAccountRef,
    outcome: { status: "inconclusive", reasonCode: "providerAcceptedPending" } }
  return { type: "ignored" }
}

export function createZernioWebhookHttp(deps: { readonly secret: string; readonly store: ProviderWebhookStore; readonly maxBodyBytes?: number }) {
  if (!deps.secret || /[\r\n\u0000]/u.test(deps.secret)) throw new Error("A valid Zernio webhook secret is required")
  const maxBodyBytes = deps.maxBodyBytes ?? 256_000
  if (!Number.isSafeInteger(maxBodyBytes) || maxBodyBytes < 1 || maxBodyBytes > 1_000_000) throw new Error("Invalid webhook body limit")
  return async (request: Request): Promise<Response> => {
    const declared = request.headers.get("content-length")
    if (declared !== null && Number(declared) > maxBodyBytes) return new Response(null, { status: 413 })
    const signature = request.headers.get("x-zernio-signature")
    if (!signature) return new Response(null, { status: 401 })
    const raw = await request.text()
    if (Buffer.byteLength(raw) > maxBodyBytes) return new Response(null, { status: 413 })
    const expected = createHmac("sha256", deps.secret).update(raw).digest()
    if (!/^[a-f0-9]{64}$/u.test(signature)) return new Response(null, { status: 400 })
    const supplied = Buffer.from(signature, "hex")
    if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) return new Response(null, { status: 400 })
    let payload: Record<string, unknown> | null = null
    try { payload = object(JSON.parse(raw)) } catch { /* rejected below */ }
    const eventId = text(payload?.id, 200)
    const eventType = text(payload?.event, 100)
    if (!payload || !eventId || !eventType) return new Response(null, { status: 400 })
    const headerId = request.headers.get("x-zernio-event-id")
    if (headerId !== null && headerId !== eventId) return new Response(null, { status: 400 })
    const headerType = request.headers.get("x-zernio-event")
    if (headerType !== null && headerType !== eventType) return new Response(null, { status: 400 })
    try {
      await deps.store.receive({ provider: "zernio", eventId, eventType, payloadHash: createHash("sha256").update(raw).digest("hex"), payload })
    } catch { return new Response(null, { status: 409 }) }
    return new Response(null, { status: 204 })
  }
}
