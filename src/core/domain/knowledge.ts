import type {
  BrandId,
  ConfidenceScore,
  EpistemicStatus,
  EvidenceId,
  FounderDecisionId,
  GenerationPermission,
  HypothesisId,
  IsoDateTime,
  KnowledgeClaimId,
  KnowledgePath,
} from "./primitives"
import type { FreshnessAssessment } from "./freshness"
import type { KnowledgeClaimContext } from "./knowledge-context"

export type KnowledgeClaimLifecycle = "active" | "inactive"

export type KnowledgeClaimProvenanceRef =
  | { readonly kind: "evidence"; readonly evidenceId: EvidenceId }
  | {
      readonly kind: "founderDecision"
      readonly founderDecisionId: FounderDecisionId
    }
  | { readonly kind: "hypothesis"; readonly hypothesisId: HypothesisId }

export type KnowledgeClaim = {
  readonly id: KnowledgeClaimId
  readonly brandId: BrandId
  readonly path: KnowledgePath
  readonly value: unknown
  readonly context?: KnowledgeClaimContext
  readonly epistemicStatus: EpistemicStatus
  readonly lifecycle: KnowledgeClaimLifecycle
  readonly provenance: readonly KnowledgeClaimProvenanceRef[]
  readonly createdAt: IsoDateTime
}

export type KnowledgeClaimDerivedState = {
  readonly claimId: KnowledgeClaimId
  readonly confidence: ConfidenceScore
  readonly freshness: FreshnessAssessment
  readonly generationPermission: GenerationPermission
  readonly computedAt: IsoDateTime
}
