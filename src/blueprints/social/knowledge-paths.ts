import type { KnowledgePath, MinimumViableBrandStatus } from "../../core/domain"
import { SOCIAL_KNOWLEDGE_PATHS } from "./tokens"

export type SocialKnowledgeDomain =
  | "identity"
  | "offer"
  | "audience"
  | "positioning"
  | "voice"
  | "content"
  | "constraints"

export type SocialKnowledgeUsage =
  | "publicFact"
  | "internalGuidance"
  | "constraint"
  | "reference"

export type SocialKnowledgeCardinality = "one" | "many"
export type SocialHypothesisPolicy = "forbidden" | "internalOnly"
export type SocialMvbRequirement = "usableOffer" | "contentLanguage" | "usableVoice"

export type SocialKnowledgePathPolicy = {
  readonly path: KnowledgePath
  readonly domain: SocialKnowledgeDomain
  readonly cardinality: SocialKnowledgeCardinality
  readonly usage: SocialKnowledgeUsage
  readonly hypothesis: SocialHypothesisPolicy
  readonly mvbRequirement?: SocialMvbRequirement
}

const pathPolicy = (
  path: KnowledgePath,
  domain: SocialKnowledgeDomain,
  cardinality: SocialKnowledgeCardinality,
  usage: SocialKnowledgeUsage,
  hypothesis: SocialHypothesisPolicy,
  mvbRequirement?: SocialMvbRequirement,
): SocialKnowledgePathPolicy => ({
  path,
  domain,
  cardinality,
  usage,
  hypothesis,
  ...(mvbRequirement === undefined ? {} : { mvbRequirement }),
})

const paths = SOCIAL_KNOWLEDGE_PATHS

export const SOCIAL_KNOWLEDGE_PATH_POLICIES = [
  pathPolicy(paths.identityName, "identity", "one", "publicFact", "forbidden"),
  pathPolicy(paths.identityShortDescription, "identity", "one", "publicFact", "forbidden"),
  pathPolicy(paths.identityIndustry, "identity", "one", "reference", "forbidden"),
  pathPolicy(paths.identityLocations, "identity", "many", "publicFact", "forbidden"),
  pathPolicy(
    paths.identityLanguages,
    "identity",
    "many",
    "reference",
    "forbidden",
    "contentLanguage",
  ),
  pathPolicy(paths.identityWebsite, "identity", "one", "reference", "forbidden"),
  pathPolicy(paths.identitySocialAccounts, "identity", "many", "reference", "forbidden"),
  pathPolicy(
    paths.offerPrimaryServices,
    "offer",
    "many",
    "publicFact",
    "forbidden",
    "usableOffer",
  ),
  pathPolicy(paths.offerSecondaryServices, "offer", "many", "publicFact", "forbidden"),
  pathPolicy(
    paths.offerProducts,
    "offer",
    "many",
    "publicFact",
    "forbidden",
    "usableOffer",
  ),
  pathPolicy(paths.offerPriorityOffers, "offer", "many", "internalGuidance", "forbidden"),
  pathPolicy(paths.offerPricingContext, "offer", "one", "internalGuidance", "forbidden"),
  pathPolicy(paths.audiencePrimarySegments, "audience", "many", "internalGuidance", "internalOnly"),
  pathPolicy(paths.audienceSecondarySegments, "audience", "many", "internalGuidance", "internalOnly"),
  pathPolicy(paths.audienceNeeds, "audience", "many", "internalGuidance", "internalOnly"),
  pathPolicy(paths.audienceObjections, "audience", "many", "internalGuidance", "internalOnly"),
  pathPolicy(paths.audienceDecisionDrivers, "audience", "many", "internalGuidance", "internalOnly"),
  pathPolicy(paths.positioningCorePosition, "positioning", "one", "internalGuidance", "internalOnly"),
  pathPolicy(paths.positioningValuePropositions, "positioning", "many", "internalGuidance", "internalOnly"),
  pathPolicy(paths.positioningDifferentiators, "positioning", "many", "internalGuidance", "internalOnly"),
  pathPolicy(paths.positioningBrandAttributes, "positioning", "many", "internalGuidance", "internalOnly"),
  pathPolicy(paths.positioningAvoidPositioning, "positioning", "many", "constraint", "forbidden"),
  pathPolicy(
    paths.voicePrimaryTone,
    "voice",
    "many",
    "internalGuidance",
    "internalOnly",
    "usableVoice",
  ),
  pathPolicy(paths.voiceFormality, "voice", "one", "internalGuidance", "internalOnly"),
  pathPolicy(paths.voiceEnergy, "voice", "one", "internalGuidance", "internalOnly"),
  pathPolicy(paths.voiceEmotionalStyle, "voice", "one", "internalGuidance", "internalOnly"),
  pathPolicy(paths.voiceLanguageRules, "voice", "many", "constraint", "forbidden"),
  pathPolicy(paths.voicePreferredPatterns, "voice", "many", "internalGuidance", "internalOnly"),
  pathPolicy(paths.voiceAvoidPatterns, "voice", "many", "constraint", "forbidden"),
  pathPolicy(paths.voiceExamples, "voice", "many", "reference", "forbidden"),
  pathPolicy(paths.contentGoals, "content", "many", "internalGuidance", "internalOnly"),
  pathPolicy(paths.contentPillars, "content", "many", "internalGuidance", "internalOnly"),
  pathPolicy(paths.contentPriorityTopics, "content", "many", "internalGuidance", "forbidden"),
  pathPolicy(paths.contentRecurringTopics, "content", "many", "internalGuidance", "internalOnly"),
  pathPolicy(paths.contentMixPreferences, "content", "many", "internalGuidance", "forbidden"),
  pathPolicy(paths.contentCtaPreferences, "content", "many", "internalGuidance", "internalOnly"),
  pathPolicy(paths.contentSeasonalContext, "content", "many", "internalGuidance", "forbidden"),
  pathPolicy(paths.constraintsProhibitedClaims, "constraints", "many", "constraint", "forbidden"),
  pathPolicy(paths.constraintsSensitiveTopics, "constraints", "many", "constraint", "forbidden"),
  pathPolicy(paths.constraintsLegalOrRegulatory, "constraints", "many", "constraint", "forbidden"),
  pathPolicy(paths.constraintsBrandRules, "constraints", "many", "constraint", "forbidden"),
  pathPolicy(paths.constraintsApprovalRequired, "constraints", "many", "constraint", "forbidden"),
] as const satisfies readonly SocialKnowledgePathPolicy[]

export function getSocialKnowledgePathPolicy(
  path: KnowledgePath,
): SocialKnowledgePathPolicy | undefined {
  return SOCIAL_KNOWLEDGE_PATH_POLICIES.find((policy) => policy.path === path)
}

export type SocialMvbEvaluationInput = {
  readonly usablePaths: ReadonlySet<KnowledgePath>
  readonly allowOperatorVoiceDefault?: boolean
}

export function evaluateSocialMinimumViableBrand({
  usablePaths,
  allowOperatorVoiceDefault = true,
}: SocialMvbEvaluationInput): MinimumViableBrandStatus {
  const usableOffer =
    usablePaths.has(paths.offerPrimaryServices) || usablePaths.has(paths.offerProducts)
  const contentLanguage = usablePaths.has(paths.identityLanguages)
  const usableVoice =
    usablePaths.has(paths.voicePrimaryTone) || allowOperatorVoiceDefault

  return {
    usableOffer,
    contentLanguage,
    usableVoice,
    satisfied: usableOffer && contentLanguage && usableVoice,
  }
}
