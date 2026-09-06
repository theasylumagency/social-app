import type { AudienceHypothesis, AudienceLandscape, AudienceCommunicationProfile, CommunicationEnvelope, FounderAudienceStance, FounderProvidedAudience } from "../audience"

export type DiscoverySource = { key: string; url: string | null; title: string; text: string; capturedAt: string }
export type SourceCitation = { sourceKey: string; exactExcerpt: string }
export type GroundedSignal = SourceCitation & { statement: string }
export type BrandUnderstanding = {
  name: string
  summary: string
  businessModel: string
  positioning: string
  valueProposition: string
  offers: (SourceCitation & { name: string; description: string })[]
  distinctiveSignals: GroundedSignal[]
  audienceSignals: GroundedSignal[]
  voice: { traits: string[]; principles: string[]; examples: SourceCitation[] }
  constraints: string[]
  openQuestions: { question: string; whyItMatters: string }[]
}
export type BrandGoal = {
  id: string
  title: string
  desiredChange: string
  rationale: string
  audienceIds: string[]
  progressSignals: string[]
}
export type GoalProposal = Omit<BrandGoal, "id" | "audienceIds"> & { audienceKeys: string[] }
export type DiscoveryEvidence = { id: string; key: string; statement: string; sourceKey: string; exactExcerpt: string }
export type DiscoveryInput = { website: string; notes: string; language: "ka" | "en" }
export type DiscoveryFeedback = {
  stances: FounderAudienceStance[]
  founderAudiences: FounderProvidedAudience[]
  selectedGoalIds: string[] | null
}
export const DISCOVERY_STEPS = ["sources", "understanding", "audiences", "profiles", "envelope", "goals", "ready"] as const
export type DiscoveryStep = typeof DISCOVERY_STEPS[number]
export type DiscoveryPayload = {
  input: DiscoveryInput
  sources: DiscoverySource[]
  sourceWarnings: string[]
  understanding: BrandUnderstanding | null
  evidence: DiscoveryEvidence[]
  hypotheses: AudienceHypothesis[]
  feedback: DiscoveryFeedback
  landscape: AudienceLandscape | null
  profiles: AudienceCommunicationProfile[]
  envelope: CommunicationEnvelope | null
  goals: BrandGoal[]
}
export type DiscoverySession = {
  id: string
  ownerId: string
  brandId: string | null
  revision: number
  status: "draft" | "queued" | "running" | "ready" | "failed" | "confirmed"
  step: DiscoveryStep
  payload: DiscoveryPayload
  error: string | null
  updatedAt: string
  leaseUntil: string | null
}
export type BrandDossier = { sessionId: string; revision: number; confirmedAt: string; payload: DiscoveryPayload }

/** Keep the full source corpus on the server; the report includes verified excerpts. */
export function publicDiscoveryPayload(payload: DiscoveryPayload): DiscoveryPayload {
  return { ...payload, sources: payload.sources.map((source) => ({ ...source, text: "" })) }
}

export function emptyDiscovery(input: DiscoveryInput): DiscoveryPayload {
  return { input, sources: [], sourceWarnings: [], understanding: null, evidence: [], hypotheses: [], feedback: { stances: [], founderAudiences: [], selectedGoalIds: null }, landscape: null, profiles: [], envelope: null, goals: [] }
}

export function splitListLines(value: string): string[] {
  return [...new Set(value.split(/\r?\n/u).map((line) => line.trim()).filter(Boolean))]
}

export function parseDiscoveryInput(value: unknown): DiscoveryInput {
  if (!value || typeof value !== "object") throw new Error("მიუთითეთ ვებსაიტი ან აღწერეთ ბიზნესი.")
  const raw = value as Record<string, unknown>
  if (typeof raw.website !== "string" || typeof raw.notes !== "string" || !["ka", "en"].includes(String(raw.language))) throw new Error("შეამოწმეთ ბიზნესის ინფორმაცია და ენა.")
  const input = { website: raw.website.trim(), notes: raw.notes.trim(), language: raw.language as "ka" | "en" }
  if (input.website.length > 500 || input.notes.length > 8000) throw new Error("ვებსაიტის მისამართი მაქსიმუმ 500, აღწერა კი 8000 სიმბოლო უნდა იყოს.")
  if (!input.website && input.notes.length < 40) throw new Error("აღწერეთ რას აკეთებთ, რას სთავაზობთ მომხმარებელს და რა გამოგარჩევთ — სულ მცირე 40 სიმბოლოთი.")
  return input
}
