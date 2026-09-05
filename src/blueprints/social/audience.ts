// src/blueprints/social/audience.ts

import type {
    BrandId,
    ContentId,
    DomainId,
    EvidenceId,
    IsoDateTime,
} from "../../core/domain"

// -----------------------------------------------------------------------------
// IDs
// -----------------------------------------------------------------------------

export type AudienceHypothesisId =
    DomainId<"SocialAudienceHypothesisId">

export type FounderProvidedAudienceId =
    DomainId<"SocialFounderProvidedAudienceId">

export type AudienceCommunicationProfileId =
    DomainId<"SocialAudienceCommunicationProfileId">

export type CommunicationEnvelopeId =
    DomainId<"SocialCommunicationEnvelopeId">

export type AudienceLearningCandidateId =
    DomainId<"SocialAudienceLearningCandidateId">

// -----------------------------------------------------------------------------
// Shared vocabulary
// -----------------------------------------------------------------------------

export type AudienceConfidenceBand =
    | "tentative"
    | "reasonable"
    | "strong"

export type AudienceDecisionStage =
    | "unaware"
    | "problemAware"
    | "solutionAware"
    | "providerComparison"
    | "decisionReady"
    | "existingCustomer"
    | "returningCustomer"

export type AudienceHypothesisLifecycle =
    | "active"
    | "challenged"
    | "retired"

export type FounderAudienceStanceValue =
    | "agree"
    | "unsure"
    | "disagree"

export type AudienceInfluence =
    | "strong"
    | "standard"
    | "limited"
    | "none"

export type AudienceRef =
    | {
        readonly source: "operator"
        readonly id: AudienceHypothesisId
    }
    | {
        readonly source: "founder"
        readonly id: FounderProvidedAudienceId
    }

// -----------------------------------------------------------------------------
// 1. Operator-generated audience hypothesis
// -----------------------------------------------------------------------------

export type AudienceHypothesis = {
    readonly id: AudienceHypothesisId
    readonly brandId: BrandId

    readonly name: string
    readonly buyingSituation: string
    readonly currentNeed: string

    readonly relevantOffers: readonly string[]
    readonly mainQuestions: readonly string[]
    readonly likelyBarriers: readonly string[]

    readonly decisionStage: AudienceDecisionStage

    /**
     * Evidence that materially contributed to the hypothesis.
     * This is provenance, not a claim that the segment is proven.
     */
    readonly evidenceIds: readonly EvidenceId[]

    /**
     * Short user-safe explanation of why the Operator proposed this segment.
     * Never raw model chain-of-thought.
     */
    readonly rationale: string

    /**
     * Assumptions that are useful but not directly supported as facts.
     */
    readonly assumptions: readonly string[]

    readonly confidenceBand: AudienceConfidenceBand
    readonly lifecycle: AudienceHypothesisLifecycle

    readonly createdAt: IsoDateTime
    readonly updatedAt: IsoDateTime
}

// -----------------------------------------------------------------------------
// 2. Founder stance
// -----------------------------------------------------------------------------

export type FounderAudienceStance = {
    readonly audienceHypothesisId: AudienceHypothesisId

    /**
     * Founder feedback never mutates the hypothesis itself.
     */
    readonly stance: FounderAudienceStanceValue

    readonly note?: string

    readonly createdAt: IsoDateTime
    readonly updatedAt: IsoDateTime
}

// -----------------------------------------------------------------------------
// 3. Founder-provided audience
// -----------------------------------------------------------------------------

export type FounderProvidedAudience = {
    readonly id: FounderProvidedAudienceId
    readonly brandId: BrandId

    readonly name: string
    readonly description: string

    readonly relevantOffers?: readonly string[]
    readonly notes?: string

    readonly createdAt: IsoDateTime
    readonly updatedAt: IsoDateTime
}

// -----------------------------------------------------------------------------
// 4. Audience Landscape
// -----------------------------------------------------------------------------

export type OperatorAudienceLandscapeEntry = {
    readonly audience: AudienceHypothesis

    readonly source: "operator"

    /**
     * null = founder has not reviewed this hypothesis.
     */
    readonly founderStance: FounderAudienceStanceValue | null

    /**
     * Deterministically resolved by application code.
     * The model does NOT assign this.
     */
    readonly influence: AudienceInfluence
}

export type FounderAudienceLandscapeEntry = {
    readonly audience: FounderProvidedAudience

    readonly source: "founder"

    /**
     * Founder-provided audiences are explicit business input.
     * Influence is still application-owned.
     */
    readonly influence: AudienceInfluence
}

export type AudienceLandscapeEntry =
    | OperatorAudienceLandscapeEntry
    | FounderAudienceLandscapeEntry

export type AudienceLandscape = {
    readonly brandId: BrandId

    /**
     * Increment when the resolved landscape changes materially.
     */
    readonly version: number

    readonly entries: readonly AudienceLandscapeEntry[]

    readonly generatedAt: IsoDateTime
}

