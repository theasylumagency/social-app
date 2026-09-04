import type {
  CorpusId,
  CorpusPatternId,
  CorpusPatternType,
  EvidenceStrength,
} from "./primitives"

export type CorpusPattern = {
  readonly id: CorpusPatternId
  readonly type: CorpusPatternType
  readonly value: unknown
  readonly evidenceStrength: EvidenceStrength
  readonly corpusId: CorpusId
  readonly temporalCharacter:
    | "stable"
    | "recentShift"
    | "campaignBound"
    | "mixed"
    | "unclear"
  readonly metrics?: Readonly<Record<string, number>>
}
