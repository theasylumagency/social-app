import { createHash, randomUUID } from "node:crypto"

import { ingestSocialManualBrandProfile } from "../../blueprints/social/ingestion/manual-profile"
import type { SocialManualKnowledgeInput } from "../../blueprints/social/ingestion/manual-profile"
import {
  ingestSocialWebsiteProfile,
  type SocialWebsiteKnowledgeCitations,
} from "../../blueprints/social/ingestion/website-profile"
import { createIsoDateTime } from "../../core/domain/primitives"
import type {
  BrandId,
  ContentHash,
  EvidenceId,
  IngestionRunId,
  SourceArtifactId,
  SourceId,
  SourceSnapshotId,
} from "../../core/domain/primitives"
import type { SourceArtifact } from "../../core/domain/source-artifact"
import type { MinimumViableBrandStatus } from "../../core/domain/operation"
import type {
  IngestionStore,
  PersistIngestionResult,
} from "../../core/persistence/ingestion-store"
import type { BrandOnboardingInput } from "./schema"

export type CreateBrandOnboardingOptions = {
  readonly now?: () => Date
  readonly createOperationId?: () => string
  readonly websiteCapture?: WebsiteSourceCapture
  readonly existingBrand?: { readonly id: BrandId; readonly createdAt: string }
  readonly preservedIdentity?: Pick<SocialManualKnowledgeInput, "identityIndustry" | "identityLocations" | "identitySocialAccounts">
}

export type WebsiteSourceCapture = {
  readonly requestedUrl: string
  readonly finalUrl: string
  readonly pageTitle?: string
  readonly warnings?: readonly string[]
  readonly knowledge: SocialManualKnowledgeInput
  readonly citations?: SocialWebsiteKnowledgeCitations
  readonly logo?: {
    readonly finalUrl: string
    readonly mediaType: SourceArtifact["mediaType"]
    readonly contentHash: ContentHash
    readonly content: Uint8Array
  }
}

export type BrandOnboardingResult = {
  readonly brandId: BrandId
  readonly sourceId: SourceId
  readonly snapshotId: SourceSnapshotId
  readonly persistence: PersistIngestionResult["status"]
  readonly minimumViableBrand: MinimumViableBrandStatus
  readonly evidenceCount: number
  readonly proposalCount: number
  readonly sourceCount: number
  readonly websiteEvidenceCount: number
  readonly logoAssetCount: number
}

function toKnowledge(input: BrandOnboardingInput): SocialManualKnowledgeInput {
  return {
    identityName: input.businessName,
    identityLanguages: [input.language],
    offerPrimaryServices: input.services,
    ...(input.industry === undefined
      ? {}
      : { identityIndustry: input.industry }),
    ...(input.description === undefined
      ? {}
      : { identityShortDescription: input.description }),
    ...(input.website === undefined ? {} : { identityWebsite: input.website }),
    ...(input.facebookPage === undefined
      ? {}
      : { identitySocialAccounts: [input.facebookPage] }),
    ...(input.location === undefined
      ? {}
      : { identityLocations: [input.location] }),
    ...(input.audiences === undefined
      ? {}
      : { audiencePrimarySegments: input.audiences }),
    ...(input.tones === undefined ? {} : { voicePrimaryTone: input.tones }),
    ...(input.goals === undefined ? {} : { contentGoals: input.goals }),
    ...(input.avoidTopics === undefined
      ? {}
      : { constraintsSensitiveTopics: input.avoidTopics }),
  }
}

function contentHash(knowledge: SocialManualKnowledgeInput): ContentHash {
  const digest = createHash("sha256")
    .update(JSON.stringify({ version: "social.manual-profile.v1", knowledge }))
    .digest("hex")
  return `sha256:${digest}` as ContentHash
}

function websiteContentHash(capture: WebsiteSourceCapture): ContentHash {
  const digest = createHash("sha256")
    .update(
      JSON.stringify({
        version: "social.website-profile.v2",
        finalUrl: capture.finalUrl,
        knowledge: capture.knowledge,
        citations: capture.citations,
      }),
    )
    .digest("hex")
  return `sha256:${digest}` as ContentHash
}

function matchingWebsiteEvidence(
  manualKnowledge: SocialManualKnowledgeInput,
  websiteCapture: WebsiteSourceCapture,
  evidenceByKnowledgeField: Readonly<
    Partial<Record<keyof SocialManualKnowledgeInput, readonly EvidenceId[]>>
  >,
): Readonly<Partial<Record<keyof SocialManualKnowledgeInput, readonly EvidenceId[]>>> {
  const matching: Partial<
    Record<keyof SocialManualKnowledgeInput, readonly EvidenceId[]>
  > = {}
  for (const [field, evidenceIds] of Object.entries(evidenceByKnowledgeField)) {
    const knowledgeField = field as keyof SocialManualKnowledgeInput
    if (
      evidenceIds !== undefined &&
      JSON.stringify(manualKnowledge[knowledgeField]) ===
        JSON.stringify(websiteCapture.knowledge[knowledgeField])
    ) {
      matching[knowledgeField] = evidenceIds
    }
  }
  return matching
}

