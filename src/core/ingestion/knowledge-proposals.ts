import type {
  EpistemicStatus,
  Evidence,
  EvidenceId,
  EvidenceRouting,
  KnowledgeMutationProposal,
  KnowledgePath,
  ProposedKnowledgeValue,
} from "../domain"

export type KnowledgeMutationMode = "set" | "add"
export type KnowledgeMutationModeResolver = (
  path: KnowledgePath,
) => KnowledgeMutationMode | undefined

export type CompileKnowledgeProposalsInput = {
  readonly evidence: readonly Evidence[]
  readonly routings: readonly EvidenceRouting[]
  readonly resolveMutationMode: KnowledgeMutationModeResolver
}

function deriveEpistemicStatus(evidence: Evidence): EpistemicStatus {
  if (evidence.sourceClaimMode === "explicit" && evidence.type !== "inference") {
    return "observed"
  }
  return "inferred"
}

function proposedValue(evidence: Evidence): ProposedKnowledgeValue {
  return {
    value: evidence.value,
    epistemicStatus: deriveEpistemicStatus(evidence),
    provenance: [{ kind: "evidence", evidenceId: evidence.id }],
  }
}

export function compileKnowledgeProposals({
  evidence,
  routings,
  resolveMutationMode,
}: CompileKnowledgeProposalsInput): readonly KnowledgeMutationProposal[] {
  const evidenceById = new Map<EvidenceId, Evidence>()
  for (const item of evidence) {
    if (evidenceById.has(item.id)) {
      throw new RangeError(`Duplicate Evidence ID: ${item.id}`)
    }
    evidenceById.set(item.id, item)
  }

  const routedEvidenceIds = new Set<EvidenceId>()
  const proposals: KnowledgeMutationProposal[] = []

  for (const routing of routings) {
    if (routedEvidenceIds.has(routing.evidenceId)) {
      throw new RangeError(`Duplicate EvidenceRouting for Evidence ID: ${routing.evidenceId}`)
    }
    routedEvidenceIds.add(routing.evidenceId)

    const item = evidenceById.get(routing.evidenceId)
    if (item === undefined) {
      throw new RangeError(`EvidenceRouting references unknown Evidence ID: ${routing.evidenceId}`)
    }

    for (const routingTarget of routing.targets) {
      if (routingTarget.target.kind !== "knowledgePath") {
        continue
      }

      const path = routingTarget.target.path
      const mutationMode = resolveMutationMode(path)
      if (mutationMode === undefined) {
        continue
      }

      const proposed = proposedValue(item)
      proposals.push(
        mutationMode === "set"
          ? { kind: "proposeSet", path, proposed }
          : { kind: "proposeAdd", path, proposed },
      )
    }
  }

  return proposals
}