// -----------------------------------------------------------------------------
// 5. Deterministic Landscape resolution input
// -----------------------------------------------------------------------------

export type ResolveAudienceLandscapeInput = {
    readonly brandId: BrandId

    readonly hypotheses: readonly AudienceHypothesis[]
    readonly founderStances: readonly FounderAudienceStance[]
    readonly founderProvidedAudiences: readonly FounderProvidedAudience[]

    readonly previousVersion?: number
}

// -----------------------------------------------------------------------------
// 6. Audience Communication Profile
// -----------------------------------------------------------------------------

export type AudienceAssumedKnowledge =
    | "none"
    | "basic"
    | "informed"
    | "expert"

export type AudienceExplanationDepth =
    | "light"
    | "balanced"
    | "deep"

export type AudienceCtaStyle =
    | "informational"
    | "lowPressure"
    | "consultative"
    | "directWhenJustified"

export type AudienceCommunicationProfile = {
    readonly id: AudienceCommunicationProfileId
    readonly brandId: BrandId

    readonly audience: AudienceRef

    /**
     * Landscape version from which this profile was derived.
     */
    readonly landscapeVersion: number

    readonly communicationGoal: string

    /**
     * Adaptation inside Brand Voice.
     * These do not replace Brand Voice.
     */
    readonly toneAdjustments: readonly string[]

    readonly preferredFraming: readonly string[]
    readonly usefulContentAngles: readonly string[]

    readonly assumedKnowledge: AudienceAssumedKnowledge
    readonly explanationDepth: AudienceExplanationDepth

    readonly trustMechanisms: readonly string[]
    readonly ctaStyle: AudienceCtaStyle

    readonly avoid: readonly string[]

    readonly rationale: string
    readonly generatedAt: IsoDateTime
}

// -----------------------------------------------------------------------------
// 7. Communication Envelope
// -----------------------------------------------------------------------------

export type CommunicationComplexity =
    | "plain"
    | "plainWithProfessionalDepth"
    | "technicalWhenExplained"
    | "expert"

export type CommunicationSalesPressure =
    | "low"
    | "moderate"
    | "high"

export type CommunicationEnvelope = {
    readonly id: CommunicationEnvelopeId
    readonly brandId: BrandId

    /**
     * Makes derived-state provenance explicit.
     */
    readonly landscapeVersion: number

    readonly profileIds:
    readonly AudienceCommunicationProfileId[]

    readonly complexity: CommunicationComplexity
    readonly assumedKnowledge: AudienceAssumedKnowledge
    readonly explanationDepth: AudienceExplanationDepth

    readonly toneRange: readonly string[]

    readonly framingRules: readonly string[]
    readonly preferredStructures: readonly string[]
    readonly terminologyRules: readonly string[]

    readonly proofStyle: readonly string[]
    readonly ctaStyle: AudienceCtaStyle
    readonly salesPressure: CommunicationSalesPressure

    /**
     * Rules that keep ordinary organic communication useful
     * across several materially relevant audiences.
     */
    readonly inclusivityRules: readonly string[]

    readonly trustMechanisms: readonly string[]
    readonly avoid: readonly string[]

    /**
     * Short managerial explanation of why this envelope fits
     * the current landscape.
     */
    readonly rationale: string

    readonly generatedAt: IsoDateTime
}

// -----------------------------------------------------------------------------
// 8. Weekly Planner integration
// -----------------------------------------------------------------------------

export type WeeklyAudienceFocus = {
    /**
     * The Planner makes this decision.
     * Audience Landscape itself does not designate "primary".
     */
    readonly primary: AudienceRef

    readonly secondary: readonly AudienceRef[]

    /**
     * Why these audiences matter for this specific week's objective.
     */
    readonly rationale: string
}

export type ContentAudienceBias =
    | "balanced"
    | "moreExplanatory"
    | "moreDecisionOriented"
    | "moreTrustFocused"
    | "morePractical"

export type ContentAudienceDirection = {
    readonly primaryAudience: AudienceRef
    readonly secondaryAudiences: readonly AudienceRef[]

    /**
     * Small shift inside the Communication Envelope.
     */
    readonly bias: ContentAudienceBias
}

// -----------------------------------------------------------------------------
// 9. Audience learning
// -----------------------------------------------------------------------------

export type AudienceLearningRecurrence =
    | "singleObservation"
    | "repeatedSignal"
    | "stablePattern"

export type AudienceLearningCandidateStatus =
    | "candidate"
    | "accepted"
    | "rejected"

export type AudienceLearningCandidate = {
    readonly id: AudienceLearningCandidateId
    readonly brandId: BrandId

    readonly audience: AudienceRef

    readonly observation: string
    readonly context: string

    readonly contentIds: readonly ContentId[]

    readonly recurrence: AudienceLearningRecurrence
    readonly competingExplanations: readonly string[]

    readonly confidenceBand: AudienceConfidenceBand

    readonly status: AudienceLearningCandidateStatus

    readonly createdAt: IsoDateTime
    readonly updatedAt: IsoDateTime
}