import type {
  BrandId,
  Evidence,
  EvidenceId,
  ExtractedEvidenceProposal,
  SourceSnapshotId,
} from "../domain"

export type MaterializedEvidence = {
  readonly localRef: string
  readonly proposal: ExtractedEvidenceProposal
  readonly evidence: Evidence
}

export type EvidenceIdFactory = (
  localRef: string,
  proposal: ExtractedEvidenceProposal,
) => EvidenceId

export type MaterializeEvidenceInput = {
  readonly brandId: BrandId
  readonly snapshotId: SourceSnapshotId
  readonly proposals: readonly ExtractedEvidenceProposal[]
  readonly createEvidenceId: EvidenceIdFactory
}

export function materializeEvidence({
  brandId,
  snapshotId,
  proposals,
  createEvidenceId,
}: MaterializeEvidenceInput): readonly MaterializedEvidence[] {
  const localRefs = new Set<string>()
  const evidenceIds = new Set<EvidenceId>()

  return proposals.map((proposal) => {
    if (proposal.localRef.trim().length === 0) {
      throw new RangeError("Evidence proposal localRef cannot be empty")
    }
    if (localRefs.has(proposal.localRef)) {
      throw new RangeError(`Duplicate evidence proposal localRef: ${proposal.localRef}`)
    }
    localRefs.add(proposal.localRef)

    const id = createEvidenceId(proposal.localRef, proposal)
    if (evidenceIds.has(id)) {
      throw new RangeError(`Evidence ID factory returned a duplicate ID for ${proposal.localRef}`)
    }
    evidenceIds.add(id)

    const evidence: Evidence = {
      id,
      brandId,
      snapshotId,
      type: proposal.type,
      sourceClaimMode: proposal.sourceClaimMode,
      value: proposal.value,
      evidenceStrength: proposal.evidenceStrength,
      ...(proposal.excerpt === undefined ? {} : { excerpt: proposal.excerpt }),
      ...(proposal.locator === undefined ? {} : { locator: proposal.locator }),
      ...(proposal.temporalMetadata === undefined
        ? {}
        : { temporalMetadata: proposal.temporalMetadata }),
    }

    return {
      localRef: proposal.localRef,
      proposal,
      evidence,
    }
  })
}
