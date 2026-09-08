import type { BrandDossier } from "../brand-discovery/model"
import type { JsonSchema } from "../brand-discovery/schemas"

export const REVISION_REASONS = ["founderFeedback", "performanceEvidence", "businessPriority", "marketChange", "brandEvidence", "approachFailure"] as const
export type RevisionReason = typeof REVISION_REASONS[number]
export type SocialPresence = "active" | "infrequent" | "empty" | "notFound" | "unknown"
export type ReconSource = { channel: string; url: string | null; capturedAt: string; text: string; availability: "accessible" | "notFound" | "unknown" }
export type SocialStrategyProposal = {
  objective: string; rationale: string; horizon: string
  reconnaissance: { channel: string; status: SocialPresence; observation: string; sourceUrl: string | null; excerpt: string | null }[]
  channels: { channel: string; action: "continue" | "activate" | "add" | "deprioritize" | "doNotUse"; role: string; reason: string }[]
  plan: { audienceChange: string; barriers: string[]; proofNeeds: string[]; contentRoles: string[]; journey: string; commercialBridge: string; mustNotClaim: string[] }
  measurement: { level: "public" | "connected" | "downstream"; signal: string; interpretation: string }[]
}
export type WeekEvidence = {
  week: string; reviewedAt: string; availability: "available" | "unavailable"
  observations: { level: "public" | "connected" | "downstream"; observation: string; source: string }[]
  execution: string[]; unknowns: string[]; businessContext: string
}
export type StrategyPayload = {
  basis: BrandDossier; sources: ReconSource[] | null; proposal: SocialStrategyProposal | null
  previousProposal: SocialStrategyProposal | null; reason: RevisionReason | null; comment: string
  approvedAt: string | null
}
export type SocialStrategy = {
  id: string; brandId: string; ownerId: string; revision: number
  status: "queued" | "running" | "proposed" | "approved" | "superseded" | "failed"
  payload: StrategyPayload; error: string | null; createdAt: string; updatedAt: string
}
export type StrategyView = { latest: SocialStrategy | null; active: SocialStrategy | null; legacy: boolean }
const text = { type: "string", minLength: 1, maxLength: 1200 }
const nullableText = { type: ["string", "null"], maxLength: 1200 }
const list = { type: "array", minItems: 1, maxItems: 8, items: text }
const object = (properties: Record<string, unknown>): JsonSchema => ({ type: "object", additionalProperties: false, properties, required: Object.keys(properties) })
export const STRATEGY_SCHEMA = object({
  objective: text, rationale: text, horizon: text,
  reconnaissance: { type: "array", minItems: 2, maxItems: 8, items: object({ channel: text, status: { type: "string", enum: ["active", "infrequent", "empty", "notFound", "unknown"] }, observation: text, sourceUrl: nullableText, excerpt: nullableText }) },
  channels: { type: "array", minItems: 2, maxItems: 8, items: object({ channel: text, action: { type: "string", enum: ["continue", "activate", "add", "deprioritize", "doNotUse"] }, role: text, reason: text }) },
  plan: object({ audienceChange: text, barriers: list, proofNeeds: list, contentRoles: list, journey: text, commercialBridge: text, mustNotClaim: list }),
  measurement: { type: "array", minItems: 1, maxItems: 12, items: object({ level: { type: "string", enum: ["public", "connected", "downstream"] }, signal: text, interpretation: text }) },
})
export function assertStrategyRevision(active: SocialStrategy | null, reason: unknown, comment: unknown): asserts reason is RevisionReason {
  if (!REVISION_REASONS.includes(reason as RevisionReason) || typeof comment !== "string" || comment.trim().length < 10 || comment.length > 3000) throw Error("მიუთითეთ ცვლილების მიზეზი და 10–3000 სიმბოლოს განმარტება.")
  if (active && reason === "founderFeedback") throw Error("მოქმედი სტრატეგიის ცვლილებას ახალი მტკიცებულება ან ბიზნესკონტექსტი სჭირდება.")
}
export function validateStrategyProposal(p: SocialStrategyProposal, sources: ReconSource[]) {
  const errors: string[] = []
  const seen = new Set<string>()
  for (const r of p.reconnaissance) {
    if (seen.has(r.channel)) errors.push("Assess each channel once")
    seen.add(r.channel)
    const source = sources.find((s) => s.channel === r.channel)
    if (!source || source.availability === "unknown") {
      if (r.status !== "unknown" || r.excerpt !== null) errors.push("Missing or inaccessible input must remain unknown")
    } else if (source.availability === "notFound") {
      if (r.status !== "notFound") errors.push("Search absence is not evidence of nonexistence")
    } else if (r.status !== "unknown" && (!r.excerpt || !source.text.includes(r.excerpt))) errors.push("Observed presence requires a verbatim public source excerpt")
    if (r.sourceUrl !== (source?.url ?? null)) errors.push("Use only the supplied channel source URL")
  }
  for (const channel of ["facebook", "instagram"]) {
    if (!seen.has(channel) || !p.channels.some((c) => c.channel === channel)) errors.push(`Assess and recommend ${channel}`)
  }
  // Private metrics can be future measurement criteria, never reconnaissance claims.
  if (p.reconnaissance.some((r) => /\b(reach|impressions|saves|attribution|demographics)\b\s*[:=]\s*\d/iu.test(r.observation))) errors.push("Public observations cannot assert private metrics")
  return errors
}
