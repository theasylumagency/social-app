import type {
  BrandId,
  BusinessFactId,
  BusinessFactType,
  EvidenceId,
  FounderDecisionId,
  IsoDateTime,
} from "./primitives"

export type BusinessFactLifecycle = "active" | "inactive"

export type BusinessFactProvenanceRef =
  | { readonly kind: "evidence"; readonly evidenceId: EvidenceId }
  | {
      readonly kind: "founderDecision"
      readonly founderDecisionId: FounderDecisionId
    }

export type BusinessFact = {
  readonly id: BusinessFactId
  readonly brandId: BrandId
  readonly type: BusinessFactType
  readonly value: unknown
  readonly lifecycle: BusinessFactLifecycle
  readonly provenance: readonly BusinessFactProvenanceRef[]
  readonly validFrom?: IsoDateTime
  readonly validUntil?: IsoDateTime
  readonly createdAt: IsoDateTime
}
