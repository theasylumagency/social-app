import type { EvidenceId, IsoDate, IsoDateTime } from "./primitives"

export type TextRangeLocator = {
  readonly kind: "textRange"
  readonly start: number
  readonly end: number
}

export type StructuredPathLocator = {
  readonly kind: "structuredPath"
  readonly path: readonly (string | number)[]
}

export type PageLocator = {
  readonly kind: "page"
  readonly pageNumber: number
}

export type TimeRangeLocator = {
  readonly kind: "timeRange"
  readonly startMs: number
  readonly endMs: number
}

export type ArtifactLocator =
  | TextRangeLocator
  | StructuredPathLocator
  | PageLocator
  | TimeRangeLocator

export type EvidenceTemporalValue = IsoDate | IsoDateTime

export type TemporalEvidenceMetadata = {
  readonly sourcePublishedAt?: EvidenceTemporalValue
  readonly validFrom?: EvidenceTemporalValue
  readonly validUntil?: EvidenceTemporalValue
}

export type EvidenceLineage = {
  readonly parentEvidenceIds: readonly EvidenceId[]
}
