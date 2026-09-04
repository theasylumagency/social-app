import type {
  BrandId,
  ConflictId,
  FounderDecisionId,
  IsoDateTime,
  KnowledgeClaimId,
  KnowledgePath,
} from "./primitives"

export type KnowledgeConflictBase = {
  readonly id: ConflictId
  readonly brandId: BrandId
  readonly path: KnowledgePath
  readonly claimIds: readonly KnowledgeClaimId[]
  readonly reason: string
  readonly detectedAt: IsoDateTime
}

export type OpenKnowledgeConflict = KnowledgeConflictBase & {
  readonly status: "open"
}

export type ConflictResolution =
  | {
      readonly kind: "founderDecision"
      readonly founderDecisionId: FounderDecisionId
    }
  | {
      readonly kind: "reconciliation"
      readonly resultingClaimIds: readonly KnowledgeClaimId[]
    }

export type ResolvedKnowledgeConflict = KnowledgeConflictBase & {
  readonly status: "resolved"
  readonly resolution: ConflictResolution
  readonly resolvedAt: IsoDateTime
}

export type ConflictDismissalReason =
  | "falsePositive"
  | "contextsDisjoint"
  | "valuesEquivalent"
  | "noLongerMaterial"

export type DismissedKnowledgeConflict = KnowledgeConflictBase & {
  readonly status: "dismissed"
  readonly dismissalReason: ConflictDismissalReason
  readonly resolvedAt: IsoDateTime
}

export type KnowledgeConflict =
  | OpenKnowledgeConflict
  | ResolvedKnowledgeConflict
  | DismissedKnowledgeConflict
