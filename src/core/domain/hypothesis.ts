import type {
  BrandId,
  EvidenceId,
  HypothesisId,
  IsoDateTime,
  KnowledgePath,
} from "./primitives"

export type Hypothesis = {
  readonly id: HypothesisId
  readonly brandId: BrandId
  readonly path: KnowledgePath
  readonly value: unknown
  readonly evidenceIds: readonly EvidenceId[]
  readonly createdAt: IsoDateTime
}
