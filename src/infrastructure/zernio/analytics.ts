import { SOCIAL_METRIC_NAMES, type AnalyticsProfile, type NormalizedSocialAnalytics, type SocialAnalyticsPage,
  type SocialAnalyticsSource, SocialAnalyticsCursorExpiredError } from "../../application/analytics/social-analytics-store"
import type { createZernioClient } from "./client"

const object = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid Zernio analytics response")
  return value as Record<string, unknown>
}
const ref = (value: unknown) => {
  const raw = value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>)._id : value
  if (typeof raw !== "string" || !/^[A-Za-z0-9_.:-]{1,300}$/u.test(raw)) throw new Error("Invalid Zernio analytics reference")
  return raw
}
const instant = (value: unknown) => {
  if (typeof value !== "string" || !Number.isFinite(Date.parse(value))) throw new Error("Invalid Zernio analytics timestamp")
  return new Date(value).toISOString()
}
const safeUrl = (value: unknown) => {
  if (value === null || value === undefined) return null
  if (typeof value !== "string" || value.length > 4000) throw new Error("Invalid analytics publication URL")
  const url = new URL(value)
  if (url.protocol !== "https:" || url.username || url.password) throw new Error("Invalid analytics publication URL")
  return url.href
}
function metric(value: unknown, integer = true): number | null {
  if (value === null || value === undefined) return null
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || (integer && !Number.isSafeInteger(value))) throw new Error("Invalid analytics metric")
  return value
}

function normalize(profile: AnalyticsProfile, raw: unknown, observedAt: string): NormalizedSocialAnalytics[] {
  const post = object(raw)
  const providerPublicationRef = ref(post.postId ?? post._id ?? post.id)
  const platforms = Array.isArray(post.platformAnalytics) ? post.platformAnalytics : [post]
  return platforms.map(object).filter((platform) => platform.platform === "facebook" || platform.platform === "instagram").map((platform) => {
    const analytics = object(platform.analytics ?? post.analytics)
    const values = Object.fromEntries(SOCIAL_METRIC_NAMES.map((name) => [name, metric(analytics[name])])) as Record<typeof SOCIAL_METRIC_NAMES[number], number | null>
    const engagementRate = metric(analytics.engagementRate, false)
    const availability = Object.fromEntries([...SOCIAL_METRIC_NAMES.map((name) => [name, values[name] !== null] as const),
      ["engagementRate", engagementRate !== null] as const]) as NormalizedSocialAnalytics["availability"]
    const rawMetrics = Object.fromEntries([...SOCIAL_METRIC_NAMES.flatMap((name) => values[name] === null ? [] : [[name, values[name]!] as const]),
      ...(engagementRate === null ? [] : [["engagementRate", engagementRate] as const])])
    return { provider: profile.provider, providerProfileRef: profile.providerProfileRef, providerAccountRef: ref(platform.accountId ?? post.accountId),
      channel: platform.platform as "facebook" | "instagram", providerPublicationRef,
      nativePublicationRef: platform.platformPostId === null || platform.platformPostId === undefined ? null : ref(platform.platformPostId),
      publicationUrl: safeUrl(platform.platformPostUrl ?? post.platformPostUrl),
      providerUpdatedAt: instant(analytics.lastUpdated ?? post.syncedAt ?? post.updatedAt), observedAt,
      metrics: { ...values, engagementRate }, availability, rawMetrics }
  })
}

function page(profile: AnalyticsProfile, value: unknown, observedAt: string, bootstrap: boolean): SocialAnalyticsPage {
  const data = object(value)
  const rows = Array.isArray(data.data) ? data.data : Array.isArray(data.posts) ? data.posts : []
  const observations = rows.flatMap((row) => normalize(profile, row, observedAt))
  const nextCursor = typeof data.nextCursor === "string" && data.nextCursor.length <= 8000 ? data.nextCursor : null
  const pagination = data.pagination && typeof data.pagination === "object" ? object(data.pagination) : null
  const hasMore = typeof data.hasMore === "boolean" ? data.hasMore
    : bootstrap && pagination && typeof pagination.page === "number" && typeof pagination.totalPages === "number" ? pagination.page < pagination.totalPages : false
  if (!bootstrap && (nextCursor === null || typeof data.hasMore !== "boolean")) throw new Error("Invalid Zernio analytics cursor page")
  return { observations, nextCursor, hasMore }
}

export function createZernioAnalyticsSource(client: ReturnType<typeof createZernioClient>, now = () => new Date().toISOString()): SocialAnalyticsSource {
  return {
    async bootstrap(profile, pageNumber) {
      const response = await client.request({ method: "GET", path: "analytics", query: { profileId: profile.providerProfileRef,
        source: "late", page: String(pageNumber), limit: "100", order: "asc" } })
      return page(profile, response.data, now(), true)
    },
    async delta(profile, cursor) {
      const response = await client.request({ method: "GET", path: "analytics/delta", query: { profileId: profile.providerProfileRef,
        limit: "100", ...(cursor === null ? {} : { cursor }) }, acceptedStatuses: [400] })
      if (response.status === 400) throw new SocialAnalyticsCursorExpiredError()
      return page(profile, response.data, now(), false)
    },
  }
}
