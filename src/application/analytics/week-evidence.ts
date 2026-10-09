import { isWeek, shiftWeek } from "../dashboard/model"
import { SOCIAL_METRIC_NAMES, type SocialAnalyticsResult } from "./social-analytics-store"
import type { WeekEvidence } from "../../blueprints/social/strategy/model"

export const EVIDENCE_WEEK_COUNT = 4
export const MAX_EVIDENCE_POSTS = 12
export const evidenceWeeks = (week: string) => Array.from({ length: EVIDENCE_WEEK_COUNT }, (_, i) => shiftWeek(week, -i))
export function evidencePeriod(week: string) {
  if (!isWeek(week)) throw new Error("Invalid evidence week")
  // Asia/Tbilisi is UTC+04:00; the end is exclusive.
  return { start: new Date(`${week}T00:00:00+04:00`).toISOString(), end: new Date(`${shiftWeek(week, 1)}T00:00:00+04:00`).toISOString() }
}
export type PublicationLineage = {
  publicationInputId: string; runId: string; postKey: string; contentId: string; draftId: string; draftVersion: number
  scheduleId: string; attemptId: string; providerBindingId: string
}
export type ConfirmedPublication = {
  publishingAccountId: string; channel: "facebook" | "instagram"; provider: string; providerPublicationRef: string
  publishedAt: string; confirmedAt: string; lineage: PublicationLineage
  identityConflict?: boolean
  measurement: (SocialAnalyticsResult & { snapshotId: string; storedAt: string }) | null
}
export type MeasuredPost = {
  identity: string; publishingAccountId: string; channel: "facebook" | "instagram"; publishedAt: string
  lineage: PublicationLineage[]; lineageConflict: boolean
  measurement: (SocialAnalyticsResult & { snapshotId: string; ageHours: number }) | null
}
export type WeekResultSnapshot = {
  schema: "unda.week-results"; version: 1; asOf: string; period: { start: string; end: string; timezone: "Asia/Tbilisi"; closed: boolean }
  publicationCount: number; measuredPostCount: number; truncated: boolean; posts: MeasuredPost[]
  selection: "latest-snapshot-per-publication"; interpretation: "descriptive-only"
}

