import type {
    BrandId,
    DomainId,
    IsoDate,
    IsoDateTime,
} from "../../core/domain"

import type {
    CommunicationEnvelopeId,
    ContentAudienceDirection,
    WeeklyAudienceFocus,
} from "./audience"

// -----------------------------------------------------------------------------
// IDs
// -----------------------------------------------------------------------------

export type WeeklyPlanId =
    DomainId<"SocialWeeklyPlanId">

export type WeeklyContentDirectionId =
    DomainId<"SocialWeeklyContentDirectionId">

export type WeeklyExperimentId =
    DomainId<"SocialWeeklyExperimentId">

// -----------------------------------------------------------------------------
// Weekly Plan lifecycle
// -----------------------------------------------------------------------------

export type WeeklyPlanState =
    | "draft"
    | "awaitingReview"
    | "changesRequested"
    | "approved"
    | "superseded"

// -----------------------------------------------------------------------------
// Weekly Objective
// -----------------------------------------------------------------------------

export type WeeklyObjective = {
    /**
     * One primary strategic objective for the week.
     */
    readonly objective: string

    /**
     * Why this objective deserves focus now.
     */
    readonly rationale: string

    /**
     * Things intentionally excluded to protect focus.
     */
    readonly deliberateOmissions: readonly string[]
}

// -----------------------------------------------------------------------------
// Content Direction
// -----------------------------------------------------------------------------

export type WeeklyContentDirection = {
    /**
     * Application-owned persistent identity.
     */
    readonly id: WeeklyContentDirectionId

    /**
     * Deterministic display/execution order.
     * Model does not own ordering.
     */
    readonly order: number

    /**
     * Strategic communication territory.
     * Not a post idea, format, hook or caption.
     */
    readonly direction: string

    /**
     * What useful progress this direction should create.
     */
    readonly purpose: string

    /**
     * Why this direction belongs in the current week.
     */
    readonly rationale: string

    /**
     * Audience adaptation for this specific direction.
     * Must remain inside Weekly Audience Focus and
     * Communication Envelope.
     */
    readonly audienceDirection:
    ContentAudienceDirection
}

// -----------------------------------------------------------------------------
// Optional Experiment
// -----------------------------------------------------------------------------

export type WeeklyExperiment = {
    /**
     * Application-owned persistent identity.
     */
    readonly id: WeeklyExperimentId

    /**
     * One falsifiable learning hypothesis.
     */
    readonly hypothesis: string

    /**
     * One meaningful factor intentionally varied.
     */
    readonly variable: string

    /**
     * Narrow comparison that keeps later learning interpretable.
     */
    readonly comparison: string

    /**
     * Observable evidence that may support or weaken
     * the hypothesis.
     *
     * This is not a guaranteed success KPI.
     */
    readonly learningSignal: string

    /**
     * Conditions that protect Brand Voice,
     * evidence discipline and interpretability.
     */
    readonly guardrails: readonly string[]
}

export type WeeklyExperimentDecision =
    | {
        readonly decision: "noExperiment"

        /**
         * Why experimentation does not deserve
         * scarce attention this week.
         */
        readonly rationale: string

        readonly experiment: null
    }
    | {
        readonly decision: "experiment"

        /**
         * Why this experiment deserves
         * scarce attention this week.
         */
        readonly rationale: string

        readonly experiment: WeeklyExperiment
    }

// -----------------------------------------------------------------------------
// Canonical Weekly Plan
// -----------------------------------------------------------------------------

export type WeeklyPlan = {
    readonly id: WeeklyPlanId
    readonly brandId: BrandId

    /**
     * Calendar boundary owned by the application.
     */
    readonly startsOn: IsoDate
    readonly endsOn: IsoDate

    /**
     * Incremented when the plan is materially revised.
     */
    readonly version: number

    /**
     * Workflow state is application-owned.
     */
    readonly state: WeeklyPlanState

    /**
     * Immutable reference to the communication boundary
     * used when this plan was assembled.
     */
    readonly communicationEnvelopeId:
    CommunicationEnvelopeId

    readonly objective: WeeklyObjective

    readonly audienceFocus:
    WeeklyAudienceFocus

    /**
     * Already ordered and paired with their
     * audience directions by deterministic assembly.
     */
    readonly contentDirections:
    readonly WeeklyContentDirection[]

    /**
     * Explicit decision is persisted even when
     * no experiment runs.
     */
    readonly experimentDecision:
    WeeklyExperimentDecision

    readonly createdAt: IsoDateTime
    readonly updatedAt: IsoDateTime
}