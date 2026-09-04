import type {
  EpistemicStatus,
  EvidenceId,
  KnowledgeClaimId,
  KnowledgePath,
} from "./primitives"
import type { KnowledgeClaimContext } from "./knowledge-context"
import type { KnowledgeClaimProvenanceRef } from "./knowledge"

export type ProposedKnowledgeValue = {
  readonly value: unknown
  readonly context?: KnowledgeClaimContext
  readonly epistemicStatus: EpistemicStatus
  readonly provenance: readonly KnowledgeClaimProvenanceRef[]
}

export type ProposeSet = {
  readonly kind: "proposeSet"
  readonly path: KnowledgePath
  readonly proposed: ProposedKnowledgeValue
}

export type ProposeAdd = {
  readonly kind: "proposeAdd"
  readonly path: KnowledgePath
  readonly proposed: ProposedKnowledgeValue
}

export type ProposeDeactivate = {
  readonly kind: "proposeDeactivate"
  readonly claimId: KnowledgeClaimId
  readonly reason?: string
}

export type ProposeReplace = {
  readonly kind: "proposeReplace"
  readonly claimId: KnowledgeClaimId
  readonly replacement: ProposedKnowledgeValue
  readonly reason?: string
}

export type ProposeContextualize = {
  readonly kind: "proposeContextualize"
  readonly claimId: KnowledgeClaimId
  readonly context: KnowledgeClaimContext
  readonly provenance: readonly KnowledgeClaimProvenanceRef[]
  readonly reason?: string
}

export type FlagConflict = {
  readonly kind: "flagConflict"
  readonly path: KnowledgePath
  readonly claimIds: readonly KnowledgeClaimId[]
  readonly evidenceIds?: readonly EvidenceId[]
  readonly reason: string
}

export type KnowledgeMutationProposal =
  | ProposeSet
  | ProposeAdd
  | ProposeDeactivate
  | ProposeReplace
  | ProposeContextualize
  | FlagConflict

export type MutationValidationResult =
  | { readonly status: "accepted" }
  | { readonly status: "rejected"; readonly reason: string }
  | { readonly status: "requiresResolution"; readonly reason: string }

export type KnowledgeMutationResult = {
  readonly createdClaimIds: readonly KnowledgeClaimId[]
  readonly deactivatedClaimIds: readonly KnowledgeClaimId[]
}
