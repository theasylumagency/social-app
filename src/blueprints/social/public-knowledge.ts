import type { BusinessFact } from "../../core/domain/business-facts"
import type { FounderDecision } from "../../core/domain/founder-decision"
import type { Proof, ProofAssessment } from "../../core/domain/proof"
import type { GenerationPermission } from "../../core/domain/primitives"

export const PUBLIC_FACT_KINDS = ["offer", "price", "contact", "hours", "availability"] as const
export type PublicFactKind = typeof PUBLIC_FACT_KINDS[number]
export type RegisteredFact = {
  key: string; revision: number; kind: PublicFactKind; subject: string; statement: string
  fact: BusinessFact; decision: FounderDecision; permission: GenerationPermission
  confirmedBy: string; updatedAt: string
}
export type RegisteredProof = {
  key: string; factKey: string; factRevision: number; permission: GenerationPermission
  proof: Proof; assessment: ProofAssessment; validUntil: string
  source: { evidenceId: string; snapshotId: string; capturedAt: string; excerpt: string }
}
export type PublicKnowledgeSnapshot = { version: 1; brandId: string; revision: number; capturedAt: string; facts: RegisteredFact[]; proofs: RegisteredProof[] }
export type FactualReferences = { factKeys: string[]; proofKeys: string[] }
export const EMPTY_FACTUAL_REFERENCES = (): FactualReferences => ({ factKeys: [], proofKeys: [] })
export function postAuthorityReferences(post: { factKeys?: string[] }, copy: { factualReferences?: FactualReferences }, snapshot?: PublicKnowledgeSnapshot): FactualReferences {
  const factKeys = [...new Set([...(post.factKeys ?? []), ...(copy.factualReferences?.factKeys ?? [])])]
  return { factKeys, proofKeys: [...new Set([...(copy.factualReferences?.proofKeys ?? []), ...publicKnowledgeContext(snapshot, factKeys).eligibleProof.map(p => p.key)])] }
}
const instant = (s: unknown) => typeof s === "string" && Number.isFinite(Date.parse(s)) ? Date.parse(s) : NaN
const normalize = (s: string) => s.normalize("NFKC").trim().toLocaleLowerCase().replace(/\s+/gu, " ")