/** The same bounded, descriptive snapshot is displayed and frozen into a new plan. */
export function summarizeWeekResults(input: { week: string; asOf: string; publications: readonly ConfirmedPublication[]; manual?: WeekEvidence | undefined; truncated?: boolean }): WeekEvidence {
  const { start, end } = evidencePeriod(input.week), cutoff = Date.parse(input.asOf)
  if (!Number.isFinite(cutoff)) throw new Error("Invalid evidence cutoff")
  const publications = input.publications.filter(p => Date.parse(p.confirmedAt) <= cutoff && Date.parse(p.publishedAt) <= cutoff)
  const eligibleMeasurement = (p: ConfirmedPublication) => p.measurement && Date.parse(p.measurement.observedAt) <= cutoff
    && Date.parse(p.measurement.storedAt) <= cutoff && Date.parse(p.measurement.providerUpdatedAt) <= cutoff
    && Date.parse(p.measurement.providerUpdatedAt) >= Date.parse(p.publishedAt) ? p.measurement : null
  const aliases = new Map<string, string>()
  const conflictingReferences = new Set<string>()
  const providerKey = (p: ConfirmedPublication) => JSON.stringify([p.publishingAccountId, p.channel, p.provider, p.providerPublicationRef])
  for (const p of publications) {
    const measurement = eligibleMeasurement(p)
    if (p.identityConflict || (measurement?.nativePublicationRef && aliases.has(providerKey(p)) && aliases.get(providerKey(p)) !== measurement.nativePublicationRef)) conflictingReferences.add(providerKey(p))
    if (measurement?.nativePublicationRef) aliases.set(providerKey(p), measurement.nativePublicationRef)
  }
  const groups = new Map<string, ConfirmedPublication[]>()
  for (const p of publications) {
    const native = conflictingReferences.has(providerKey(p)) ? null : aliases.get(providerKey(p))
    const identity = native ? JSON.stringify([p.publishingAccountId, p.channel, "native", native]) : providerKey(p)
    groups.set(identity, [...(groups.get(identity) ?? []), p])
  }
  const allPosts: MeasuredPost[] = [...groups].map(([identity, rows]) => {
    const lineage = [...new Map(rows.map(p => [JSON.stringify(p.lineage), p.lineage])).values()]
    const lineageConflict = rows.some(p => conflictingReferences.has(providerKey(p))) || new Set(lineage.map(l => JSON.stringify([l.contentId, l.draftId, l.draftVersion]))).size !== 1
    const candidates = rows.flatMap(p => { const measurement = eligibleMeasurement(p); return measurement ? [measurement] : [] })
      .sort((a, b) => b.providerUpdatedAt.localeCompare(a.providerUpdatedAt) || b.observedAt.localeCompare(a.observedAt) || a.snapshotId.localeCompare(b.snapshotId))
    const publishedAt = rows.map(p => p.publishedAt).sort()[0]!
    const chosen = lineageConflict ? null : candidates[0]
    // Never carry a missing field forward from an older snapshot or add cumulative snapshots.
    const measurement = chosen ? { ...chosen, ageHours: Math.round((Date.parse(chosen.providerUpdatedAt) - Date.parse(publishedAt)) / 3_600_000 * 10) / 10,
      metrics: Object.fromEntries([...SOCIAL_METRIC_NAMES, "engagementRate" as const].map(name => [name, chosen.availability[name] ? chosen.metrics[name] : null])) as SocialAnalyticsResult["metrics"] } : null
    return { identity, publishingAccountId: rows[0]!.publishingAccountId, channel: rows[0]!.channel, publishedAt, lineage, lineageConflict, measurement }
  }).filter(p => Date.parse(p.publishedAt) >= Date.parse(start) && Date.parse(p.publishedAt) < Date.parse(end))
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt) || a.identity.localeCompare(b.identity))
  const posts = allPosts.slice(0, MAX_EVIDENCE_POSTS)
  const measuredPostCount = posts.filter(p => p.measurement && Object.values(p.measurement.metrics).some(v => v !== null)).length
  const closed = cutoff >= Date.parse(end), truncated = !!input.truncated || allPosts.length > posts.length
  const complete = closed && !truncated && posts.length > 0 && posts.every(p => p.measurement?.nativePublicationRef && Object.values(p.measurement.metrics).every(v => v !== null))
  const manual = input.manual
  return { week: input.week, reviewedAt: input.asOf, availability: measuredPostCount ? complete ? "available" : "partial" : "unavailable",
    observations: (manual?.observations ?? []).map(o => ({ ...o, provenance: "manual" as const })),
    execution: [`დადასტურებული პუბლიკაციები: ${allPosts.length}${input.truncated ? " ან მეტი" : ""}. გაზომვის მქონე პოსტები ნაჩვენებ შერჩევაში: ${measuredPostCount}.`],
    ...(manual ? { manual: { reviewedAt: manual.reviewedAt, execution: manual.execution, unknowns: manual.unknowns } } : {}),
    businessContext: manual?.businessContext ?? "",
    unknowns: ["ეს პუბლიკაციის კვირის მიხედვით შერჩეული პოსტების ბოლო გაზომვებია და არა მხოლოდ ამ კვირაში მიღებული რეაქციები.",
      "წყაროს მაჩვენებლების ზუსტი განმარტებები და ჩართულობის გამყოფი დაუდგენელია; სხვადასხვა არხი, წყარო და პოსტის ასაკი პირდაპირ შესადარებელი არ არის.",
      "მიღწევა და ჩართულობა გაყიდვას ან მიზეზობრივ ბიზნესგავლენას არ ამტკიცებს. მომხმარებლის დაკვირვებები ავტომატურად გაზომილ ფაქტებს არ ცვლის.",
      ...(!closed ? ["პერიოდი ჯერ არ დასრულებულა."] : []), ...(truncated ? [`შერჩევა შეზღუდულია: თითო კვირაში მაქსიმუმ ${MAX_EVIDENCE_POSTS} პოსტი.`] : []),
      ...(measuredPostCount < posts.length ? ["ზოგი დადასტურებული პუბლიკაციის გაზომვა მიუწვდომელია."] : []),
      ...(posts.some(p => p.measurement && Object.values(p.measurement.metrics).some(v => v === null)) ? ["ზოგი მაჩვენებელი წყაროს არ მოუწოდებია და უცნობად რჩება."] : []),
      ...(posts.some(p => p.measurement && !p.measurement.nativePublicationRef) ? ["ზოგი პოსტის არხის იდენტიფიკატორი უცნობია; სხვადასხვა წყაროში მისი იდენტობის შედარება შეზღუდულია."] : []),
      ...(posts.some(p => p.lineageConflict) ? ["პუბლიკაციის ვერსიის კავშირი წინააღმდეგობრივია; მისი მაჩვენებლები შეფასებიდან გამორიცხულია."] : [])],
    results: { schema: "unda.week-results", version: 1, asOf: input.asOf, period: { start, end, timezone: "Asia/Tbilisi", closed },
      publicationCount: allPosts.length, measuredPostCount, truncated, posts, selection: "latest-snapshot-per-publication", interpretation: "descriptive-only" } }
}