export async function createBrandOnboarding(
  input: BrandOnboardingInput,
  store: IngestionStore,
  {
    now = () => new Date(),
    createOperationId = randomUUID,
    websiteCapture,
    existingBrand,
    preservedIdentity,
  }: CreateBrandOnboardingOptions = {},
): Promise<BrandOnboardingResult> {
  const operationId = createOperationId()
  const occurredAt = createIsoDateTime(now().toISOString())
  const brandId = existingBrand?.id ?? `brand:${operationId}` as BrandId
  const sourceId = `source:${operationId}` as SourceId
  const snapshotId = `snapshot:${operationId}` as SourceSnapshotId
  const runId = `run:${operationId}` as IngestionRunId
  const knowledge = { ...preservedIdentity, ...toKnowledge(input) }
  let evidenceSequence = 0

  const websiteIngestion =
    websiteCapture === undefined
      ? undefined
      : ingestSocialWebsiteProfile({
          brandId,
          sourceId: `source:${operationId}:website` as SourceId,
          snapshotId: `snapshot:${operationId}:website` as SourceSnapshotId,
          capturedAt: occurredAt,
          contentHash: websiteContentHash(websiteCapture),
          requestedUrl: websiteCapture.requestedUrl,
          finalUrl: websiteCapture.finalUrl,
          ...(websiteCapture.pageTitle === undefined
            ? {}
            : { pageTitle: websiteCapture.pageTitle }),
          ...(websiteCapture.warnings === undefined
            ? {}
            : { warnings: websiteCapture.warnings }),
          knowledge: websiteCapture.knowledge,
          ...(websiteCapture.citations === undefined
            ? {}
            : { citations: websiteCapture.citations }),
          createEvidenceId: () =>
            `evidence:${operationId}:${evidenceSequence++}` as EvidenceId,
        })

  const ingestion = ingestSocialManualBrandProfile({
    brandId,
    sourceId,
    snapshotId,
    capturedAt: occurredAt,
    contentHash: contentHash(knowledge),
    sourceLabel: "Business onboarding",
    knowledge,
    ...(websiteIngestion === undefined || websiteCapture === undefined
      ? {}
      : {
          parentEvidenceIdsByKnowledgeField: matchingWebsiteEvidence(
            knowledge,
            websiteCapture,
            websiteIngestion.evidenceByKnowledgeField,
          ),
        }),
    createEvidenceId: () =>
      `evidence:${operationId}:${evidenceSequence++}` as EvidenceId,
  })

  const sourceArtifacts: SourceArtifact[] = []
  if (websiteCapture?.logo !== undefined && websiteIngestion !== undefined) {
    sourceArtifacts.push({
      id: `artifact:${operationId}:logo` as SourceArtifactId,
      brandId,
      sourceId: websiteIngestion.source.id,
      snapshotId: websiteIngestion.snapshot.id,
      kind: "image",
      role: "logoCandidate",
      mediaType: websiteCapture.logo.mediaType,
      contentHash: websiteCapture.logo.contentHash,
      byteSize: websiteCapture.logo.content.byteLength,
      content: websiteCapture.logo.content,
      sourceUrl: websiteCapture.logo.finalUrl,
      createdAt: occurredAt,
    })
  }

  const persistence = await store.persist({
    brand: { id: brandId, createdAt: existingBrand ? createIsoDateTime(existingBrand.createdAt) : occurredAt },
    run: {
      id: runId,
      brandId,
      sourceId,
      snapshotId,
      status: "completed",
      startedAt: occurredAt,
      completedAt: occurredAt,
      minimumViableBrand: ingestion.minimumViableBrand,
    },
    source: ingestion.source,
    snapshot: ingestion.snapshot,
    evidence: ingestion.evidence,
    routings: ingestion.routings,
    knowledgeProposals: ingestion.knowledgeProposals,
    ...(websiteIngestion === undefined
      ? {}
      : {
          supportingSources: [
            {
              source: websiteIngestion.source,
              snapshot: websiteIngestion.snapshot,
              evidence: websiteIngestion.evidence,
              routings: websiteIngestion.routings,
            },
          ],
        }),
    ...(sourceArtifacts.length === 0 ? {} : { sourceArtifacts }),
  })

  return {
    brandId,
    sourceId,
    snapshotId:
      persistence.status === "duplicate"
        ? persistence.existingSnapshotId
        : persistence.snapshotId,
    persistence: persistence.status,
    minimumViableBrand: ingestion.minimumViableBrand,
    evidenceCount: ingestion.evidence.length,
    proposalCount: ingestion.knowledgeProposals.length,
    sourceCount: websiteIngestion === undefined ? 1 : 2,
    websiteEvidenceCount: websiteIngestion?.evidence.length ?? 0,
    logoAssetCount: sourceArtifacts.length,
  }
}
