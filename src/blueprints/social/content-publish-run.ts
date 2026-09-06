import type {
    IsoDateTime,
} from "../../core/domain"

import type {
    ContentExecutionSpec,
} from "./content-execution-spec"

import type {
    SocialContentDraft,
} from "./content-draft"

import type {
    SocialContentSchedule,
} from "./content-schedule"

import type {
    SocialContentScheduleLifecycleState,
} from "./content-schedule-lifecycle"

import type {
    SocialPublishingAccount,
    SocialContentPublishEligibility,
} from "./content-publish-eligibility"

import {
    resolveSocialContentPublishEligibility,
} from "./content-publish-eligibility"

import type {
    SocialContentPublishAttempt,
    SocialContentPublishAttemptId,
} from "./content-publish-attempt"

import {
    assembleSocialContentPublishAttempt,
} from "./content-publish-attempt"

import type {
    SocialContentPublishProviderOutcome,
    SocialContentPublishResult,
    SocialContentPublishResultId,
} from "./content-publish-result"

import {
    assembleSocialContentPublishResult,
} from "./content-publish-result"

import type {
    SocialContentPublishRetryDecision,
    SocialContentPublishRetryPolicy,
} from "./content-publish-retry-decision"

import {
    resolveSocialContentPublishRetryDecision,
} from "./content-publish-retry-decision"

// -----------------------------------------------------------------------------
// Provider boundary
// -----------------------------------------------------------------------------

export type SocialContentPublisherInput = {
    readonly attempt:
    SocialContentPublishAttempt

    readonly draft:
    SocialContentDraft

    readonly contentExecutionSpec:
    ContentExecutionSpec

    readonly publishingAccount:
    SocialPublishingAccount
}

/**
 * Infrastructure adapter owns provider-specific behavior.
 *
 * Expected provider/network failures must be classified into a canonical
 * SocialContentPublishProviderOutcome.
 *
 * In particular:
 * - definitely not sent       -> retryableFailure / permanentFailure
 * - may have been accepted    -> unknownOutcome
 *
 * The adapter must never convert an ambiguous post-send failure into a
 * retryableFailure.
 */
export type SocialContentPublisher = (
    input:
        SocialContentPublisherInput,
) => Promise<SocialContentPublishProviderOutcome>

// -----------------------------------------------------------------------------
// Dependencies
// -----------------------------------------------------------------------------

export type SocialContentPublishRunDependencies = {
    readonly publish:
    SocialContentPublisher

    /**
     * Worker/infrastructure owns time.
     *
     * Called once before eligibility/attempt and once after provider outcome.
     */
    readonly now:
    () => IsoDateTime
}

// -----------------------------------------------------------------------------
// Input
// -----------------------------------------------------------------------------

export type RunSocialContentPublishInput = {
    readonly draft:
    SocialContentDraft

    readonly contentExecutionSpec:
    ContentExecutionSpec

    readonly schedule:
    SocialContentSchedule

    readonly scheduleState:
    SocialContentScheduleLifecycleState

    readonly publishingAccount:
    SocialPublishingAccount

    readonly attemptId:
    SocialContentPublishAttemptId

    readonly attemptNumber:
    number

    readonly resultId:
    SocialContentPublishResultId

    readonly retryPolicy:
    SocialContentPublishRetryPolicy
}

// -----------------------------------------------------------------------------
// Run result
// -----------------------------------------------------------------------------

export type SocialContentPublishRun =
    | {
        readonly status:
        "notEligible"

        readonly eligibility:
        Extract<
            SocialContentPublishEligibility,
            {
                readonly eligible:
                false
            }
        >

        readonly attempt:
        null

        readonly result:
        null

        readonly decision:
        null
    }
    | {
        readonly status:
        "attempted"

        readonly eligibility:
        Extract<
            SocialContentPublishEligibility,
            {
                readonly eligible:
                true
            }
        >

        readonly attempt:
        SocialContentPublishAttempt

        readonly result:
        SocialContentPublishResult

        readonly decision:
        SocialContentPublishRetryDecision
    }

// -----------------------------------------------------------------------------
// Orchestration
// -----------------------------------------------------------------------------

export async function runSocialContentPublish(
    input:
        RunSocialContentPublishInput,

    dependencies:
        SocialContentPublishRunDependencies,
): Promise<SocialContentPublishRun> {
    /**
     * One canonical worker-owned instant drives both:
     *
     * - due-time eligibility
     * - attemptedAt
     *
     * This prevents a hidden time gap between the eligibility decision
     * and the immutable attempt record.
     */
    const attemptedAt =
        dependencies.now()

    const eligibility =
        resolveSocialContentPublishEligibility({
            draft:
                input.draft,

            contentExecutionSpec:
                input.contentExecutionSpec,

            schedule:
                input.schedule,

            scheduleState:
                input.scheduleState,

            publishingAccount:
                input.publishingAccount,

            now:
                attemptedAt,
        })

    if (
        !eligibility.eligible
    ) {
        return {
            status:
                "notEligible",

            eligibility,

            attempt:
                null,

            result:
                null,

            decision:
                null,
        }
    }

    const attempt =
        assembleSocialContentPublishAttempt({
            id:
                input.attemptId,

            attemptNumber:
                input.attemptNumber,

            eligibility,

            attemptedAt,
        })

    /**
     * Exactly one provider call per orchestration run.
     *
     * Automatic retry does NOT happen here.
     */
    const providerOutcome =
        await dependencies.publish({
            attempt,

            draft:
                input.draft,

            contentExecutionSpec:
                input.contentExecutionSpec,

            publishingAccount:
                input.publishingAccount,
        })

    const recordedAt =
        dependencies.now()

    const result =
        assembleSocialContentPublishResult({
            id:
                input.resultId,

            attempt,

            outcome:
                providerOutcome,

            recordedAt,
        })

    const decision =
        resolveSocialContentPublishRetryDecision({
            attempt,

            result,

            policy:
                input.retryPolicy,
        })

    return {
        status:
            "attempted",

        eligibility,

        attempt,

        result,

        decision,
    }
}