export const MODEL_PRICES = {
  "gpt-5.6-terra": { input: 2, cached: 0.2, write: 2.5, output: 12 },
  "gpt-5.6-sol": { input: 4, cached: 0.4, write: 5, output: 20 },
  "gpt-5.4-nano": { input: 0.2, cached: 0.02, write: 0.2, output: 1.25 },
  "gpt-6.1-sol": { input: 2, cached: 0.1, write: 2.5, output: 10 },
  "gpt-6-luna": { input: 0.1, cached: 0.01, write: 0.125, output: 0.5 },
} as const
export type PricedModel = keyof typeof MODEL_PRICES
export const PRICING_SOURCES = ["https://developers.openai.com/api/docs/models/gpt-6.1-sol", "https://developers.openai.com/api/docs/models/gpt-6-luna", "https://developers.openai.com/api/docs/models/gpt-5.6-sol", "https://developers.openai.com/api/docs/models/gpt-5.6-terra", "https://developers.openai.com/api/docs/models/gpt-5.4-nano", "https://developers.openai.com/api/docs/guides/prompt-caching"]
const integer = (value: unknown): value is number => typeof value === "number" && Number.isSafeInteger(value) && value >= 0
export function estimateCost(model: PricedModel, usage: unknown): { usd: number | null; lowerUsd: number | null; upperUsd: number | null } {
  if (!usage || typeof usage !== "object") return { usd: null, lowerUsd: null, upperUsd: null }
  const u = usage as { input_tokens?: unknown; output_tokens?: unknown; input_tokens_details?: { cached_tokens?: unknown; cache_write_tokens?: unknown } }
  if (!integer(u.input_tokens) || !integer(u.output_tokens) || u.input_tokens > 272000) return { usd: null, lowerUsd: null, upperUsd: null }
  const price = MODEL_PRICES[model], cached = u.input_tokens_details?.cached_tokens, written = u.input_tokens_details?.cache_write_tokens
  if (!integer(cached) || cached > u.input_tokens) return { usd: null, lowerUsd: 0, upperUsd: (u.input_tokens * price.write + u.output_tokens * price.output) / 1e6 }
  const rest = u.input_tokens - cached
  const base = (cached * price.cached + rest * price.input + u.output_tokens * price.output) / 1e6
  if (written === undefined && model === "gpt-5.4-nano") return { usd: base, lowerUsd: base, upperUsd: base }
  if (!integer(written) || written > rest) return { usd: null, lowerUsd: base, upperUsd: (cached * price.cached + rest * price.write + u.output_tokens * price.output) / 1e6 }
  const cost = base + written * (price.write - price.input) / 1e6
  return { usd: cost, lowerUsd: cost, upperUsd: cost }
}

export type HttpReceipt = {
  caseId: string; arm: "old" | "new"; model: PricedModel; responseModel: string | null; serviceTier: string | null; requestHash: string;
  startedAt: string; durationMs: number; requestBytes: number; inputHash: string; promptHash: string; schemaHash: string; effort: string;
  usage: unknown; estimatedCost: ReturnType<typeof estimateCost>; status: number | null; failure: string | null
}
export const LIMITS = { requests: 32, requestBytes: 2000000, outputTokens: 80000, minutes: 15, estimatedUsd: 3 } as const
export function reserveCost(model: PricedModel, requestBytes: number, maxOutput: number) {
  // UTF-8 byte count plus generous framing allowance is a conservative token proxy, not a tokenizer.
  return ((requestBytes + 4096) * MODEL_PRICES[model].write + maxOutput * MODEL_PRICES[model].output) / 1e6
}
