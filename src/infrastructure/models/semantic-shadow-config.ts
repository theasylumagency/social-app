import { createHash } from "node:crypto"
import path from "node:path"
import type { ShadowConfiguration, ShadowPolicy } from "../../blueprints/social/semantic-middleware/shadow"

export type ShadowSettings = { readonly enabled: false; readonly reason: "disabled" | "missingConfiguration" | "invalidConfiguration" }
  | { readonly enabled: true; readonly metadata: ShadowConfiguration; readonly apiKey: string; readonly tracePath: string; readonly budgetMs: number; readonly inputUsdPerMillion: number | null; readonly outputUsdPerMillion: number | null }
const text = (env: Record<string, string | undefined>, key: string) => env[key]?.trim() ?? ""
function integer(value: string, fallback: number, min: number, max: number): number | null {
  if (!value) return fallback
  const n = Number(value)
  return Number.isInteger(n) && n >= min && n <= max ? n : null
}
/** No keys/default aliases are guessed; absent/invalid opt-in never fails the workflow. */
export function semanticShadowSettings(env: Record<string, string | undefined> = process.env, cwd = process.cwd()): ShadowSettings {
  if (text(env, "SEMANTIC_MIDDLEWARE_SHADOW_ENABLED") !== "true") return { enabled: false, reason: "disabled" }
  const apiKey = text(env, "SEMANTIC_MIDDLEWARE_SHADOW_JEV_API_KEY")
  const model = text(env, "SEMANTIC_MIDDLEWARE_SHADOW_MODEL")
  const trace = text(env, "SEMANTIC_MIDDLEWARE_SHADOW_TRACE_PATH")
  if (!apiKey || !model || !trace || text(env, "SEMANTIC_MIDDLEWARE_SHADOW_PROVIDER") !== "jev") return { enabled: false, reason: "missingConfiguration" }
  const timeoutMs = integer(text(env, "SEMANTIC_MIDDLEWARE_SHADOW_TIMEOUT_MS"), 1000, 20, 2000)
  const budgetMs = integer(text(env, "SEMANTIC_MIDDLEWARE_SHADOW_BUDGET_MS"), 2500, 20, 5000)
  const maxTasks = integer(text(env, "SEMANTIC_MIDDLEWARE_SHADOW_MAX_TASKS"), 3, 1, 5)
  // Worker-local evaluation files only; no arbitrary policy/config path can be overwritten.
  const traceRoot = path.resolve(cwd, ".local/semantic-shadow")
  const tracePath = path.resolve(cwd, trace)
  const relative = path.relative(traceRoot, tracePath)
  if (timeoutMs === null || budgetMs === null || maxTasks === null || !/^jev-\d+\.\d+\.\d+$/.test(model)
    || !relative || relative.startsWith("..") || path.isAbsolute(relative) || !tracePath.endsWith(".jsonl")) return { enabled: false, reason: "invalidConfiguration" }
  const lowText = text(env, "SEMANTIC_MIDDLEWARE_SHADOW_EXPERIMENT_LOW"), highText = text(env, "SEMANTIC_MIDDLEWARE_SHADOW_EXPERIMENT_HIGH")
  let policy: ShadowPolicy = { mode: "rawOnly" }
  if (lowText || highText) {
    const low = Number(lowText), high = Number(highText), experimentRef = text(env, "SEMANTIC_MIDDLEWARE_SHADOW_EXPERIMENT_REF")
    if (!lowText || !highText || !experimentRef || !Number.isFinite(low) || !Number.isFinite(high) || low < 0 || low >= 0.5 || high <= 0.5 || high > 1) return { enabled: false, reason: "invalidConfiguration" }
    policy = { mode: "experimentalDeadZone", low, high, experimentRef }
  }
  const rate = (key: string) => { const value = text(env, key), n = Number(value); return value && Number.isFinite(n) && n >= 0 ? n : null }
  const inputUsdPerMillion = rate("SEMANTIC_MIDDLEWARE_SHADOW_INPUT_USD_PER_M"), outputUsdPerMillion = rate("SEMANTIC_MIDDLEWARE_SHADOW_OUTPUT_USD_PER_M")
  const metadata = { provider: "jev" as const, executionMode: "provider" as const, protocolVersion: "unda-semantic-shadow-jev-bounded-v1" as const, model, timeoutMs, budgetMs, maxTasks, policy }
  const configurationRef = "semantic-shadow-config:" + createHash("sha256").update(JSON.stringify({ ...metadata, budgetMs, inputUsdPerMillion, outputUsdPerMillion })).digest("hex").slice(0, 20)
  return { enabled: true, metadata: { ...metadata, configurationRef }, apiKey, tracePath, budgetMs, inputUsdPerMillion, outputUsdPerMillion }
}
