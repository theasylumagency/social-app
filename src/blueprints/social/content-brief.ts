import type {
    ContentId,
    DomainId,
    EvidenceId,
    IsoDateTime,
} from "../../core/domain"

import type {
    ContentAudienceDirection,
} from "./audience"

import type {
    WeeklyContentDirectionId,
    WeeklyPlanId,
} from "./weekly-plan"

// -----------------------------------------------------------------------------
// IDs
// -----------------------------------------------------------------------------

export type ContentBriefId =
    DomainId<"SocialContentBriefId">

// -----------------------------------------------------------------------------
// CTA intent
// -----------------------------------------------------------------------------

export type ContentBriefCtaIntent =
    | "none"
    | "inform"
    | "encourageReflection"
    | "inviteQuestion"
    | "inviteConsultation"
    | "directAction"

// -----------------------------------------------------------------------------
// Evidence / proof allowance
// -----------------------------------------------------------------------------

export type ContentBriefEvidenceMode =
    | "noProofNeeded"
    | "evidenceSupported"
    | "proofRequired"

// -----------------------------------------------------------------------------
// Content Brief
// -----------------------------------------------------------------------------

export type ContentBrief = {
    readonly id: ContentBriefId

    /**
     * Provenance to the approved planning layer.
     */
    readonly weeklyPlanId: WeeklyPlanId
    readonly weeklyContentDirectionId:
    WeeklyContentDirectionId

    /**
     * Optional identity of the content item this brief will become.
     * May be absent before content creation.
     */
    readonly contentId?: ContentId

    /**
     * The concrete communication job for this item.
     *
     * More specific than WeeklyContentDirection,
     * but still not copy.
     */
    readonly communicationJob: string

    /**
     * The one thing the audience should leave understanding,
     * believing, or being better able to decide.
     */
    readonly keyTakeaway: string

    /**
     * Main ideas the Writer should cover.
     * These are not sentences or caption copy.
     */
    readonly supportingPoints: readonly string[]

    /**
     * Audience adaptation inherited from planning.
     */
    readonly audienceDirection:
    ContentAudienceDirection

    /**
     * Determines whether claims/proof are expected.
     */
    readonly evidenceMode:
    ContentBriefEvidenceMode

    /**
     * Evidence explicitly allowed for this content item.
     *
     * Empty is valid when evidenceMode = noProofNeeded.
     */
    readonly evidenceIds:
    readonly EvidenceId[]

    /**
     * What kind of next step the content should invite,
     * if any.
     */
    readonly ctaIntent:
    ContentBriefCtaIntent

    /**
     * Required boundaries for the Writer.
     */
    readonly constraints:
    readonly string[]

    /**
     * Explicit exclusions protecting the brief
     * from scope drift or risky claims.
     */
    readonly mustNotSay:
    readonly string[]

    /**
     * Short explanation of why this brief is the right
     * execution of the selected weekly direction.
     */
    readonly rationale: string

    readonly createdAt: IsoDateTime
}