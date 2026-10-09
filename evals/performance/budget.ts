import { Buffer } from "node:buffer"
import { createHash } from "node:crypto"
export class EvaluationBudgetError extends Error { constructor() { super("EVALUATION_BUDGET_EXHAUSTED"); this.name = "EvaluationBudgetError" } }
export type BudgetLimits = { maxRequests: number; maxInputBytes: number; maxOutputTokens: number; maxMinutes: number }
export function evaluationBudget(limits: BudgetLimits, fetchImpl: typeof fetch = fetch) {
  if (!Number.isSafeInteger(limits.maxRequests) || limits.maxRequests < 1 || limits.maxRequests > 48
    || !Number.isSafeInteger(limits.maxInputBytes) || limits.maxInputBytes < 1 || limits.maxInputBytes > 4000000
    || !Number.isSafeInteger(limits.maxOutputTokens) || limits.maxOutputTokens < 10000 || limits.maxOutputTokens > 80000
    || !Number.isFinite(limits.maxMinutes) || limits.maxMinutes <= 0 || limits.maxMinutes > 20) throw Error("INVALID_EVALUATION_BUDGET")
  const started = performance.now()
  const admissions = new Map<string, number>()
  let requests = 0, inputBytes = 0, outputTokens = 0, inputTokens = 0, unknownOutputReservation = 0, pendingOutputReservation = 0, knownUsageReceipts = 0
  const wrapped: typeof fetch = async (url, init) => {
    if (String(url) !== "https://api.openai.com/v1/responses" || init?.method !== "POST" || typeof init.body !== "string") throw Error("EVALUATION_PROVIDER_BOUNDARY")
    const body = JSON.parse(init.body), bytes = Buffer.byteLength(init.body)
    if (body.max_output_tokens !== 10000) throw Error("EVALUATION_REQUEST_LIMIT_CHANGED")
    if (requests >= limits.maxRequests || inputBytes + bytes > limits.maxInputBytes
      || outputTokens + pendingOutputReservation + unknownOutputReservation + 10000 > limits.maxOutputTokens
      || performance.now() - started >= limits.maxMinutes * 60000) throw new EvaluationBudgetError()
    requests++; inputBytes += bytes; pendingOutputReservation += 10000
    const hash = createHash("sha256").update(init.body).digest("hex")
    admissions.set(hash, (admissions.get(hash) ?? 0) + 1)
    let known = false
    try {
      const remainingMs = Math.max(1, Math.ceil(limits.maxMinutes * 60000 - (performance.now() - started)))
      const signal = AbortSignal.any([...(init.signal ? [init.signal] : []), AbortSignal.timeout(remainingMs)])
      const response = await fetchImpl(url, { ...init, signal })
      try {
        const raw = await response.clone().json() as { usage?: { input_tokens?: unknown; output_tokens?: unknown } }
        const input = raw.usage?.input_tokens, output = raw.usage?.output_tokens
        if (typeof input === "number" && Number.isSafeInteger(input) && input >= 0 && typeof output === "number" && Number.isSafeInteger(output) && output >= 0 && output <= 10000) {
          inputTokens += input; outputTokens += output; knownUsageReceipts++; known = true
        }
      } catch { /* Unknown charged usage retains the entire reserved output budget. */ }
      return response
    } finally {
      pendingOutputReservation -= 10000
      if (!known) unknownOutputReservation += 10000
    }
  }
  return { fetch: wrapped, consumeAdmission: (hash: string) => { const count = admissions.get(hash) ?? 0; if (!count) return false; admissions.set(hash, count - 1); return true },
    snapshot: () => ({ limits, requests, serializedRequestBytes: inputBytes, knownInputTokens: inputTokens,
    knownOutputTokens: outputTokens, knownUsageReceipts, unknownOutputReservation, pendingOutputReservation, elapsedMs: performance.now() - started, monetaryCostUsd: null }) }
}
