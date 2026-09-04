import type { ContentMode, FallbackStrategy } from "../../core/domain"
import {
  SOCIAL_CONTENT_MODES,
  SOCIAL_FALLBACK_STRATEGIES,
} from "./tokens"

export const SOCIAL_OPERATOR_DEFAULTS = {
  version: "1",
  voice: {
    tone: ["clear", "calm", "professional"],
    formality: "balanced",
    energy: "restrained",
  },
  allowVoiceFallbackForMvb: true,
  maximumAutomaticRepairPasses: 1,
  founderQuestionBudget: 7,
  founderConflictBudget: 5,
} as const

export type SocialFallbackTrigger =
  | "missingVoice"
  | "uncertainPositioning"
  | "missingAudience"
  | "unsupportedSpecificity"
  | "missingPrice"
  | "missingProof"

export type SocialFallbackPolicy = {
  readonly trigger: SocialFallbackTrigger
  readonly strategy: FallbackStrategy
  readonly instruction: string
  readonly blockedContentModes: readonly ContentMode[]
}

export const SOCIAL_FALLBACK_POLICIES = [
  {
    trigger: "missingVoice",
    strategy: SOCIAL_FALLBACK_STRATEGIES.operatorVoice,
    instruction: "Use the neutral Social Operator voice without presenting it as a brand preference.",
    blockedContentModes: [],
  },
  {
    trigger: "uncertainPositioning",
    strategy: SOCIAL_FALLBACK_STRATEGIES.neutralPositioning,
    instruction: "Describe the business factually and avoid unsupported status or market-position claims.",
    blockedContentModes: [],
  },
  {
    trigger: "missingAudience",
    strategy: SOCIAL_FALLBACK_STRATEGIES.generalEducation,
    instruction: "Use a broad educational frame and do not invent demographic or behavioral traits.",
    blockedContentModes: [],
  },
  {
    trigger: "unsupportedSpecificity",
    strategy: SOCIAL_FALLBACK_STRATEGIES.omitUnsupportedSpecifics,
    instruction: "Reduce specificity until every public assertion is supported by compiled context.",
    blockedContentModes: [],
  },
  {
    trigger: "missingPrice",
    strategy: SOCIAL_FALLBACK_STRATEGIES.omitPrice,
    instruction: "Omit price and discount language; use a non-price call to action when appropriate.",
    blockedContentModes: [],
  },
  {
    trigger: "missingProof",
    strategy: SOCIAL_FALLBACK_STRATEGIES.omitUnsupportedSpecifics,
    instruction: "Do not state the proof-dependent claim; switch to a supported factual frame.",
    blockedContentModes: [SOCIAL_CONTENT_MODES.proofLed],
  },
] as const satisfies readonly SocialFallbackPolicy[]
