import type {
  BrandId,
  ContentHash,
  IsoDateTime,
  SourceArtifactId,
  SourceId,
  SourceSnapshotId,
} from "./primitives"

export type SourceArtifact = {
  readonly id: SourceArtifactId
  readonly brandId: BrandId
  readonly sourceId: SourceId
  readonly snapshotId: SourceSnapshotId
  readonly kind: "image"
  readonly role: "logoCandidate"
  readonly mediaType: "image/png" | "image/jpeg" | "image/webp" | "image/gif"
  readonly contentHash: ContentHash
  readonly byteSize: number
  readonly content: Uint8Array
  readonly sourceUrl: string
  readonly createdAt: IsoDateTime
}
