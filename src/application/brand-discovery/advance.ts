import type { AudienceHypothesis, AudienceCommunicationProfile, CommunicationEnvelope } from "../../blueprints/social/audience"
import { resolveAudienceLandscape } from "../../blueprints/social/audience-resolution"
import type { BrandUnderstanding, DiscoverySession, DiscoveryPayload, GoalProposal } from "../../blueprints/social/brand-discovery/model"
import type { AudienceHypothesisModelOutput } from "../../blueprints/social/brand-discovery/audience-contract"
import type { AudienceCommunicationProfileModelOutput } from "../../blueprints/social/brand-discovery/communication-profile-contract"
import type { CommunicationEnvelopeModelOutput } from "../../blueprints/social/brand-discovery/communication-envelope-contract"
import { AUDIENCE_HYPOTHESIS_SYSTEM_PROMPT } from "../../blueprints/social/brand-discovery/prompts/audience"
import { AUDIENCE_COMMUNICATION_PROFILE_SYSTEM_PROMPT } from "../../blueprints/social/brand-discovery/prompts/communication-profile"
import { COMMUNICATION_ENVELOPE_SYSTEM_PROMPT } from "../../blueprints/social/brand-discovery/prompts/communication-envelope"
import { BUSINESS_UNDERSTANDING_PROMPT } from "../../blueprints/social/brand-discovery/prompts/understanding"
import { BRAND_GOALS_PROMPT } from "../../blueprints/social/brand-discovery/prompts/goals"
import { AUDIENCE_HYPOTHESIS_OUTPUT_SCHEMA, AUDIENCE_COMMUNICATION_PROFILE_OUTPUT_SCHEMA, COMMUNICATION_ENVELOPE_OUTPUT_SCHEMA, BUSINESS_UNDERSTANDING_SCHEMA, BRAND_GOALS_SCHEMA } from "../../blueprints/social/brand-discovery/schemas"
import { validateReferences, validateUnderstanding } from "../../blueprints/social/brand-discovery/validation"
import type { BrandReasoner } from "../../infrastructure/models/brand-reasoning"
import type { WebsiteCorpusPage } from "../../infrastructure/web/brand-model-extraction"
import type { BrandId, IsoDateTime } from "../../core/domain"

export type DiscoveryAdvanceDependencies = { reason: BrandReasoner; capture: (url: string) => Promise<readonly WebsiteCorpusPage[]>; now?: () => string }

export function compileBusinessContext(payload: DiscoveryPayload) {
  const u = payload.understanding
  if (!u) throw new Error("Business understanding required")
  return {
    locale: "ka", contentLanguage: payload.input.language,
    business: { name: u.name, description: u.summary, businessModel: u.businessModel },
    offers: u.offers.map(({ name, description }) => ({ name, description })),
    positioning: { corePosition: u.positioning, valuePropositions: [u.valueProposition], differentiators: u.distinctiveSignals.map((signal) => signal.statement) },
    voice: { primaryTone: u.voice.traits, languageRules: u.voice.principles },
    evidenceSummary: payload.evidence.map(({ key, statement }) => ({ evidenceKey: key, statement, strength: "medium" })),
    existingAudienceSignals: u.audienceSignals.map((signal) => ({ statement: signal.statement, evidenceKey: payload.evidence.find((e) => e.statement === signal.statement)?.key })),
    constraints: u.constraints,
  }
}

export function compileLandscapeContext(payload: DiscoveryPayload) {
  const business = compileBusinessContext(payload)
  const audiences = payload.landscape?.entries.filter((entry) => entry.influence !== "none").map((entry, index) => {
    const base = { audienceKey: `a${index + 1}`, source: entry.source, influence: entry.influence, name: entry.audience.name, relevantOffers: entry.audience.relevantOffers ?? [] }
    return entry.source === "operator"
      ? { ...base, buyingSituation: entry.audience.buyingSituation, currentNeed: entry.audience.currentNeed, decisionStage: entry.audience.decisionStage, mainQuestions: entry.audience.mainQuestions, likelyBarriers: entry.audience.likelyBarriers, founderStance: entry.founderStance, founderNote: payload.feedback.stances.find((s) => s.audienceHypothesisId === entry.audience.id)?.note ?? null }
      : { ...base, buyingSituation: entry.audience.description, founderStance: null, founderNote: entry.audience.notes ?? null }
  }) ?? []
  return { ...business, brandVoice: business.voice, audiences, eligibleProof: [] }
}

