import type {
  BrandId,
  BusinessFactId,
  EvidenceId,
  IsoDateTime,
  KnowledgeClaimId,
  ProofId,
  ProofType,
} from "./primitives"
import type { FreshnessAssessment } from "./freshness"

export type ProofSubject =
  | { readonly kind: "knowledgeClaim"; readonly claimId: KnowledgeClaimId }
  | { readonly kind: "businessFact"; readonly factId: BusinessFactId }

export type ProofLifecycle = "active" | "inactive"

export type Proof = {
  readonly id: ProofId
  readonly brandId: BrandId
  readonly type: ProofType
  readonly subject: ProofSubject
  readonly evidenceIds: readonly [EvidenceId, ...EvidenceId[]]
  readonly lifecycle: ProofLifecycle
  readonly createdAt: IsoDateTime
}

export type ProofSupportStatus = "sufficient" | "insufficient" | "unknown"

export type ProofAssessment = {
  readonly proofId: ProofId
  readonly supportStatus: ProofSupportStatus
  readonly freshness: FreshnessAssessment
  readonly policyVersion: string
  readonly assessedAt: IsoDateTime
}
