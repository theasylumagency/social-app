import { estimateCost, reserveCost } from "../model-comparison/cost"

export const MODEL = "gpt-6.1-sol" as const
export const EFFORT_LIMITS = { requests: 80, requestBytes: 3000000, outputTokens: 150000, minutes: 30, estimatedUsd: 3 } as const
export class EffortBudget {
  requests = 0; requestBytes = 0; knownOutputTokens = 0; unknownOutputReservation = 0; spentUpperUsd = 0
  private pending = new Map<number, { cost: number; output: number }>()
  constructor(private now: () => number = () => performance.now(), private started = now()) {}
  admit(bytes: number, output: number) {
    if (!Number.isSafeInteger(bytes) || bytes < 0 || !Number.isSafeInteger(output) || output !== 10000) throw Error("EFFORT_REQUEST_CONFIGURATION_CHANGED")
    const cost = reserveCost(MODEL, bytes, output), pending = [...this.pending.values()]
    if (this.requests >= EFFORT_LIMITS.requests || this.requestBytes + bytes > EFFORT_LIMITS.requestBytes
      || this.knownOutputTokens + this.unknownOutputReservation + pending.reduce((sum, item) => sum + item.output, 0) + output > EFFORT_LIMITS.outputTokens
      || this.spentUpperUsd + pending.reduce((sum, item) => sum + item.cost, 0) + cost > EFFORT_LIMITS.estimatedUsd || this.remainingMs() <= 0) throw Error("EFFORT_SHARED_BUDGET_EXHAUSTED")
    const id = ++this.requests; this.requestBytes += bytes; this.pending.set(id, { cost, output }); return id
  }
  settle(id: number, usage: unknown, tier: string | null) {
    const reservation = this.pending.get(id); if (!reservation) throw Error("EFFORT_UNKNOWN_RESERVATION")
    const price = tier === "default" ? estimateCost(MODEL, usage) : { usd: null, lowerUsd: null, upperUsd: null }
    const output = (usage as { output_tokens?: unknown } | null)?.output_tokens
    if (typeof output === "number" && Number.isSafeInteger(output) && output >= 0 && output <= reservation.output && price.upperUsd !== null) { this.knownOutputTokens += output; this.spentUpperUsd += price.upperUsd }
    else { this.unknownOutputReservation += reservation.output; this.spentUpperUsd += reservation.cost }
    this.pending.delete(id); return price
  }
  remainingMs() { return Math.max(0, EFFORT_LIMITS.minutes * 60000 - (this.now() - this.started)) }
  snapshot() { return { requests: this.requests, requestBytes: this.requestBytes, knownOutputTokens: this.knownOutputTokens, unknownOutputReservation: this.unknownOutputReservation, pendingOutputReservation: [...this.pending.values()].reduce((sum, item) => sum + item.output, 0), upperCostBudgetConsumedUsd: this.spentUpperUsd, elapsedMs: this.now() - this.started, limits: EFFORT_LIMITS } }
}
