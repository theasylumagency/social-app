import type { DomainScalar } from "../../core/domain/primitives"

function registryToken<Name extends string, Value extends string>(
  value: Value,
): DomainScalar<Value, Name> {
  return value as DomainScalar<Value, Name>
}

const knowledgePath = <Value extends string>(value: Value) =>
  registryToken<"KnowledgePath", Value>(value)
const sourceKind = <Value extends string>(value: Value) =>
  registryToken<"SourceKind", Value>(value)
const contentMode = <Value extends string>(value: Value) =>
  registryToken<"ContentMode", Value>(value)
const taskType = <Value extends string>(value: Value) =>
  registryToken<"TaskType", Value>(value)
const capability = <Value extends string>(value: Value) =>
  registryToken<"Capability", Value>(value)
const fallbackStrategy = <Value extends string>(value: Value) =>
  registryToken<"FallbackStrategy", Value>(value)
const blockedOperation = <Value extends string>(value: Value) =>
  registryToken<"BlockedOperation", Value>(value)
const operatingNoteCode = <Value extends string>(value: Value) =>
  registryToken<"OperatingNoteCode", Value>(value)
const businessFactType = <Value extends string>(value: Value) =>
  registryToken<"BusinessFactType", Value>(value)
const proofType = <Value extends string>(value: Value) =>
  registryToken<"ProofType", Value>(value)
const corpusPatternType = <Value extends string>(value: Value) =>
  registryToken<"CorpusPatternType", Value>(value)
const claimSignalType = <Value extends string>(value: Value) =>
  registryToken<"ClaimSignalType", Value>(value)
const claimContextChannel = <Value extends string>(value: Value) =>
  registryToken<"ClaimContextChannel", Value>(value)

export const SOCIAL_KNOWLEDGE_PATHS = {
  identityName: knowledgePath("identity.name"),
  identityShortDescription: knowledgePath("identity.shortDescription"),
  identityIndustry: knowledgePath("identity.industry"),
  identityLocations: knowledgePath("identity.locations"),
  identityLanguages: knowledgePath("identity.languages"),
  identityWebsite: knowledgePath("identity.website"),
  identitySocialAccounts: knowledgePath("identity.socialAccounts"),
  offerPrimaryServices: knowledgePath("offer.primaryServices"),
  offerSecondaryServices: knowledgePath("offer.secondaryServices"),
  offerProducts: knowledgePath("offer.products"),
  offerPriorityOffers: knowledgePath("offer.priorityOffers"),
  offerPricingContext: knowledgePath("offer.pricingContext"),
  audiencePrimarySegments: knowledgePath("audience.primarySegments"),
  audienceSecondarySegments: knowledgePath("audience.secondarySegments"),
  audienceNeeds: knowledgePath("audience.needs"),
  audienceObjections: knowledgePath("audience.objections"),
  audienceDecisionDrivers: knowledgePath("audience.decisionDrivers"),
  positioningCorePosition: knowledgePath("positioning.corePosition"),
  positioningValuePropositions: knowledgePath("positioning.valuePropositions"),
  positioningDifferentiators: knowledgePath("positioning.differentiators"),
  positioningBrandAttributes: knowledgePath("positioning.brandAttributes"),
  positioningAvoidPositioning: knowledgePath("positioning.avoidPositioning"),
  voicePrimaryTone: knowledgePath("voice.primaryTone"),
  voiceFormality: knowledgePath("voice.formality"),
  voiceEnergy: knowledgePath("voice.energy"),
  voiceEmotionalStyle: knowledgePath("voice.emotionalStyle"),
  voiceLanguageRules: knowledgePath("voice.languageRules"),
  voicePreferredPatterns: knowledgePath("voice.preferredPatterns"),
  voiceAvoidPatterns: knowledgePath("voice.avoidPatterns"),
  voiceExamples: knowledgePath("voice.examples"),
  contentGoals: knowledgePath("content.goals"),
  contentPillars: knowledgePath("content.pillars"),
  contentPriorityTopics: knowledgePath("content.priorityTopics"),
  contentRecurringTopics: knowledgePath("content.recurringTopics"),
  contentMixPreferences: knowledgePath("content.mixPreferences"),
  contentCtaPreferences: knowledgePath("content.ctaPreferences"),
  contentSeasonalContext: knowledgePath("content.seasonalContext"),
  constraintsProhibitedClaims: knowledgePath("constraints.prohibitedClaims"),
  constraintsSensitiveTopics: knowledgePath("constraints.sensitiveTopics"),
  constraintsLegalOrRegulatory: knowledgePath("constraints.legalOrRegulatory"),
  constraintsBrandRules: knowledgePath("constraints.brandRules"),
  constraintsApprovalRequired: knowledgePath("constraints.approvalRequired"),
} as const

export const SOCIAL_SOURCE_KINDS = {
  website: sourceKind("social.website"),
  facebookPage: sourceKind("social.facebookPage"),
  instagramAccount: sourceKind("social.instagramAccount"),
  uploadedDocument: sourceKind("social.uploadedDocument"),
  manualInput: sourceKind("social.manualInput"),
} as const

export const SOCIAL_CONTENT_MODES = {
  brandStory: contentMode("social.brandStory"),
  educational: contentMode("social.educational"),
  serviceExplainer: contentMode("social.serviceExplainer"),
  trustBuilder: contentMode("social.trustBuilder"),
  proofLed: contentMode("social.proofLed"),
  directOffer: contentMode("social.directOffer"),
} as const

