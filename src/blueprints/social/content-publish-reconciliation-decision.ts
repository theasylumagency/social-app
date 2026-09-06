import type {
    SocialContentPublishAttempt,
} from "./content-publish-attempt"

import type {
    SocialContentPublishReconciliation,
} from "./content-publish-reconciliation"

import type {
    SocialContentPublishRetryPolicy,
} from "./content-publish-retry-decision"

// -----------------------------------------------------------------------------
// Decision
// -----------------------------------------------------------------------------

export type SocialContentPublishReconciliationDecision =
    | {
        readonly decision:
        "done"
    }
    | {
        readonly decision:
        "retryAllowed"

        readonly nextAttemptNumber:
        number
    }
    | {
        readonly decision:
        "retryExhausted"
    }
    | {
        readonly decision:
        "requiresReview"
    }

// -----------------------------------------------------------------------------
// Provenance
// -----------------------------------------------------------------------------

function assertReconciliationBelongsToAttempt(
    attempt:
        SocialContentPublishAttempt,

    reconciliation:
        SocialContentPublishReconciliation,
): void {
    if (
        reconciliation.attemptId !==
        attempt.id
    ) {
        throw new Error(
            "Publish reconciliation must belong to the supplied attempt",
        )
    }

    if (
        reconciliation.idempotencyKey !==
        attempt.idempotencyKey
    ) {
        throw new Error(
            "Publish reconciliation must preserve attempt idempotency key",
        )
    }

    if (
        reconciliation.contentId !==
        attempt.contentId ||
        reconciliation.draftId !==
        attempt.draftId ||
        reconciliation.draftVersion !==
        attempt.draftVersion ||
        reconciliation.scheduleId !==
        attempt.scheduleId ||
        reconciliation.scheduleRevision !==
        attempt.scheduleRevision ||
        reconciliation.publishingAccountId !==
        attempt.publishingAccountId ||
        reconciliation.channel !==
        attempt.channel
    ) {
        throw new Error(
            "Publish reconciliation must preserve attempt publication lineage",
        )
    }
}

// -----------------------------------------------------------------------------
// Resolution
// -----------------------------------------------------------------------------

export type ResolveSocialContentPublishReconciliationDecisionInput = {
    readonly attempt:
    SocialContentPublishAttempt

    readonly reconciliation:
    SocialContentPublishReconciliation

    readonly policy:
    SocialContentPublishRetryPolicy
}

export function resolveSocialContentPublishReconciliationDecision(
    input:
        ResolveSocialContentPublishReconciliationDecisionInput,
): SocialContentPublishReconciliationDecision {
    const {
        attempt,
        reconciliation,
        policy,
    } = input

    assertReconciliationBelongsToAttempt(
        attempt,
        reconciliation,
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
    reconciliation.status
    ) {
        case "publicationFound":
            return {
                decision:
                    "done",
            }

        case "inconclusive":
            return {
                decision:
                    "requiresReview",
            }

        case "confirmedAbsent": {
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
            }
        }
    }
}