export async function advanceDiscovery(session: DiscoverySession, deps: DiscoveryAdvanceDependencies): Promise<{ payload: DiscoveryPayload; step: DiscoverySession["step"] }> {
  const p = structuredClone(session.payload)
  const now = (deps.now?.() ?? new Date().toISOString()) as IsoDateTime
  const brandId = (session.brandId ?? `brand:${session.id}`) as BrandId
  const prefix = `${session.id}:${session.revision}`
  if (session.step === "sources") {
    p.sources = []
    p.sourceWarnings = []
    if (p.input.website) {
      try {
        const pages = await deps.capture(p.input.website)
        p.sources = pages.map((page, i) => ({ key: `s${i + 1}`, url: page.url, title: page.title ?? new URL(page.url).hostname, text: page.text, capturedAt: now }))
      } catch {
        if (p.input.notes.length < 40) throw new Error("SOURCE_UNAVAILABLE")
        p.sourceWarnings.push("ვებსაიტი ვერ წავიკითხეთ. ანალიზი თქვენ მიერ მოწოდებულ ინფორმაციას ეყრდნობა.")
      }
    }
    if (p.input.notes) p.sources.push({ key: "founder", url: null, title: "თქვენი ინფორმაცია", text: p.input.notes, capturedAt: now })
    if (!p.sources.length) throw new Error("SOURCE_UNAVAILABLE")
    return { payload: p, step: "understanding" }
  }
  if (session.step === "understanding") {
    p.understanding = await deps.reason<BrandUnderstanding>({ step: "understanding", version: "business-understanding-v1", prompt: BUSINESS_UNDERSTANDING_PROMPT, input: { locale: "ka", sources: p.sources }, schema: BUSINESS_UNDERSTANDING_SCHEMA,
      validate: (value) => validateUnderstanding(value as BrandUnderstanding, p.sources) })
    const u = p.understanding
    const signals = [...u.offers.map((offer) => ({ statement: `${offer.name}: ${offer.description}`, sourceKey: offer.sourceKey, exactExcerpt: offer.exactExcerpt })), ...u.distinctiveSignals, ...u.audienceSignals, ...u.voice.examples.map((citation) => ({ ...citation, statement: citation.exactExcerpt }))]
    p.evidence = signals.map((signal, i) => ({ ...signal, key: `e${i + 1}`, id: `evidence:discovery:${prefix}:${i + 1}` }))
    return { payload: p, step: "audiences" }
  }
  if (session.step === "audiences") {
    const context = compileBusinessContext(p)
    const proposal = await deps.reason<AudienceHypothesisModelOutput>({ step: "audiences", version: "audience-hypothesis-v1", prompt: AUDIENCE_HYPOTHESIS_SYSTEM_PROMPT, input: context, schema: AUDIENCE_HYPOTHESIS_OUTPUT_SCHEMA,
      validate: (value) => {
        const output = value as AudienceHypothesisModelOutput
        const errors = output.segments.length < 1 || output.segments.length > 5 ? ["Return 1–5 materially distinct segments"] : []
        const names = output.segments.map((s) => s.name.trim().toLocaleLowerCase())
        if (new Set(names).size !== names.length) errors.push("Duplicate segment names")
        for (const s of output.segments) {
          errors.push(...validateReferences(s.evidenceKeys, p.evidence.map((e) => e.key), "evidence"), ...validateReferences(s.relevantOffers, context.offers.map((o) => o.name), "offers"))
          if (!s.evidenceKeys.length && (s.confidenceBand !== "tentative" || !s.assumptions.length)) errors.push("Unsupported audiences must be tentative with explicit assumptions")
          if (s.confidenceBand === "strong" && !s.evidenceKeys.some((key) => p.understanding!.audienceSignals.some((signal) => signal.statement === p.evidence.find((e) => e.key === key)?.statement))) errors.push("Strong audience confidence requires direct audience evidence, not merely an offer")
        }
        return errors
      } })
    p.hypotheses = proposal.segments.map(({ evidenceKeys, ...segment }, i) => ({ ...segment, id: `audience:${prefix}:${i + 1}` as AudienceHypothesis["id"], brandId, evidenceIds: evidenceKeys.map((key) => p.evidence.find((e) => e.key === key)!.id as AudienceHypothesis["evidenceIds"][number]), lifecycle: "active", createdAt: now, updatedAt: now } as AudienceHypothesis))
    p.feedback = { ...p.feedback, stances: [], selectedGoalIds: null }
    return { payload: p, step: "profiles" }
  }
  if (session.step === "profiles") {
    p.landscape = resolveAudienceLandscape({ brandId, hypotheses: p.hypotheses, founderStances: p.feedback.stances, founderProvidedAudiences: p.feedback.founderAudiences, previousVersion: session.revision - 1 }, now)
    const context = compileLandscapeContext(p)
    const proposal = await deps.reason<AudienceCommunicationProfileModelOutput>({ step: "profiles", version: "communication-profile-v1", prompt: AUDIENCE_COMMUNICATION_PROFILE_SYSTEM_PROMPT, input: context, schema: AUDIENCE_COMMUNICATION_PROFILE_OUTPUT_SCHEMA,
      validate: (value) => {
        const profiles = (value as AudienceCommunicationProfileModelOutput).profiles
        return [...validateReferences(profiles.map((profile) => profile.audienceKey), context.audiences.map((a) => a.audienceKey), "audiences"), ...(profiles.length === context.audiences.length ? [] : ["Return one profile for every requested audience"])]
      } })
    p.profiles = proposal.profiles.map(({ audienceKey, ...profile }, i) => {
      const entry = p.landscape!.entries.filter((e) => e.influence !== "none")[context.audiences.findIndex((a) => a.audienceKey === audienceKey)]!
      return { ...profile, id: `profile:${prefix}:${i + 1}`, brandId, audience: { source: entry.source, id: entry.audience.id }, landscapeVersion: session.revision, generatedAt: now } as AudienceCommunicationProfile
    })
    return { payload: p, step: "envelope" }
  }
  if (session.step === "envelope") {
    const context = compileLandscapeContext(p)
    const entries = p.landscape!.entries.filter((e) => e.influence !== "none")
    const profiles = p.profiles.map(({ audience, id: _id, brandId: _brandId, landscapeVersion: _version, generatedAt: _time, ...profile }) => {
      void _id; void _brandId; void _version; void _time
      const i = entries.findIndex((entry) => entry.audience.id === audience.id)
      return { ...profile, audienceKey: context.audiences[i]!.audienceKey, influence: entries[i]!.influence, founderStance: context.audiences[i]!.founderStance ?? null, founderNote: context.audiences[i]!.founderNote }
    })
    const proposal = await deps.reason<CommunicationEnvelopeModelOutput>({ step: "envelope", version: "communication-envelope-v1", prompt: COMMUNICATION_ENVELOPE_SYSTEM_PROMPT, input: { ...context, profiles }, schema: COMMUNICATION_ENVELOPE_OUTPUT_SCHEMA })
    p.envelope = { ...proposal.envelope, id: `envelope:${prefix}` as CommunicationEnvelope["id"], brandId, landscapeVersion: session.revision, profileIds: p.profiles.map((profile) => profile.id), generatedAt: now } as CommunicationEnvelope
    return { payload: p, step: "goals" }
  }
  if (session.step === "goals") {
    const context = compileLandscapeContext(p)
    const proposal = await deps.reason<{ goals: GoalProposal[] }>({ step: "goals", version: "brand-goals-v1", prompt: BRAND_GOALS_PROMPT, input: { ...context, envelope: p.envelope }, schema: BRAND_GOALS_SCHEMA,
      validate: (value) => (value as { goals: GoalProposal[] }).goals.flatMap((goal) => validateReferences(goal.audienceKeys, context.audiences.map((a) => a.audienceKey), "audiences")) })
    const entries = p.landscape!.entries.filter((e) => e.influence !== "none")
    p.goals = proposal.goals.map(({ audienceKeys, ...goal }, i) => ({ ...goal, id: `goal:${prefix}:${i + 1}`, audienceIds: audienceKeys.map((key) => entries[context.audiences.findIndex((a) => a.audienceKey === key)]!.audience.id) }))
    p.feedback.selectedGoalIds = null
    return { payload: p, step: "ready" }
  }
  return { payload: p, step: "ready" }
}
