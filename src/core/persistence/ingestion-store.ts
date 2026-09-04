import type {
  BrandId,
  Evidence,
  EvidenceRouting,
  IngestionRunId,
  IsoDateTime,
  KnowledgeClaim,
  KnowledgeMutationProposal,
  MinimumViableBrandStatus,
  Source,
  SourceArtifact,
  SourceSnapshot,
  SourceSnapshotId,
} from "../domain"

export type PersistedBrand = {
  readonly id: BrandId
  readonly createdAt: IsoDateTime
}

export type CompletedIngestionRun = {
  readonly id: IngestionRunId
  readonly brandId: BrandId
  readonly sourceId: Source["id"]
  readonly snapshotId: SourceSnapshotId
  readonly status: "completed"
  readonly startedAt: IsoDateTime
  readonly completedAt: IsoDateTime
  readonly minimumViableBrand: MinimumViableBrandStatus
}

export type IngestionPersistenceBatch = {
  readonly brand: PersistedBrand
  readonly run: CompletedIngestionRun
  readonly source: Source
  readonly snapshot: SourceSnapshot
  readonly evidence: readonly Evidence[]
  readonly routings: readonly EvidenceRouting[]
  readonly knowledgeProposals: readonly KnowledgeMutationProposal[]
  readonly supportingSources?: readonly PersistedSourceGraph[]
  readonly sourceArtifacts?: readonly SourceArtifact[]
}

export type PersistedSourceGraph = {
  readonly source: Source
  readonly snapshot: SourceSnapshot
  readonly evidence: readonly Evidence[]
  readonly routings: readonly EvidenceRouting[]
}

export type PersistIngestionResult =
  | {
      readonly status: "persisted"
      readonly runId: IngestionRunId
      readonly snapshotId: SourceSnapshotId
    }
  | {
      readonly status: "duplicate"
      readonly existingSnapshotId: SourceSnapshotId
    }

export type PersistedIngestionGraph = {
  readonly brand: PersistedBrand
  readonly run: CompletedIngestionRun
  readonly source: Source
  readonly snapshot: SourceSnapshot
  readonly evidence: readonly Evidence[]
  readonly routings: readonly EvidenceRouting[]
  readonly knowledgeProposals: readonly KnowledgeMutationProposal[]
  readonly knowledgeClaims: readonly KnowledgeClaim[]
  readonly supportingSources: readonly PersistedSourceGraph[]
  readonly sourceArtifacts: readonly SourceArtifact[]
}

export interface IngestionStore {
  persist(batch: IngestionPersistenceBatch): Promise<PersistIngestionResult>
  loadBySnapshotId(
    snapshotId: SourceSnapshotId,
  ): Promise<PersistedIngestionGraph | undefined>
}
