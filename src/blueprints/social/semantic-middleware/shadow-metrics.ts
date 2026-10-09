import type { ShadowTrace } from "./shadow"

export function semanticShadowMetrics(traces: readonly ShadowTrace[]) {
  const latencies = traces.flatMap(t => t.latencyMs === null ? [] : [t.latencyMs]).sort((a, b) => a - b)
  const p = (q: number) => latencies.length ? latencies[Math.max(0, Math.ceil(latencies.length * q) - 1)]! : null
  const texts = new Map<string, boolean>()
  for (const trace of traces) { const key = trace.source.sourceId + "/" + trace.source.revisionId; texts.set(key, texts.get(key) === true || trace.eligibility === "eligible") }
  const decisions = traces.flatMap(t => t.decisions)
  return { shadowEligibleTexts: [...texts.values()].filter(Boolean).length, shadowIneligibleTexts: [...texts.values()].filter(v => !v).length,
    providerRequests: traces.reduce((n, t) => n + t.providerRequests, 0), semanticDecisions: traces.reduce((n, t) => n + t.semanticDecisions, 0),
    familyDecisions: decisions.filter(d => d.kind === "family").length, polarityDecisions: decisions.filter(d => d.kind === "polarity").length,
    candidateBindingDecisions: decisions.filter(d => d.kind === "binding").length, temporalDecisions: decisions.filter(d => d.kind === "time").length, amountDecisions: decisions.filter(d => d.kind === "amount").length,
    applicationDeadZoneEvents: decisions.filter(d => d.derived === "applicationDeadZone").length,
    contractInvalidObservations: traces.filter(t => t.contractValidation.status === "structurallyInvalid").length,
    providerInvalidResponses: traces.filter(t => t.technicalErrors.some(e => e.code === "providerSchema")).length,
    unresolvedSemanticFields: traces.reduce((n, t) => n + t.unresolvedFields.length, 0),
    knownEllipsisLimitCases: traces.filter(t => t.knownCapabilityLimits.some(l => l.code === "ellipticalBinding")).length,
    knownAmbiguousBindingCases: traces.filter(t => t.knownCapabilityLimits.some(l => l.code === "ambiguousBinding")).length,
    providerFailures: traces.filter(t => t.invocation === "technicalFailure" || t.invocation === "timeout").length,
    timeouts: traces.filter(t => t.invocation === "timeout").length,
    timeoutRate: traces.reduce((n, t) => n + t.providerRequests, 0) ? traces.filter(t => t.invocation === "timeout").length / traces.reduce((n, t) => n + t.providerRequests, 0) : null,
    latencyMs: { count: latencies.length, mean: latencies.length ? latencies.reduce((a, b) => a + b, 0) / latencies.length : null, p50: p(0.5), p95: p(0.95) },
    inputTokens: traces.reduce((n, t) => n + (t.tokens.input ?? 0), 0), outputTokens: traces.reduce((n, t) => n + (t.tokens.output ?? 0), 0),
    requestsWithUnknownUsage: traces.filter(t => t.providerRequests && (t.tokens.input === null || t.tokens.output === null)).length,
    knownCostUsd: traces.reduce((n, t) => n + (t.costUsd ?? 0), 0), requestsWithUnknownCost: traces.filter(t => t.providerRequests && t.costUsd === null).length }
}
