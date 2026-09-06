import type {
    IsoDateTime,
} from "../../core/domain"

import type {
    SocialContentPublishAttempt,
} from "./content-publish-attempt"

import type {
    SocialContentPublishResult,
} from "./content-publish-result"

// -----------------------------------------------------------------------------
// Policy
// -----------------------------------------------------------------------------

export type SocialContentPublishRetryPolicy = {
    /**
     * Includes the initial attempt.
     *
     * maxAttempts = 3 means:
     * attempt #1
     * attempt #2
     * attempt #3
     * then exhausted.
     */
    readonly maxAttempts:
    number
}

// -----------------------------------------------------------------------------
// Decision
// -----------------------------------------------------------------------------

export type SocialContentPublishRetryDecision =
    | {
        readonly decision:
        "done"
    }
    | {
        readonly decision:
        "stop"
    }
    | {
        readonly decision:
        "requiresReconciliation"
    }
    | {
        readonly decision:
        "retryAllowed"

        readonly nextAttemptNumber:
        number

        readonly retryAfter?:
        IsoDateTime
    }
    | {
        readonly decision:
        "retryExhausted"
    }

// -----------------------------------------------------------------------------
// Provenance
// -----------------------------------------------------------------------------

function assertResultBelongsToAttempt(
    attempt:
        SocialContentPublishAttempt,

    result:
        SocialContentPublishResult,
): void {
    if (
        result.attemptId !==
        attempt.id
    ) {
        throw new Error(
            "Publish result must belong to the supplied attempt",
        )
    }

    if (
        result.idempotencyKey !==
        attempt.idempotencyKey
    ) {
        throw new Error(
            "Publish result must preserve attempt idempotency key",
        )
    }

    if (
        result.contentId !==
        attempt.contentId ||
        result.draftId !==
        attempt.draftId ||
        result.draftVersion !==
        attempt.draftVersion ||
        result.scheduleId !==
        attempt.scheduleId ||
        result.scheduleRevision !==
        attempt.scheduleRevision ||
        result.publishingAccountId !==
        attempt.publishingAccountId ||
        result.channel !==
        attempt.channel
    ) {
        throw new Error(
            "Publish result must preserve attempt publication lineage",
        )
    }
}

// -----------------------------------------------------------------------------
// Resolution
// -----------------------------------------------------------------------------

export type ResolveSocialContentPublishRetryDecisionInput = {
    readonly attempt:
    SocialContentPublishAttempt

    readonly result:
    SocialContentPublishResult

    readonly policy:
    SocialContentPublishRetryPolicy
}

export function resolveSocialContentPublishRetryDecision(
    input:
        ResolveSocialContentPublishRetryDecisionInput,
): SocialContentPublishRetryDecision {
    const {
        attempt,
        result,
        policy,
    } = input

    assertResultBelongsToAttempt(
        attempt,
        result,
    )

    if (
        !Number.isInteger(
            attempt.attemptNumber,
        ) ||
        attempt.attemptNumber < 1
    ) {
        throw new Error(
            "Publish attempt number must be a positive integer",
        )
    }

    if (
        !Number.isInteger(
            policy.maxAttempts,
        ) ||
        policy.maxAttempts < 1
    ) {
        throw new Error(
            "Publish retry maxAttempts must be a positive integer",
        )
    }

    switch (
    result.status
    ) {
        case "published":
            return {
                decision:
                    "done",
            }

        case "permanentFailure":
            return {
                decision:
                    "stop",
            }

        case "unknownOutcome":
            return {
                decision:
                    "requiresReconciliation",
            }

        case "retryableFailure": {
            if (
                attempt.attemptNumber >=
                policy.maxAttempts
            ) {
                return {
                    decision:
                        "retryExhausted",
                }
            }

            return {
                decision:
                    "retryAllowed",

                nextAttemptNumber:
                    attempt.attemptNumber + 1,

                ...(result.retryAfter ===
                    undefined
                    ? {}
                    : {
                        retryAfter:
                            result.retryAfter,
                    }),
            }
        }
    }
}