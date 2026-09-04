import type {
  BrandId,
  BusinessFactId,
  FounderDecisionId,
  FounderDecisionType,
  HypothesisId,
  IsoDateTime,
  KnowledgeClaimId,
  KnowledgePath,
} from "./primitives"

export type FounderDecisionSubject =
  | { readonly kind: "knowledgePath"; readonly path: KnowledgePath }
  | { readonly kind: "knowledgeClaim"; readonly claimId: KnowledgeClaimId }
  | { readonly kind: "businessFact"; readonly factId: BusinessFactId }
  | { readonly kind: "hypothesis"; readonly hypothesisId: HypothesisId }

export type FounderDecision = {
  readonly id: FounderDecisionId
  readonly brandId: BrandId
  readonly type: FounderDecisionType
  readonly subject: FounderDecisionSubject
  readonly value?: unknown
  readonly createdAt: IsoDateTime
}

export type FounderDecisionDraft = {
  readonly type: FounderDecisionType
  readonly subject: FounderDecisionSubject
  readonly value?: unknown
}
