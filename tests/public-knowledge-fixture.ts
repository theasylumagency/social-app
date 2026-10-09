import type { PublicKnowledgeSnapshot, RegisteredFact, RegisteredProof } from "../src/blueprints/social/public-knowledge"
export function knowledgeFixture(brandId = "brand"): PublicKnowledgeSnapshot {
  const now = "2026-10-07T10:00:00.000Z", until = "2026-11-07T10:00:00.000Z"
  const fact = { key: "fact-price", revision: 1, kind: "price", subject: "Consultation", statement: "Consultation costs 50 GEL.", permission: "publicUse", confirmedBy: "owner", updatedAt: now,
    fact: { id: "fact-price", brandId, type: "price", value: { subject: "Consultation", statement: "Consultation costs 50 GEL." }, lifecycle: "active", provenance: [{ kind: "founderDecision", founderDecisionId: "decision" }], validFrom: now, validUntil: until, createdAt: now },
    decision: { id: "decision", brandId, type: "confirmPublicFact", subject: { kind: "businessFact", factId: "fact-price" }, value: { statement: "Consultation costs 50 GEL.", permission: "publicUse", validUntil: until, actorId: "owner" }, createdAt: now } } as unknown as RegisteredFact
  const proof = { key: "proof-price", factKey: fact.key, factRevision: 1, permission: "publicUse", validUntil: until,
    proof: { id: "proof-price", brandId, type: "sourceExcerpt", subject: { kind: "businessFact", factId: fact.key }, evidenceIds: ["evidence"], lifecycle: "active", createdAt: now },
    assessment: { proofId: "proof-price", supportStatus: "sufficient", freshness: { status: "current", basis: "explicitValidity", assessedAt: now }, policyVersion: "owner-verbatim-source-v1", assessedAt: now },
    source: { evidenceId: "evidence", snapshotId: "snapshot", capturedAt: now, excerpt: "Consultation costs 50 GEL. Contact the clinic for conditions." } } as unknown as RegisteredProof
  return { version: 1, brandId, revision: 1, capturedAt: now, facts: [fact], proofs: [proof] }
}
