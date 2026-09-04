import type {
  BrandId,
  ContentHash,
  IsoDateTime,
  SourceArtifactId,
  SourceId,
  SourceKind,
  SourceSnapshotId,
} from "./primitives"

export type JsonPrimitive = string | number | boolean | null

export type JsonValue =
  | JsonPrimitive
  | { readonly [key: string]: JsonValue }
  | readonly JsonValue[]

export type SourceReference =
  | { readonly kind: "url"; readonly url: string }
  | {
      readonly kind: "external"
      readonly provider: string
      readonly externalId: string
    }
  | { readonly kind: "manual"; readonly label?: string }

export type Source = {
  readonly id: SourceId
  readonly brandId: BrandId
  readonly kind: SourceKind
  readonly reference: SourceReference
  readonly createdAt: IsoDateTime
}

export type SourceSnapshotContent =
  | {
      readonly kind: "text"
      readonly text: string
      readonly mediaType?: string
    }
  | {
      readonly kind: "structured"
      readonly data: JsonValue
      readonly mediaType?: string
    }
  | {
      readonly kind: "artifact"
      readonly artifactId: SourceArtifactId
      readonly mediaType?: string
    }

export type SourceSnapshotMetadata = {
  readonly sourceUpdatedAt?: IsoDateTime
  readonly language?: string
  readonly title?: string
  readonly attributes?: Readonly<Record<string, JsonValue>>
}

export type SourceSnapshot = {
  readonly id: SourceSnapshotId
  readonly sourceId: SourceId
  readonly brandId: BrandId
  readonly capturedAt: IsoDateTime
  readonly contentHash: ContentHash
  readonly content: SourceSnapshotContent
  readonly sourceMetadata?: SourceSnapshotMetadata
}
