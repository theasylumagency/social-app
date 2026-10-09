import type { BudgetLimits } from "./budget"
export type CompletedBudget = { limits: BudgetLimits; requests: number; serializedRequestBytes: number; knownOutputTokens: number;
  unknownOutputReservation: number; pendingOutputReservation: number; elapsedMs: number }
/** A correction check shares the original allowance; it does not acquire a fresh budget. */
export function remainingBudget(total: BudgetLimits, prior: CompletedBudget): BudgetLimits {
  if (JSON.stringify(prior.limits) !== JSON.stringify(total) || prior.pendingOutputReservation !== 0
    || [prior.requests, prior.serializedRequestBytes, prior.knownOutputTokens, prior.unknownOutputReservation].some(value => !Number.isSafeInteger(value) || value < 0)
    || !Number.isFinite(prior.elapsedMs) || prior.elapsedMs < 0) throw Error("INVALID_PRIOR_BUDGET")
  const remaining = { maxRequests: total.maxRequests - prior.requests, maxInputBytes: total.maxInputBytes - prior.serializedRequestBytes,
    maxOutputTokens: total.maxOutputTokens - prior.knownOutputTokens - prior.unknownOutputReservation, maxMinutes: total.maxMinutes - prior.elapsedMs / 60000 }
  if (remaining.maxRequests < 1 || remaining.maxInputBytes < 1 || remaining.maxOutputTokens < 10000 || remaining.maxMinutes <= 0) throw Error("NO_REMAINING_EVALUATION_BUDGET")
  return remaining
}
