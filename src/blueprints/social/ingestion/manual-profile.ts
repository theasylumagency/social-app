import type {
  BrandId,
  ContentHash,
  Evidence,
  EvidenceId,
  EvidenceRouting,
  EvidenceType,
  ExtractedEvidenceProposal,
  IsoDateTime,
  JsonValue,
  KnowledgeMutationProposal,
  MinimumViableBrandStatus,
  Source,
  SourceId,
  SourceSnapshot,
  SourceSnapshotId,
} from "../../../core/domain"
import {
  compileKnowledgeProposals,
  materializeEvidence,
  routeEvidence,
} from "../../../core/ingestion"
import { SOCIAL_OPERATOR_DEFAULTS } from "../defaults"
import {
  evaluateSocialMinimumViableBrand,
  getSocialKnowledgePathPolicy,
  type SocialKnowledgePathPolicy,
} from "../knowledge-paths"
import {
  SOCIAL_KNOWLEDGE_PATHS,
  SOCIAL_SOURCE_KINDS,
  type SocialKnowledgePath,
} from "../tokens"

export type SocialManualKnowledgeField = keyof typeof SOCIAL_KNOWLEDGE_PATHS

export type SocialManualKnowledgeInput = Partial<
  Readonly<Record<SocialManualKnowledgeField, JsonValue>>
>

export type SocialManualBrandIngestionInput = {
  readonly brandId: BrandId
  readonly sourceId: SourceId
  readonly snapshotId: SourceSnapshotId
  readonly capturedAt: IsoDateTime
  readonly contentHash: ContentHash
  readonly sourceLabel?: string
  readonly knowledge: SocialManualKnowledgeInput
  readonly parentEvidenceIdsByKnowledgeField?: Readonly<
    Partial<Record<SocialManualKnowledgeField, readonly EvidenceId[]>>
  >
  readonly createEvidenceId: (
    localRef: string,
    proposal: ExtractedEvidenceProposal,
  ) => EvidenceId
}

export type SocialManualBrandIngestionResult = {
  readonly source: Source
  readonly snapshot: SourceSnapshot
  readonly extractedEvidence: readonly ExtractedEvidenceProposal[]
  readonly evidence: readonly Evidence[]
  readonly routings: readonly EvidenceRouting[]
  readonly knowledgeProposals: readonly KnowledgeMutationProposal[]
  readonly minimumViableBrand: MinimumViableBrandStatus
}

type RoutedProposal = {
  readonly proposal: ExtractedEvidenceProposal
  readonly path: SocialKnowledgePath
}

function assertJsonValue(value: unknown, seen: WeakSet<object>): asserts value is JsonValue {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "boolean"
  ) {
    return
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new TypeError("Manual knowledge values must contain only finite numbers")
    }
    return
  }
  if (typeof value !== "object") {
    throw new TypeError("Manual knowledge values must be JSON-compatible")
  }
  if (seen.has(value)) {
    throw new TypeError("Manual knowledge values cannot contain cycles")
  }
  seen.add(value)

  if (Array.isArray(value)) {
    for (const item of value) {
      assertJsonValue(item, seen)
    }
  } else {
    const prototype = Object.getPrototypeOf(value)
    if (prototype !== Object.prototype && prototype !== null) {
      throw new TypeError("Manual knowledge objects must be plain JSON objects")
    }
    for (const item of Object.values(value)) {
      assertJsonValue(item, seen)
    }
  }

  seen.delete(value)
}

function assertUsableScalar(value: JsonValue, field: string): void {
  if (value === null) {
    throw new RangeError(`${field} cannot be null; omit unknown knowledge instead`)
  }
  if (typeof value === "string" && value.trim().length === 0) {
    throw new RangeError(`${field} cannot contain an empty string`)
  }
}

function evidenceTypeFor(policy: SocialKnowledgePathPolicy): EvidenceType {
  return policy.usage === "publicFact" || policy.usage === "reference"
    ? "fact"
    : "claim"
}

function extractField(
  field: SocialManualKnowledgeField,
  value: JsonValue,
  policy: SocialKnowledgePathPolicy,
): readonly RoutedProposal[] {
  assertJsonValue(value, new WeakSet<object>())
  const baseRef = `knowledge.${field}`

  if (policy.cardinality === "many") {
    if (!Array.isArray(value) || value.length === 0) {
      throw new RangeError(`${field} must be a non-empty array`)
    }
    return value.map((item, index) => {
      assertUsableScalar(item, `${field}[${index}]`)
      return {
        path: policy.path as SocialKnowledgePath,
        proposal: {
          localRef: `${baseRef}.${index}`,
          type: evidenceTypeFor(policy),
          sourceClaimMode: "explicit",
          value: item,
          evidenceStrength: "strong",
          semanticHints: [policy.domain],
        },
      }
    })
  }

  if (Array.isArray(value)) {
    throw new RangeError(`${field} accepts one value, not an array`)
  }
  assertUsableScalar(value, field)
  return [
    {
      path: policy.path as SocialKnowledgePath,
      proposal: {
        localRef: baseRef,
        type: evidenceTypeFor(policy),
        sourceClaimMode: "explicit",
        value,
        evidenceStrength: "strong",
        semanticHints: [policy.domain],
      },
    },
  ]
}

