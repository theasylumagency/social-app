import type { ConfirmedPublication } from "../src/application/analytics/week-evidence"
type MutableMeasurement = { -readonly [K in keyof NonNullable<ConfirmedPublication["measurement"]>]: NonNullable<ConfirmedPublication["measurement"]>[K] }
export function confirmedPublication(id = "post"): Omit<ConfirmedPublication, "measurement"> & { measurement: MutableMeasurement | null } {
  return { publishingAccountId: "account", channel: "facebook", provider: "zernio", providerPublicationRef: id,
    publishedAt: "2026-09-09T12:00:00.000Z", confirmedAt: "2026-09-09T12:01:00.000Z",
    lineage: { publicationInputId: "input", runId: "run", postKey: "p1", contentId: "content", draftId: "draft", draftVersion: 1,
      scheduleId: "schedule", attemptId: "attempt", providerBindingId: "binding" },
    measurement: { snapshotId: "snapshot:" + id, storedAt: "2026-09-10T12:02:00.000Z", provider: "zernio", providerProfileRef: "profile",
      providerAccountRef: "provider-account", channel: "facebook", providerPublicationRef: id, nativePublicationRef: id,
      publicationUrl: null, providerUpdatedAt: "2026-09-10T12:00:00.000Z", observedAt: "2026-09-10T12:01:00.000Z",
      metrics: { impressions: 0, reach: null, likes: 0, comments: null, shares: null, saves: null, clicks: null, views: null, follows: null, engagementRate: null },
      availability: { impressions: true, reach: false, likes: true, comments: false, shares: false, saves: false, clicks: false, views: false, follows: false, engagementRate: false },
      rawMetrics: { impressions: 0, likes: 0 }, metricContract: "zernio.reported-fields.v1", publishingAccountId: "account", providerBindingId: "binding" } }
}
