export const SOCIAL_METRIC_NAMES = ["impressions", "reach", "likes", "comments", "shares", "saves", "clicks", "views", "follows"] as const
export type SocialMetricName = typeof SOCIAL_METRIC_NAMES[number]

export type NormalizedSocialAnalytics = {
  readonly provider: string
  readonly providerProfileRef: string
  readonly providerAccountRef: string
  readonly channel: "facebook" | "instagram"
  readonly providerPublicationRef: string
  readonly nativePublicationRef: string | null
  readonly publicationUrl: string | null
  readonly providerUpdatedAt: string
  readonly observedAt: string
  readonly metrics: Readonly<Record<SocialMetricName, number | null>> & { readonly engagementRate: number | null }
  readonly availability: Readonly<Record<SocialMetricName | "engagementRate", boolean>>
  readonly rawMetrics: Readonly<Record<string, number>>
}

export type AnalyticsProfile = { readonly provider: string; readonly providerProfileRef: string }
export type AnalyticsCursor = { readonly cursor: string | null; readonly bootstrapped: boolean }
export type SocialAnalyticsResult = NormalizedSocialAnalytics & { readonly publishingAccountId: string; readonly providerBindingId: string }

export interface SocialAnalyticsStore {
  listProfiles(provider: string): Promise<readonly AnalyticsProfile[]>
  readCursor(profile: AnalyticsProfile): Promise<AnalyticsCursor | null>
  resetCursor(profile: AnalyticsProfile, expectedCursor: string | null): Promise<boolean>
  commit(profile: AnalyticsProfile, observations: readonly NormalizedSocialAnalytics[], nextCursor: string | null,
    options?: { readonly markBootstrapped?: boolean; readonly expectedCursor?: string | null }): Promise<void>
  listResults(scope: { readonly ownerId: string; readonly brandId: string }): Promise<readonly SocialAnalyticsResult[]>
}

export type SocialAnalyticsPage = { readonly observations: readonly NormalizedSocialAnalytics[]; readonly nextCursor: string | null; readonly hasMore: boolean }
export class SocialAnalyticsCursorExpiredError extends Error {
  constructor() { super("Social analytics cursor expired"); this.name = "SocialAnalyticsCursorExpiredError" }
}
export interface SocialAnalyticsSource {
  bootstrap(profile: AnalyticsProfile, page: number): Promise<SocialAnalyticsPage>
  delta(profile: AnalyticsProfile, cursor: string | null): Promise<SocialAnalyticsPage>
}
