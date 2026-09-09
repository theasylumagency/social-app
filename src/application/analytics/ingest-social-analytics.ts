import { SocialAnalyticsCursorExpiredError, type AnalyticsProfile, type SocialAnalyticsSource, type SocialAnalyticsStore } from "./social-analytics-store"

async function ingestProfile(profile: AnalyticsProfile, source: SocialAnalyticsSource, store: SocialAnalyticsStore, mayReset = true): Promise<number> {
  let state = await store.readCursor(profile)
  let observations = 0
  if (!state?.bootstrapped) {
    for (let page = 1; page <= 100; page++) {
      const baseline = await source.bootstrap(profile, page)
      await store.commit(profile, baseline.observations, null, { markBootstrapped: !baseline.hasMore })
      observations += baseline.observations.length
      if (!baseline.hasMore) break
      if (page === 100) throw new Error("Analytics bootstrap page limit exceeded")
    }
    state = await store.readCursor(profile)
  }
  let cursor = state?.cursor ?? null
  try {
    for (let page = 1; page <= 100; page++) {
      const previousCursor = cursor
      const delta = await source.delta(profile, cursor)
      // The initial empty read establishes the feed position. For an established
      // cursor, an empty page can be a settlement delay and must be polled again.
      if (cursor === null || delta.observations.length > 0) {
        await store.commit(profile, delta.observations, delta.nextCursor, { expectedCursor: previousCursor })
        cursor = delta.nextCursor
      }
      observations += delta.observations.length
      if (!delta.hasMore) break
      if (delta.nextCursor === null || delta.nextCursor === previousCursor) throw new Error("Analytics cursor did not advance")
      if (page === 100) throw new Error("Analytics delta page limit exceeded")
    }
  } catch (error) {
    if (mayReset && error instanceof SocialAnalyticsCursorExpiredError) {
      const reset = await store.resetCursor(profile, cursor)
      if (!reset) return observations
      return observations + await ingestProfile(profile, source, store, false)
    }
    throw error
  }
  return observations
}

export async function ingestSocialAnalytics(deps: { readonly provider: string; readonly source: SocialAnalyticsSource; readonly store: SocialAnalyticsStore }) {
  const profiles = await deps.store.listProfiles(deps.provider)
  const results = []
  for (const profile of profiles) {
    try { results.push({ profile, status: "fulfilled" as const, observations: await ingestProfile(profile, deps.source, deps.store) }) }
    catch (error) { results.push({ profile, status: "rejected" as const, error: error instanceof Error ? error.name : "unknown" }) }
  }
  return results
}
