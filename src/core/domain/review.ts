import type {
  BusinessFactId,
  ConflictId,
  HypothesisId,
  KnowledgeClaimId,
  ReviewActionType,
  ReviewItemId,
} from "./primitives"

export type ReviewSubject =
  | { readonly kind: "knowledgeClaim"; readonly claimId: KnowledgeClaimId }
  | { readonly kind: "businessFact"; readonly factId: BusinessFactId }
  | { readonly kind: "hypothesis"; readonly hypothesisId: HypothesisId }
  | { readonly kind: "conflict"; readonly conflictId: ConflictId }

export type ReviewPresentation = {
  readonly title: string
  readonly summary?: string
}

export type ReviewAction = {
  readonly type: ReviewActionType
}

export type ReviewItem = {
  readonly id: ReviewItemId
  readonly subject: ReviewSubject
  readonly presentation: ReviewPresentation
  readonly actions: readonly ReviewAction[]
}

export type ReviewModel = {
  readonly items: readonly ReviewItem[]
}
