import type {
  BusinessFactId,
  BusinessFactType,
  FallbackStrategy,
  GenerationConstraintType,
  GenerationPermission,
  GuidanceKey,
  KnowledgeClaimId,
  KnowledgePath,
  LearnedPreferenceKey,
  ProofId,
  ProofType,
  PublicClaimKey,
  PublicFactKey,
  TaskId,
} from "./primitives"
import type { FreshnessAssessment } from "./freshness"
import type { SafeOperatingEnvelope } from "./operation"
import type { ProofSupportStatus } from "./proof"

export type PublicFactContext = {
  readonly key: PublicFactKey
  readonly value: unknown
}

export type InternalGuidance = {
  readonly key: GuidanceKey
  readonly value: unknown
}

export type GenerationConstraint = {
  readonly type: GenerationConstraintType
  readonly value?: unknown
  readonly instruction?: string
}

export type ProofContextSubject =
  | { readonly kind: "publicFact"; readonly key: PublicFactKey }
  | { readonly kind: "publicClaim"; readonly key: PublicClaimKey }

export type ProofContext = {
  readonly type: ProofType
  readonly supports: ProofContextSubject
  readonly summary?: string
}

export type AudienceContext = { readonly value: unknown }
export type ContentDirectionContext = { readonly value: unknown }
export type VoiceContext = { readonly value: unknown }

export type WriterFallbackContext = {
  readonly strategy: FallbackStrategy
  readonly instruction?: string
}

export type LearnedPreferenceContext = {
  readonly key: LearnedPreferenceKey
  readonly value: unknown
}

export type WriterContext = {
  readonly taskId: TaskId
  readonly instruction: string
  readonly publicFacts: readonly PublicFactContext[]
  readonly internalGuidance: readonly InternalGuidance[]
  readonly constraints: readonly GenerationConstraint[]
  readonly proof: readonly ProofContext[]
  readonly audience?: AudienceContext
  readonly contentDirection?: ContentDirectionContext
  readonly voice: VoiceContext
  readonly fallbacks: readonly WriterFallbackContext[]
  readonly learnedPreferences: readonly LearnedPreferenceContext[]
}

export type ValidationProofContext = {
  readonly proofId: ProofId
  readonly type: ProofType
  readonly supportStatus: ProofSupportStatus
  readonly freshness: FreshnessAssessment
}

export type ValidationFactContext = {
  readonly factId: BusinessFactId
  readonly type: BusinessFactType
  readonly value: unknown
  readonly proofs: readonly ValidationProofContext[]
}

export type ValidationClaimContext = {
  readonly claimId: KnowledgeClaimId
  readonly path: KnowledgePath
  readonly value: unknown
  readonly generationPermission: GenerationPermission
  readonly proofs: readonly ValidationProofContext[]
}

export type GenerationValidationContext = {
  readonly taskId: TaskId
  readonly facts: readonly ValidationFactContext[]
  readonly claims: readonly ValidationClaimContext[]
  readonly constraints: readonly GenerationConstraint[]
}

export type GenerationContextCompilationResult =
  | {
      readonly status: "compiled"
      readonly writerContext: WriterContext
      readonly validationContext: GenerationValidationContext
    }
  | {
      readonly status: "blocked"
      readonly envelope: SafeOperatingEnvelope
    }
