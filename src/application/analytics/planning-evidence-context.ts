import type { WeekEvidence } from "../../blueprints/social/strategy/model"

/** Keep the full immutable lineage in storage; send only decision-relevant fields to the planner. */
export function planningEvidenceContext(evidence: readonly WeekEvidence[]) {
  const useful = evidence.filter(e => (e.results?.publicationCount ?? 0) > 0 || e.observations.length || e.businessContext || e.manual?.execution.length || e.manual?.unknowns.length)
  return (useful.length ? useful : evidence.slice(0, 1)).map(e => ({
    week: e.week, reviewedAt: e.reviewedAt, availability: e.results ? e.availability : "unavailable",
    provenance: e.results ? "measured-and-manual" : "manual-legacy",
    observations: e.observations.map(o => ({ ...o, provenance: "manual" as const })),
    execution: e.results ? e.execution : [], manual: e.manual ?? (e.results ? null : { reviewedAt: e.reviewedAt, execution: e.execution, unknowns: e.unknowns }),
    unknowns: e.unknowns, businessContext: e.businessContext,
    results: e.results ? { ...e.results, posts: e.results.posts.map((p, i) => ({ postKey: `p${i + 1}`, channel: p.channel,
      publishedAt: p.publishedAt, draftVersions: [...new Set(p.lineage.map(l => l.draftVersion))], lineageConflict: p.lineageConflict,
      measurement: p.measurement ? { source: p.measurement.provider, metricContract: p.measurement.metricContract ?? "legacy-unspecified",
        providerUpdatedAt: p.measurement.providerUpdatedAt, observedAt: p.measurement.observedAt, ageHours: p.measurement.ageHours,
        metrics: p.measurement.metrics, availability: p.measurement.availability } : null })) } : null,
  }))
}
