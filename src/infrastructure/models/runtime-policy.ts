export const MODEL_REQUEST_TIMEOUT_MS = 150_000
export const MODEL_RETRY_BACKOFF_MS = 1_000
// Two validation attempts + ONE transient retry across the entire logical call.
export const MODEL_CALL_MAX_MS = 3 * MODEL_REQUEST_TIMEOUT_MS + MODEL_RETRY_BACKOFF_MS
export const MODEL_STAGE_RESERVE_MS = MODEL_CALL_MAX_MS + 29_000
export const OPERATOR_WORKER_BUDGET_MS = 540_000
export const OPERATOR_LEASE_MS = 600_000

type ModelEnvironment = Record<string, string | undefined>
const configured = (env: ModelEnvironment, key: string) => env[key]?.trim() || undefined
export function postStageModel(step: "outline" | "writing" | "review" | "ready", env: ModelEnvironment = process.env) {
  if (step === "writing") return configured(env, "OPENAI_POST_WRITER_MODEL") ?? "gpt-5.6-sol"
  return configured(env, step === "outline" ? "OPENAI_POST_PLANNER_MODEL" : "OPENAI_POST_REVIEW_MODEL") ?? configured(env, "OPENAI_PLANNING_MODEL") ?? "gpt-5.6-terra"
}

const networkCodes = new Set(["ECONNRESET", "ECONNREFUSED", "ETIMEDOUT", "EAI_AGAIN", "ENETUNREACH", "EHOSTUNREACH", "EPIPE", "UND_ERR_CONNECT_TIMEOUT", "UND_ERR_HEADERS_TIMEOUT", "UND_ERR_BODY_TIMEOUT", "UND_ERR_SOCKET"])
const transientStatuses = new Set([429, 500, 502, 503, 504])
/** Only allowlisted metadata goes to logs/audits; never error.message or cause wholesale. */
export function modelFailure(error: unknown): { kind: string; transient: boolean; httpStatus?: number; networkCode?: string } {
  if (!(error instanceof Error)) return { kind: "unknown", transient: false }
  const status = /^MODEL_HTTP_(\d{3})$/.exec(error.message)
  if (status) { const httpStatus = Number(status[1]); return { kind: "http", httpStatus, transient: transientStatuses.has(httpStatus) } }
  if (error.name === "TimeoutError") return { kind: "timeout", transient: true }
  if (error.message === "MODEL_INCOMPLETE") return { kind: "incomplete", transient: false }
  if (error.message.startsWith("MODEL_CONTRACT")) return { kind: "contract", transient: false }
  if (error.message === "MODEL_LOST_LEASE") return { kind: "lost_lease", transient: false }
  const code = (error as Error & { code?: unknown }).code ?? (error.cause as { code?: unknown } | undefined)?.code
  if (typeof code === "string" && networkCodes.has(code)) return { kind: code.includes("TIMEOUT") || code === "ETIMEDOUT" ? "timeout" : "network", networkCode: code, transient: true }
  if (code === undefined && error instanceof TypeError && ["fetch failed", "Failed to fetch", "terminated"].includes(error.message)) return { kind: "network", transient: true }
  return { kind: error instanceof SyntaxError ? "protocol" : "unknown", transient: false }
}