function extractKnowledge(
  knowledge: SocialManualKnowledgeInput,
): readonly RoutedProposal[] {
  const extracted: RoutedProposal[] = []

  for (const [untrustedField, value] of Object.entries(knowledge)) {
    if (!(untrustedField in SOCIAL_KNOWLEDGE_PATHS)) {
      throw new RangeError(`Unknown Social knowledge field: ${untrustedField}`)
    }
    if (value === undefined) {
      continue
    }

    const field = untrustedField as SocialManualKnowledgeField
    const path = SOCIAL_KNOWLEDGE_PATHS[field]
    const policy = getSocialKnowledgePathPolicy(path)
    if (policy === undefined) {
      throw new RangeError(`Missing Social knowledge policy for field: ${field}`)
    }
    extracted.push(...extractField(field, value, policy))
  }

  if (extracted.length === 0) {
    throw new RangeError("Manual Brand Profile must contain at least one knowledge value")
  }
  return extracted
}

function snapshotKnowledge(
  knowledge: SocialManualKnowledgeInput,
): Readonly<Record<string, JsonValue>> {
  const snapshot: Record<string, JsonValue> = {}
  for (const [field, value] of Object.entries(knowledge)) {
    if (value !== undefined) {
      snapshot[field] = value
    }
  }
  return snapshot
}

export function ingestSocialManualBrandProfile({
  brandId,
  sourceId,
  snapshotId,
  capturedAt,
  contentHash,
  sourceLabel,
  knowledge,
  parentEvidenceIdsByKnowledgeField = {},
  createEvidenceId,
}: SocialManualBrandIngestionInput): SocialManualBrandIngestionResult {
  const routedProposals = extractKnowledge(knowledge)
  const proposals = routedProposals.map((item) => item.proposal)
  const pathByLocalRef = new Map(
    routedProposals.map((item) => [item.proposal.localRef, item.path] as const),
  )

  const source: Source = {
    id: sourceId,
    brandId,
    kind: SOCIAL_SOURCE_KINDS.manualInput,
    reference:
      sourceLabel === undefined
        ? { kind: "manual" }
        : { kind: "manual", label: sourceLabel },
    createdAt: capturedAt,
  }

  const snapshot: SourceSnapshot = {
    id: snapshotId,
    sourceId,
    brandId,
    capturedAt,
    contentHash,
    content: {
      kind: "structured",
      data: { knowledge: snapshotKnowledge(knowledge) },
      mediaType: "application/vnd.unda.social-brand-profile+json",
    },
  }

  const materialized = materializeEvidence({
    brandId,
    snapshotId,
    proposals,
    createEvidenceId,
  })
  const routings = routeEvidence({
    items: materialized,
    routingVersion: "social.manual-routing.v1",
    resolveTargets: (item) => {
      const path = pathByLocalRef.get(item.localRef)
      return path === undefined
        ? []
        : [{ target: { kind: "knowledgePath", path }, support: "direct" }]
    },
  })
  const evidence = materialized.map((item) => {
    const field = item.localRef.split(".")[1] as SocialManualKnowledgeField | undefined
    const parentEvidenceIds =
      field === undefined ? undefined : parentEvidenceIdsByKnowledgeField[field]
    return parentEvidenceIds === undefined || parentEvidenceIds.length === 0
      ? item.evidence
      : {
          ...item.evidence,
          lineage: { parentEvidenceIds },
        }
  })
  const knowledgeProposals = compileKnowledgeProposals({
    evidence,
    routings,
    resolveMutationMode: (path) => {
      const policy = getSocialKnowledgePathPolicy(path)
      return policy === undefined
        ? undefined
        : policy.cardinality === "one"
          ? "set"
          : "add"
    },
  })
  const usablePaths = new Set(
    routings.flatMap((routing) =>
      routing.targets.flatMap((target) =>
        target.target.kind === "knowledgePath" ? [target.target.path] : [],
      ),
    ),
  )

  return {
    source,
    snapshot,
    extractedEvidence: proposals,
    evidence,
    routings,
    knowledgeProposals,
    minimumViableBrand: evaluateSocialMinimumViableBrand({
      usablePaths,
      allowOperatorVoiceDefault: SOCIAL_OPERATOR_DEFAULTS.allowVoiceFallbackForMvb,
    }),
  }
}
