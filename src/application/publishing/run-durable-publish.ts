import type {
    ContentExecutionSpec,
    SocialContentDraft,
    SocialContentPublishAttempt,
    SocialContentPublishAttemptId,
    SocialContentPublishEligibility,
    SocialContentPublisher,
    SocialContentPublishResult,
    SocialContentPublishResultId,
    SocialContentPublishRetryDecision,
    SocialContentPublishRetryPolicy,
    SocialContentSchedule,
    SocialContentScheduleLifecycleState,
    SocialPublishingAccount,
} from "../../blueprints/social"
import {
    IsoDateTime,
} from "../../core/domain"

import {
    assembleSocialContentPublishAttempt,
    assembleSocialContentPublishResult,
    resolveSocialContentPublishEligibility,
    resolveSocialContentPublishRetryDecision,
} from "../../blueprints/social"
import {
    isIsoDateTime,
} from "../../core/domain"
import type {
    SocialContentPublishStore,
} from "./publish-store"

// -----------------------------------------------------------------------------
// Dependencies
// -----------------------------------------------------------------------------

export type DurableSocialContentPublishRecoveryPolicy = {
    /**
     * How long an unresolved durable attempt is treated as
     * potentially still in-flight.
     *
     * During this window neither another provider call nor
     * reconciliation is allowed.
     */
    readonly unresolvedAttemptGraceMs:
    number
}

export type DurableSocialContentPublishDependencies = {
    readonly store:
    SocialContentPublishStore

    readonly publish:
    SocialContentPublisher

    readonly now:
    () => IsoDateTime
}

// -----------------------------------------------------------------------------
// Input
// -----------------------------------------------------------------------------

