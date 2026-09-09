import type { Pool } from "pg"
import { ingestSocialAnalytics } from "../application/analytics/ingest-social-analytics"
import { PostgresSocialAnalyticsStore } from "../infrastructure/postgres/social-analytics-store"
import { createZernioClient } from "../infrastructure/zernio/client"
import { createZernioAnalyticsSource } from "../infrastructure/zernio/analytics"
import type { ZernioEnvironment } from "../infrastructure/zernio/environment"

let lastFallbackPoll = 0
export async function runSocialAnalyticsTick(pool: Pool, environment: ZernioEnvironment, triggered = false) {
  if (!environment.analyticsEnabled) return { status: "disabled" as const }
  const now = Date.now()
  if (!triggered && now - lastFallbackPoll < environment.analyticsPollSeconds * 1000) return { status: "notDue" as const }
  const store = new PostgresSocialAnalyticsStore(pool)
  const source = createZernioAnalyticsSource(createZernioClient(environment))
  const results = await ingestSocialAnalytics({ provider: "zernio", source, store })
  lastFallbackPoll = now
  return { status: "ran" as const, results }
}
