import type { ModelAttemptTelemetry } from "../../infrastructure/models/attempt-telemetry"

export type AttemptMetric = {
  id: string; workflow: string; workflowId: string; step: string; promptVersion: string; model: string
  durationMs: number; usage: unknown; validationErrors: unknown; telemetry: ModelAttemptTelemetry | null
}
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value)
const count = (value: unknown): value is number => typeof value === "number" && Number.isSafeInteger(value) && value >= 0
export function latencyStats(values: readonly number[]) {
  if (values.some(value => !Number.isFinite(value) || value < 0)) throw Error("INVALID_LATENCY")
  if (!values.length) return null
  const sorted = [...values].sort((a, b) => a - b)
  return { n: sorted.length, p50: sorted[Math.ceil(sorted.length * .5) - 1]!, p95: sorted[Math.ceil(sorted.length * .95) - 1]!,
    mean: sorted.reduce((sum, value) => sum + value, 0) / sorted.length, maximum: sorted.at(-1)!, quantileMethod: "nearestRank" }
}
export function summarizeAttempts(rows: readonly AttemptMetric[]) {
  if (new Set(rows.map(row => row.id)).size !== rows.length) throw Error("DUPLICATE_RECEIPT")
  const groups = new Map<string, AttemptMetric[]>()
  for (const row of rows) {
    const key = JSON.stringify([row.workflow, row.step, row.promptVersion, row.model, row.telemetry?.reasoningEffort ?? "unrecorded"])
    groups.set(key, [...(groups.get(key) ?? []), row])
  }
  return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, attempts]) => {
    const first = attempts[0]!
    const timed = attempts.filter(row => row.telemetry !== null)
    const calls = new Map<string, AttemptMetric[]>()
    for (const row of timed) {
      const key = `${row.workflowId}:${row.telemetry!.logicalCallId}`
      calls.set(key, [...(calls.get(key) ?? []), row])
    }
    let knownInputTokens = 0, knownOutputTokens = 0, knownCachedInputTokens = 0, knownReasoningTokens = 0
    let missingTokenReceipts = 0, missingCacheReceipts = 0, missingReasoningReceipts = 0
    for (const row of attempts) {
      const usage = object(row.usage) ? row.usage : {}
      if (count(usage.input_tokens) && count(usage.output_tokens)) { knownInputTokens += usage.input_tokens; knownOutputTokens += usage.output_tokens }
      else missingTokenReceipts++
      const cached = object(usage.input_tokens_details) ? usage.input_tokens_details.cached_tokens : undefined
      if (count(cached)) knownCachedInputTokens += cached; else missingCacheReceipts++
      const reasoning = object(usage.output_tokens_details) ? usage.output_tokens_details.reasoning_tokens : undefined
      if (count(reasoning)) knownReasoningTokens += reasoning; else missingReasoningReceipts++
    }
    const completeCalls = [...calls.values()].filter(call => {
      const ordered = [...call].sort((a, b) => a.telemetry!.requestOrdinal - b.telemetry!.requestOrdinal)
      return ordered.every((row, index) => row.telemetry!.requestOrdinal === index + 1) && ordered.at(-1)!.telemetry!.outcome === "accepted"
    })
    return { workflow: first.workflow, step: first.step, promptVersion: first.promptVersion, model: first.model,
      reasoningEffort: first.telemetry?.reasoningEffort ?? "unrecorded", requests: attempts.length,
      workflows: new Set(attempts.map(row => row.workflowId)).size,
      requestAndValidationMs: latencyStats(attempts.map(row => row.durationMs)),
      summedAttemptMs: attempts.reduce((sum, row) => sum + row.durationMs, 0),
      failedOrInvalidRequests: attempts.filter(row => Array.isArray(row.validationErrors) && row.validationErrors.length > 0).length,
      missingValidationReceipts: attempts.filter(row => !Array.isArray(row.validationErrors)).length,
      usage: { knownInputTokens, knownOutputTokens, knownCachedInputTokens, knownReasoningTokens, missingTokenReceipts, missingCacheReceipts, missingReasoningReceipts },
      telemetry: { instrumentedRequests: timed.length, legacyRequests: attempts.length - timed.length, observedLogicalCalls: timed.length ? calls.size : null,
        completeSuccessfulLogicalCalls: timed.length ? completeCalls.length : null,
        logicalCallElapsedMs: latencyStats(completeCalls.map(call => {
          const starts = call.map(row => Date.parse(row.telemetry!.startedAt)), ends = call.map(row => Date.parse(row.telemetry!.completedAt))
          // Wall clocks may change; reject invalid evidence rather than fabricating negative timings.
          return Math.max(...ends) - Math.min(...starts)
        })),
        providerRequestMs: latencyStats(timed.map(row => row.telemetry!.requestDurationMs)),
        transportRetries: timed.length ? timed.filter(row => row.telemetry!.kind === "transport_retry").length : null,
        validationRepairs: timed.length ? timed.filter(row => row.telemetry!.kind === "validation_repair").length : null,
        backoffMs: timed.length ? timed.reduce((sum, row) => sum + row.telemetry!.backoffBeforeMs, 0) : null,
        inputBytes: timed.length ? timed.reduce((sum, row) => sum + row.telemetry!.inputBytes, 0) : null },
      monetaryCostUsd: null, endToEndMs: null, qualityScore: null,
      evidenceLimits: ["Summed attempt time includes concurrent work; it is not end-to-end latency.",
        "Legacy receipts cannot establish logical-call, retry, context-size or reasoning-effort metrics.",
        "Missing native usage is unknown, not zero billing. No confirmed rates or invoice supplied.",
        "Stored model receipts do not establish current-pipeline quality or a representative population."] }
  })
}
