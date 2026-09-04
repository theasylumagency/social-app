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
  Source,
  SourceId,
  SourceSnapshot,
  SourceSnapshotId,
} from "../../../core/domain"
import { materializeEvidence, routeEvidence } from "../../../core/ingestion"
import { getSocialKnowledgePathPolicy } from "../knowledge-paths"
import {
  SOCIAL_KNOWLEDGE_PATHS,
  SOCIAL_SOURCE_KINDS,
  type SocialKnowledgePath,
} from "../tokens"
import type {
  SocialManualKnowledgeField,
  SocialManualKnowledgeInput,
} from "./manual-profile"

export type SocialWebsiteProfileIngestionInput = {
  readonly brandId: BrandId
  readonly sourceId: SourceId
  readonly snapshotId: SourceSnapshotId
  readonly capturedAt: IsoDateTime
  readonly contentHash: ContentHash
  readonly requestedUrl: string
  readonly finalUrl: string
  readonly pageTitle?: string
  readonly warnings?: readonly string[]
  readonly knowledge: SocialManualKnowledgeInput
  readonly citations?: SocialWebsiteKnowledgeCitations
  readonly createEvidenceId: (
    localRef: string,
    proposal: ExtractedEvidenceProposal,
  ) => EvidenceId
}

export type SocialWebsiteKnowledgeCitation = {
  readonly value: JsonValue
  readonly sourceUrl: string
  readonly exactExcerpt: string
  readonly confidence: "high" | "medium" | "low"
}

export type SocialWebsiteKnowledgeCitations = Readonly<
  Partial<
    Record<SocialManualKnowledgeField, readonly SocialWebsiteKnowledgeCitation[]>
  >
>

export type SocialWebsiteProfileIngestionResult = {
  readonly source: Source
  readonly snapshot: SourceSnapshot
  readonly extractedEvidence: readonly ExtractedEvidenceProposal[]
  readonly evidence: readonly Evidence[]
  readonly routings: readonly EvidenceRouting[]
  readonly evidenceByKnowledgeField: Readonly<
    Partial<Record<SocialManualKnowledgeField, readonly EvidenceId[]>>
  >
}

type RoutedProposal = {
  readonly field: SocialManualKnowledgeField
  readonly path: SocialKnowledgePath
  readonly proposal: ExtractedEvidenceProposal
}

function evidenceTypeFor(field: SocialManualKnowledgeField): EvidenceType {
  const policy = getSocialKnowledgePathPolicy(SOCIAL_KNOWLEDGE_PATHS[field])
  return policy?.usage === "publicFact" || policy?.usage === "reference"
    ? "fact"
    : "claim"
}

function proposalsForKnowledge(
  knowledge: SocialManualKnowledgeInput,
  citations: SocialWebsiteKnowledgeCitations,
): readonly RoutedProposal[] {
  const proposals: RoutedProposal[] = []

  for (const [untrustedField, value] of Object.entries(knowledge)) {
    if (value === undefined || !(untrustedField in SOCIAL_KNOWLEDGE_PATHS)) {
      continue
    }
    const field = untrustedField as SocialManualKnowledgeField
    const path = SOCIAL_KNOWLEDGE_PATHS[field]
    const values = Array.isArray(value) ? value : [value]

    values.forEach((item, index) => {
      const fieldCitations = citations[field] ?? []
      const citationIndex = fieldCitations.findIndex(
        (candidate) => JSON.stringify(candidate.value) === JSON.stringify(item),
      )
      const citation = citationIndex < 0 ? undefined : fieldCitations[citationIndex]
      const locatorPath: (string | number)[] = citation === undefined
        ? ["knowledge", field, ...(Array.isArray(value) ? [index] : [])]
        : ["citations", field, citationIndex]
      proposals.push({
        field,
        path,
        proposal: {
          localRef: `website.${field}.${index}`,
          type: evidenceTypeFor(field),
          sourceClaimMode: "explicit",
          value: item,
          evidenceStrength:
            citation?.confidence === "high"
              ? "strong"
              : citation?.confidence === "low"
                ? "weak"
                : "medium",
          ...(citation === undefined ? {} : { excerpt: citation.exactExcerpt }),
          locator: { kind: "structuredPath", path: locatorPath },
          semanticHints: ["website", path],
        },
      })
    })
  }
  return proposals
}

function snapshotCitations(
  citations: SocialWebsiteKnowledgeCitations,
): Readonly<Record<string, JsonValue>> {
  const result: Record<string, JsonValue> = {}
  for (const [field, values] of Object.entries(citations)) {
    if (values !== undefined && values.length > 0) {
      result[field] = values.map((citation) => ({
        value: citation.value,
        sourceUrl: citation.sourceUrl,
        exactExcerpt: citation.exactExcerpt,
        confidence: citation.confidence,
      }))
    }
  }
  return result
}

function snapshotKnowledge(
  knowledge: SocialManualKnowledgeInput,
): Readonly<Record<string, JsonValue>> {
  const result: Record<string, JsonValue> = {}
  for (const [field, value] of Object.entries(knowledge)) {
    if (value !== undefined) {
      result[field] = value
    }
  }
  return result
}

export function ingestSocialWebsiteProfile({
  brandId,
  sourceId,
  snapshotId,
  capturedAt,
  contentHash,
  requestedUrl,
  finalUrl,
  pageTitle,
  warnings = [],
  knowledge,
  citations = {},
  createEvidenceId,
}: SocialWebsiteProfileIngestionInput): SocialWebsiteProfileIngestionResult {
  const routedProposals = proposalsForKnowledge(knowledge, citations)
  const extractedEvidence = routedProposals.map((item) => item.proposal)
  const pathByLocalRef = new Map(
    routedProposals.map((item) => [item.proposal.localRef, item.path] as const),
  )
  const fieldByLocalRef = new Map(
    routedProposals.map((item) => [item.proposal.localRef, item.field] as const),
  )
  const materialized = materializeEvidence({
    brandId,
    snapshotId,
    proposals: extractedEvidence,
    createEvidenceId,
  })
  const routings = routeEvidence({
    items: materialized,
    routingVersion: "social.website-routing.v1",
    resolveTargets: (item) => {
      const path = pathByLocalRef.get(item.localRef)
      return path === undefined
        ? []
        : [{ target: { kind: "knowledgePath", path }, support: "direct" }]
    },
  })
  const evidenceByKnowledgeField: Partial<
    Record<SocialManualKnowledgeField, EvidenceId[]>
  > = {}
  for (const item of materialized) {
    const field = fieldByLocalRef.get(item.localRef)
    if (field !== undefined) {
      const existing = evidenceByKnowledgeField[field] ?? []
      existing.push(item.evidence.id)
      evidenceByKnowledgeField[field] = existing
    }
  }

  const source: Source = {
    id: sourceId,
    brandId,
    kind: SOCIAL_SOURCE_KINDS.website,
    reference: { kind: "url", url: finalUrl },
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
      data: {
        knowledge: snapshotKnowledge(knowledge),
        citations: snapshotCitations(citations),
      },
      mediaType: "application/vnd.unda.website-profile+json",
    },
    sourceMetadata: {
      ...(pageTitle === undefined ? {} : { title: pageTitle }),
      attributes: {
        requestedUrl,
        finalUrl,
        extractionVersion: "social.website-profile.v2",
        warnings,
      },
    },
  }

  return {
    source,
    snapshot,
    extractedEvidence,
    evidence: materialized.map((item) => item.evidence),
    routings,
    evidenceByKnowledgeField,
  }
}