export const SOCIAL_TASK_TYPES = {
  buildBrandBrain: taskType("social.buildBrandBrain"),
  planWeeklyContent: taskType("social.planWeeklyContent"),
  generateContent: taskType("social.generateContent"),
  reviewContent: taskType("social.reviewContent"),
  scheduleContent: taskType("social.scheduleContent"),
  publishContent: taskType("social.publishContent"),
} as const

export const SOCIAL_CAPABILITIES = {
  sourceMaterial: capability("social.sourceMaterial"),
  usableOffer: capability("social.usableOffer"),
  contentLanguage: capability("social.contentLanguage"),
  usableVoice: capability("social.usableVoice"),
  audienceContext: capability("social.audienceContext"),
  contentDirection: capability("social.contentDirection"),
  publicOfferFacts: capability("social.publicOfferFacts"),
  eligibleProof: capability("social.eligibleProof"),
  generatedDraft: capability("social.generatedDraft"),
  approvedContent: capability("social.approvedContent"),
  scheduledPublishTime: capability("social.scheduledPublishTime"),
  connectedPublishingAccount: capability("social.connectedPublishingAccount"),
} as const

export const SOCIAL_FALLBACK_STRATEGIES = {
  operatorVoice: fallbackStrategy("social.operatorVoice"),
  neutralPositioning: fallbackStrategy("social.neutralPositioning"),
  generalEducation: fallbackStrategy("social.generalEducation"),
  omitUnsupportedSpecifics: fallbackStrategy("social.omitUnsupportedSpecifics"),
  omitPrice: fallbackStrategy("social.omitPrice"),
  requireHumanReview: fallbackStrategy("social.requireHumanReview"),
} as const

export const SOCIAL_BLOCKED_OPERATIONS = {
  brandSpecificGeneration: blockedOperation("social.brandSpecificGeneration"),
  proofLedGeneration: blockedOperation("social.proofLedGeneration"),
  directPublishing: blockedOperation("social.directPublishing"),
} as const

export const SOCIAL_OPERATING_NOTE_CODES = {
  usingDefaultVoice: operatingNoteCode("social.usingDefaultVoice"),
  specificityReduced: operatingNoteCode("social.specificityReduced"),
  proofOmitted: operatingNoteCode("social.proofOmitted"),
  humanReviewRequired: operatingNoteCode("social.humanReviewRequired"),
} as const

export const SOCIAL_BUSINESS_FACT_TYPES = {
  price: businessFactType("social.price"),
  openingHours: businessFactType("social.openingHours"),
  contactDetails: businessFactType("social.contactDetails"),
  availability: businessFactType("social.availability"),
  inventory: businessFactType("social.inventory"),
  campaignTerms: businessFactType("social.campaignTerms"),
  teamSchedule: businessFactType("social.teamSchedule"),
} as const

export const SOCIAL_PROOF_TYPES = {
  credential: proofType("social.credential"),
  experience: proofType("social.experience"),
  metric: proofType("social.metric"),
  technology: proofType("social.technology"),
  award: proofType("social.award"),
  testimonial: proofType("social.testimonial"),
  caseEvidence: proofType("social.caseEvidence"),
  price: proofType("social.price"),
  availability: proofType("social.availability"),
} as const

export const SOCIAL_CORPUS_PATTERN_TYPES = {
  tone: corpusPatternType("social.tone"),
  formality: corpusPatternType("social.formality"),
  emojiUsage: corpusPatternType("social.emojiUsage"),
  captionLength: corpusPatternType("social.captionLength"),
  cta: corpusPatternType("social.cta"),
  contentPillar: corpusPatternType("social.contentPillar"),
  visualStyle: corpusPatternType("social.visualStyle"),
  postFormat: corpusPatternType("social.postFormat"),
} as const

export const SOCIAL_CLAIM_SIGNAL_TYPES = {
  superlative: claimSignalType("social.superlative"),
  comparative: claimSignalType("social.comparative"),
  guarantee: claimSignalType("social.guarantee"),
  clinicalOutcome: claimSignalType("social.clinicalOutcome"),
  price: claimSignalType("social.price"),
  discount: claimSignalType("social.discount"),
  availability: claimSignalType("social.availability"),
  credential: claimSignalType("social.credential"),
  award: claimSignalType("social.award"),
  experience: claimSignalType("social.experience"),
  numeric: claimSignalType("social.numeric"),
} as const

export const SOCIAL_CHANNELS = {
  facebook: claimContextChannel("facebook"),
  instagram: claimContextChannel("instagram"),
} as const

type RegistryValue<Registry> = Registry[keyof Registry]

export type SocialKnowledgePath = RegistryValue<typeof SOCIAL_KNOWLEDGE_PATHS>
export type SocialSourceKind = RegistryValue<typeof SOCIAL_SOURCE_KINDS>
export type SocialContentMode = RegistryValue<typeof SOCIAL_CONTENT_MODES>
export type SocialTaskType = RegistryValue<typeof SOCIAL_TASK_TYPES>
export type SocialCapability = RegistryValue<typeof SOCIAL_CAPABILITIES>
export type SocialChannel = RegistryValue<typeof SOCIAL_CHANNELS>
