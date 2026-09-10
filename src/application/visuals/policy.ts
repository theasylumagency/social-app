export const VISUAL_MODEL_DEFAULT = "gpt-image-2.5-sunburst"
export const VISUAL_DEMO_SEED_CREDITS = 20
export const VISUAL_PROVIDER_TIMEOUT_MS = 240_000
export const VISUAL_LEASE_SECONDS = 600
export const creditCostForSuccessfulGeneration = () => 1 as const
export type VisualMode = "development" | "demo" | "test" | "production" | "disabled"
export type VisualPolicy = { mode: VisualMode; model: string; quality: "low" | "medium" | "high"; seedCredits: number; enabled: boolean }

export function readVisualPolicy(env: Record<string, string | undefined> = process.env): VisualPolicy {
  const mode = env.VISUAL_MODE || (env.NODE_ENV === "development" || env.NODE_ENV === "test" ? env.NODE_ENV : "production")
  if (!["development", "demo", "test", "production", "disabled"].includes(mode)) throw Error("Invalid VISUAL_MODE")
  const quality = env.OPENAI_IMAGE_QUALITY || "medium"
  if (!["low", "medium", "high"].includes(quality)) throw Error("Invalid OPENAI_IMAGE_QUALITY")
  return { mode: mode as VisualMode, model: env.OPENAI_IMAGE_MODEL?.trim() || VISUAL_MODEL_DEFAULT,
    quality: quality as VisualPolicy["quality"], enabled: mode !== "disabled",
    seedCredits: ["development", "demo", "test"].includes(mode) ? VISUAL_DEMO_SEED_CREDITS : 0 }
}

export class VisualError extends Error {
  constructor(public readonly code: string, message: string, public readonly status = 422) { super(message) }
}

export function assertVisualEnabled(policy: VisualPolicy, apiKey: string | undefined) {
  if (!policy.enabled) throw new VisualError("disabled", "გამოსახულების გენერაცია დროებით გამორთულია.", 503)
  if (!apiKey?.trim()) throw new VisualError("not_configured", "გამოსახულების სერვისი ჯერ არ არის გამართული.", 503)
}