/** Narrow proof policy: owner-confirmed verbatim source support, never model-inferred authority. */
export function verbatimSourceSupports(statement: string, excerpt: string) {
  return normalize(statement).length >= 10 && normalize(excerpt).includes(normalize(statement))
}
export function factBlocker(entry: RegisteredFact, snapshot: PublicKnowledgeSnapshot, now: string): string | null {
  const { fact, decision } = entry
  if (fact.brandId !== snapshot.brandId || fact.id !== entry.key || decision.brandId !== fact.brandId
    || decision.subject.kind !== "businessFact" || decision.subject.factId !== fact.id
    || !entry.confirmedBy || !fact.provenance.some(p => p.kind === "founderDecision" && p.founderDecisionId === decision.id)) return "ფაქტის დადასტურების წყარო არ არსებობს."
  if (fact.lifecycle !== "active" || entry.permission === "blocked") return "ფაქტის გამოყენება შეჩერებულია."
  if (entry.permission === "internalGuidance") return "ინფორმაცია მხოლოდ შიდა გამოყენებისთვისაა."
  if (!Number.isFinite(instant(now)) || !Number.isFinite(instant(fact.validFrom)) || !Number.isFinite(instant(fact.validUntil))
    || instant(fact.validFrom) > instant(now) || instant(fact.validUntil) <= instant(now)) return "ფაქტის მოქმედების ვადა ამოიწურა ან ჯერ არ დაწყებულა."
  if (entry.permission === "publicUseWithProof" && !snapshot.proofs.some(p => proofEligible(p, entry, snapshot.brandId, now))) return "ფაქტს მოქმედი საჯარო მტკიცებულება სჭირდება."
  return entry.permission === "publicUse" || entry.permission === "publicUseWithProof" ? null : "საჯარო გამოყენების ნებართვა უცნობია."
}
export function proofEligible(p: RegisteredProof, f: RegisteredFact, brandId: string, now: string) {
  return p.factKey === f.key && p.factRevision === f.revision && p.key === p.proof.id && p.proof.brandId === brandId
    && p.proof.subject.kind === "businessFact" && p.proof.subject.factId === f.fact.id && p.proof.lifecycle === "active"
    && p.permission === "publicUse" && p.assessment.proofId === p.proof.id && p.assessment.supportStatus === "sufficient"
    && p.assessment.freshness.status === "current" && p.assessment.policyVersion === "owner-verbatim-source-v1"
    && p.proof.evidenceIds.length === 1 && p.proof.evidenceIds[0] === p.source.evidenceId && !!p.source.snapshotId
    && Number.isFinite(instant(p.source.capturedAt)) && instant(p.source.capturedAt) <= instant(now)
    && instant(p.assessment.assessedAt) <= instant(now) && instant(p.validUntil) > instant(now)
    && verbatimSourceSupports(f.statement, p.source.excerpt)
}
export function publicKnowledgeContext(snapshot?: PublicKnowledgeSnapshot, factKeys?: readonly string[]) {
  if (!snapshot) return { publicFacts: [], eligibleProof: [] }
  const facts = snapshot.facts.filter(f => (!factKeys || factKeys.includes(f.key)) && !factBlocker(f, snapshot, snapshot.capturedAt))
  return {
    publicFacts: facts.map(f => ({ key: f.key, value: { kind: f.kind, subject: f.subject, statement: f.statement }, validUntil: f.fact.validUntil })),
    eligibleProof: snapshot.proofs.filter(p => facts.some(f => proofEligible(p, f, snapshot.brandId, snapshot.capturedAt)))
      .map(p => ({ key: p.key, supportsPublicFactKeys: [p.factKey], type: p.proof.type, summary: facts.find(f => f.key === p.factKey)!.statement })),
  }
}
export function internalKnowledgeContext(snapshot?: PublicKnowledgeSnapshot) {
  if (!snapshot) return []
  return snapshot.facts.filter(f => f.permission === "internalGuidance" && f.fact.lifecycle === "active" && instant(f.fact.validFrom) <= instant(snapshot.capturedAt) && instant(f.fact.validUntil) > instant(snapshot.capturedAt))
    .map(f => ({ kind: f.kind, subject: f.subject, statement: f.statement, usage: "internalGuidanceOnly" }))
}
export function validateFactualReferences(snapshot: PublicKnowledgeSnapshot | undefined, selected: readonly string[] = [], refs?: FactualReferences): string[] {
  if (!snapshot) return selected.length || refs?.factKeys.length || refs?.proofKeys.length ? ["Public fact authority is missing"] : []
  const context = publicKnowledgeContext(snapshot, selected)
  const errors: string[] = []
  if (new Set(selected).size !== selected.length || selected.some(k => !context.publicFacts.some(f => f.key === k))) errors.push("Unknown, expired or unauthorized selected public fact")
  if (!refs || !Array.isArray(refs.factKeys) || !Array.isArray(refs.proofKeys)) return [...errors, "Factual references are required"]
  if (new Set(refs.factKeys).size !== refs.factKeys.length || refs.factKeys.some(k => !selected.includes(k))) errors.push("Use only task-selected public facts")
  if (new Set(refs.proofKeys).size !== refs.proofKeys.length || refs.proofKeys.some(k => !context.eligibleProof.some(p => p.key === k && p.supportsPublicFactKeys.some(f => refs.factKeys.includes(f))))) errors.push("Unknown or unrelated public proof")
  if (refs.factKeys.some(k => snapshot.facts.find(f => f.key === k)?.permission === "publicUseWithProof" && !refs.proofKeys.some(pk => snapshot.proofs.some(p => p.key === pk && p.factKey === k)))) errors.push("Used fact requires its public proof reference")
  return errors
}
/** Exact identities survive the model stage; revision/permission/expiry are rechecked at approval and delivery. */
export function currentFactualBlocker(saved: PublicKnowledgeSnapshot | undefined, refs: FactualReferences | undefined, current: PublicKnowledgeSnapshot, now: string): string | null {
  if (!refs) return null // Historical copies had no registry authority; no automatic grant.
  if (!saved || saved.brandId !== current.brandId) return refs.factKeys.length || refs.proofKeys.length ? "პოსტის ფაქტობრივი საფუძველი ვერ მოიძებნა." : null
  for (const key of refs.factKeys) {
    const before = saved.facts.find(f => f.key === key), after = current.facts.find(f => f.key === key)
    if (!before || !after || before.revision !== after.revision || before.statement !== after.statement || before.permission !== after.permission) return "პოსტში გამოყენებული ფაქტი შეიცვალა. განაახლეთ გეგმა და ხელახლა დაამტკიცეთ."
    const reason = factBlocker(after, current, now)
    if (reason) return reason
  }
  for (const key of refs.proofKeys) {
    const p = current.proofs.find(p => p.key === key), f = p && current.facts.find(f => f.key === p.factKey)
    if (!saved.proofs.some(p => p.key === key) || !p || !f || !refs.factKeys.includes(f.key) || !proofEligible(p, f, current.brandId, now)) return "პოსტში გამოყენებული მტკიცებულება აღარ მოქმედებს."
  }
  return null
}
