import type {
  BrandId,
  BusinessFactProvenanceRef,
  DismissedKnowledgeConflict,
  Evidence,
  EvidenceId,
  ExtractedEvidenceProposal,
  IsoDateTime,
  KnowledgeClaim,
  KnowledgeClaimContext,
  KnowledgeConflictBase,
  Proof,
  ResolvedKnowledgeConflict,
  WriterContext,
} from "../src/core/domain"
import type { SocialExtractionProfile } from "../src/blueprints/social"

type Assert<T extends true> = T
type AssertFalse<T extends false> = T
type HasKey<T, Key extends PropertyKey> = Key extends keyof T ? true : false

type _EvidenceHasNoPathCandidates = AssertFalse<HasKey<Evidence, "pathCandidates">>
type _EvidenceHasNoNormalizedValue = AssertFalse<HasKey<Evidence, "normalizedValue">>
type _EvidenceHasNoKnowledgePath = AssertFalse<HasKey<Evidence, "knowledgePath">>
type _EvidenceHasNoProofType = AssertFalse<HasKey<Evidence, "proofType">>
type _EvidenceHasNoBusinessFactType = AssertFalse<HasKey<Evidence, "businessFactType">>

type _ProposalHasNoPathCandidates = AssertFalse<
  HasKey<ExtractedEvidenceProposal, "pathCandidates">
>
type _ProposalHasNoNormalizedValue = AssertFalse<
  HasKey<ExtractedEvidenceProposal, "normalizedValue">
>

type _PersistentClaimHasNoConfidence = AssertFalse<HasKey<KnowledgeClaim, "confidence">>
type _PersistentClaimHasNoFreshness = AssertFalse<HasKey<KnowledgeClaim, "freshness">>
type _PersistentClaimHasNoPermission = AssertFalse<
  HasKey<KnowledgeClaim, "generationPermission">
>
type _PersistentClaimHasNoProofIds = AssertFalse<HasKey<KnowledgeClaim, "proofIds">>

type _WriterHasNoConfidence = AssertFalse<HasKey<WriterContext, "confidence">>
type _WriterHasNoEpistemicStatus = AssertFalse<HasKey<WriterContext, "epistemicStatus">>
type _WriterHasNoEvidence = AssertFalse<HasKey<WriterContext, "evidence">>
type _WriterHasNoConflicts = AssertFalse<HasKey<WriterContext, "conflicts">>

type _BusinessFactCannotHaveHypothesisProvenance = Assert<
  Extract<BusinessFactProvenanceRef, { readonly kind: "hypothesis" }> extends never
    ? true
    : false
>

type _ExtractionProfileHasNoAllowedPaths = AssertFalse<
  HasKey<SocialExtractionProfile, "allowedPaths">
>

// @ts-expect-error An absent context means general; a present context cannot be empty.
const emptyContext: KnowledgeClaimContext = {}
void emptyContext

declare const evidenceId: EvidenceId
declare const brandId: BrandId
declare const conflictBase: KnowledgeConflictBase
declare const resolvedAt: IsoDateTime

const nonEmptyEvidence: Proof["evidenceIds"] = [evidenceId]
void nonEmptyEvidence

// @ts-expect-error Proof requires at least one Evidence reference.
const emptyEvidence: Proof["evidenceIds"] = []
void emptyEvidence

// @ts-expect-error Branded IDs from different domains are not interchangeable.
const wrongId: EvidenceId = brandId
void wrongId

// @ts-expect-error A resolved conflict requires an explicit resolution pointer.
const incompleteResolution: ResolvedKnowledgeConflict = {
  ...conflictBase,
  status: "resolved",
  resolvedAt,
}
void incompleteResolution

// @ts-expect-error A dismissed conflict requires a dismissal reason.
const incompleteDismissal: DismissedKnowledgeConflict = {
  ...conflictBase,
  status: "dismissed",
  resolvedAt,
}
void incompleteDismissal

declare const evidence: Evidence
// @ts-expect-error Persistent domain records are readonly.
evidence.value = "changed"