export type RunDurableSocialContentPublishInput = {
    readonly draft:
    SocialContentDraft

    readonly recoveryPolicy:
    DurableSocialContentPublishRecoveryPolicy

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
// Result
// -----------------------------------------------------------------------------

type IneligiblePublish =
    Extract<
        SocialContentPublishEligibility,
        {
            readonly eligible:
            false
        }
    >

type EligiblePublish =
    Extract<
        SocialContentPublishEligibility,
        {
            readonly eligible:
            true
        }
    >

export type DurableSocialContentPublishRun =
    | {
        readonly status:
        "notEligible"

        readonly eligibility:
        IneligiblePublish

        readonly attempt:
        null

        readonly result:
        null

        readonly decision:
        null
    } | {
        /**
         * Attempt already exists and has no result, but it is still
         * inside the in-flight grace window.
         *
         * Another provider call AND reconciliation are both forbidden.
         */
        readonly status:
        "inProgress"

        readonly eligibility:
        EligiblePublish

        readonly attempt:
        SocialContentPublishAttempt

        readonly result:
        null

        readonly decision:
        null

        readonly reconciliationNotBefore:
        IsoDateTime
    }
    | {
        /**
         * An attempt already exists durably but no result does.
         *
         * We cannot know whether the provider call happened before
         * the previous process died.
         *
         * Another provider call is therefore forbidden.
         */



        readonly status:
        "reconciliationRequired"

        readonly eligibility:
        EligiblePublish

        readonly attempt:
        SocialContentPublishAttempt

        readonly result:
        null

        readonly decision: {
            readonly decision:
            "requiresReconciliation"
        }
    }
    | {
        /**
         * A previous durable attempt/result already exists.
         *
         * No provider call occurred during this run.
         */
        readonly status:
        "resumed"

        readonly eligibility:
        EligiblePublish

        readonly attempt:
        SocialContentPublishAttempt

        readonly result:
        SocialContentPublishResult

        readonly decision:
        SocialContentPublishRetryDecision
    }
    | {
        /**
         * This run acquired the attempt claim and performed
         * exactly one provider call.
         */
        readonly status:
        "attempted"

        readonly eligibility:
        EligiblePublish

        readonly attempt:
        SocialContentPublishAttempt

        readonly result:
        SocialContentPublishResult

        readonly decision:
        SocialContentPublishRetryDecision
    }

// -----------------------------------------------------------------------------
// Stable publication-intent identity
// -----------------------------------------------------------------------------

function assertStoredAttemptMatchesPublicationIntent(
    proposed:
        SocialContentPublishAttempt,

    stored:
        SocialContentPublishAttempt,
): void {
    if (
        stored.idempotencyKey !==
        proposed.idempotencyKey ||
        stored.attemptNumber !==
        proposed.attemptNumber
    ) {
        throw new Error(
            "Stored publish attempt must match claimed idempotency identity",
        )
    }

    if (
        stored.contentId !==
        proposed.contentId ||
        stored.draftId !==
        proposed.draftId ||
        stored.draftVersion !==
        proposed.draftVersion ||
        stored.scheduleId !==
        proposed.scheduleId ||
        stored.publishingAccountId !==
        proposed.publishingAccountId ||
        stored.channel !==
        proposed.channel
    ) {
        throw new Error(
            "Stored publish attempt must preserve publication intent lineage",
        )
    }

    /**
     * scheduleRevision, publishAt, attemptedAt and attempt ID are
     * deliberately NOT compared here.
     *
     * A reschedule may change revision/publishAt while the
     * idempotency identity remains the same.
     *
     * The already-stored attempt remains canonical.
     */
}
const ABSOLUTE_ISO_DATE_TIME_PATTERN =
    /(?:Z|[+-]\d{2}:\d{2})$/u

function absoluteInstant(
    value:
        IsoDateTime,

    label:
        string,
): number {
    const raw =
        value as string

    if (
        !isIsoDateTime(raw) ||
        !ABSOLUTE_ISO_DATE_TIME_PATTERN.test(
            raw,
        )
    ) {
        throw new Error(
            `${label} must be a valid absolute ISO date-time`,
        )
    }

    const instant =
        Date.parse(raw)

    if (
        !Number.isFinite(
            instant,
        )
    ) {
        throw new Error(
            `${label} must represent a valid instant`,
        )
    }

    return instant
}

// -----------------------------------------------------------------------------
// Orchestration
// -----------------------------------------------------------------------------

export async function runDurableSocialContentPublish(
    input:
        RunDurableSocialContentPublishInput,

    dependencies:
        DurableSocialContentPublishDependencies,
): Promise<DurableSocialContentPublishRun> {
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

    const proposedAttempt =
        assembleSocialContentPublishAttempt({
            id:
                input.attemptId,

            attemptNumber:
                input.attemptNumber,

            eligibility,

            attemptedAt
        })

    /**
     * CRITICAL DURABILITY BOUNDARY:
     *
     * The attempt is claimed BEFORE any provider call.
     */
    const claim =
        await dependencies.store.claimAttempt(
            proposedAttempt,
        )

    if (
        claim.status ===
        "alreadyRecorded"
    ) {
        assertStoredAttemptMatchesPublicationIntent(
            proposedAttempt,
            claim.attempt,
        )

        if (
            claim.result ===
            null
        ) {
            const graceMs =
                input.recoveryPolicy
                    .unresolvedAttemptGraceMs

            if (
                !Number.isSafeInteger(
                    graceMs,
                ) ||
                graceMs < 1
            ) {
                throw new Error(
                    "Unresolved publish attempt grace must be a positive safe integer",
                )
            }

            const currentInstant =
                absoluteInstant(
                    attemptedAt,
                    "current publish run time",
                )

            const storedAttemptInstant =
                absoluteInstant(
                    claim.attempt.attemptedAt,
                    "stored attempt attemptedAt",
                )

            if (
                currentInstant <
                storedAttemptInstant
            ) {
                throw new Error(
                    "Current publish run cannot predate the stored attempt",
                )
            }

            const reconciliationInstant =
                storedAttemptInstant +
                graceMs

            const reconciliationDate =
                new Date(
                    reconciliationInstant,
                )

            if (
                Number.isNaN(
                    reconciliationDate.getTime(),
                )
            ) {
                throw new Error(
                    "Publish reconciliation boundary must represent a valid instant",
                )
            }

            const reconciliationNotBefore =
                reconciliationDate
                    .toISOString() as IsoDateTime

            if (
                currentInstant <
                reconciliationInstant
            ) {
                return {
                    status:
                        "inProgress",

                    eligibility,

                    attempt:
                        claim.attempt,

                    result:
                        null,

                    decision:
                        null,

                    reconciliationNotBefore,
                }
            }

            return {
                status:
                    "reconciliationRequired",

                eligibility,

                attempt:
                    claim.attempt,

                result:
                    null,

                decision: {
                    decision:
                        "requiresReconciliation",
                },
            }
        }

        const decision =
            resolveSocialContentPublishRetryDecision({
                attempt:
                    claim.attempt,

                result:
                    claim.result,

                policy:
                    input.retryPolicy,
            })

        return {
            status:
                "resumed",

            eligibility,

            attempt:
                claim.attempt,

            result:
                claim.result,

            decision,
        }
    }

    /**
     * Only "acquired" reaches this point.
     *
     * Exactly one worker owns permission to call the provider.
     */
    const providerOutcome =
        await dependencies.publish({
            attempt:
                proposedAttempt,

            draft:
                input.draft,

            contentExecutionSpec:
                input.contentExecutionSpec,

            publishingAccount:
                input.publishingAccount,
        })

    const recordedAt =
        dependencies.now()

    const proposedResult =
        assembleSocialContentPublishResult({
            id:
                input.resultId,

            attempt:
                proposedAttempt,

            outcome:
                providerOutcome,

            recordedAt,
        })

    const resultRecord =
        await dependencies.store.recordResult(
            proposedResult,
        )

    /**
     * recordResult is itself idempotent.
     *
     * If the canonical result already exists, always use
     * the stored result rather than the newly proposed one.
     */
    const canonicalResult =
        resultRecord.status ===
            "recorded"
            ? proposedResult
            : resultRecord.result

    const decision =
        resolveSocialContentPublishRetryDecision({
            attempt:
                proposedAttempt,

            result:
                canonicalResult,

            policy:
                input.retryPolicy,
        })

    return {
        status:
            "attempted",

        eligibility,

        attempt:
            proposedAttempt,

        result:
            canonicalResult,

        decision,
    }
}