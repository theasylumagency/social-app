import type {
  BrandId,
  BusinessFactType,
  CorpusPatternType,
  EvidenceId,
  EvidenceStrength,
  KnowledgePath,
  ProofType,
  SourceClaimMode,
  SourceSnapshotId,
} from "./primitives"
import type {
  ArtifactLocator,
  EvidenceLineage,
  TemporalEvidenceMetadata,
} from "./evidence-provenance"

export type EvidenceType = "fact" | "claim" | "observation" | "inference"

export type Evidence = {
  readonly id: EvidenceId
  readonly brandId: BrandId
  readonly snapshotId: SourceSnapshotId
  readonly type: EvidenceType
  readonly sourceClaimMode: SourceClaimMode
  readonly value: unknown
  readonly evidenceStrength: EvidenceStrength
  readonly excerpt?: string
  readonly locator?: ArtifactLocator
  readonly temporalMetadata?: TemporalEvidenceMetadata
  readonly independenceGroupId?: string
  readonly lineage?: EvidenceLineage
}

export type ExtractedEvidenceProposal = {
  readonly localRef: string
  readonly type: EvidenceType
  readonly sourceClaimMode: SourceClaimMode
  readonly value: unknown
  readonly evidenceStrength: EvidenceStrength
  readonly excerpt?: string
  readonly locator?: ArtifactLocator
  readonly temporalMetadata?: TemporalEvidenceMetadata
  readonly semanticHints?: readonly string[]
}

export type EvidenceTarget =
  | { readonly kind: "knowledgePath"; readonly path: KnowledgePath }
  | { readonly kind: "proofCandidate"; readonly proofType: ProofType }
  | { readonly kind: "businessFact"; readonly factType: BusinessFactType }
  | { readonly kind: "corpusSignal"; readonly signalType: CorpusPatternType }
  | { readonly kind: "unmapped" }

export type EvidenceRoutingSupport = "direct" | "supporting" | "weak"

export type EvidenceRoutingTarget = {
  readonly target: EvidenceTarget
  readonly support: EvidenceRoutingSupport
}

export type EvidenceRouting = {
  readonly evidenceId: EvidenceId
  readonly routingVersion: string
  readonly targets: readonly EvidenceRoutingTarget[]
}
