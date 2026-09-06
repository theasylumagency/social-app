import type {
    DomainId,
    IsoDateTime,
} from "../../core/domain"

import {
    isIsoDateTime,
} from "../../core/domain"

import type {
    SocialContentPublishAttempt,
} from "./content-publish-attempt"

import type {
    SocialContentPublishResult,
    SocialContentUnknownOutcomeResult,
} from "./content-publish-result"

// -----------------------------------------------------------------------------
// Identity
// -----------------------------------------------------------------------------

export type SocialContentPublishReconciliationId =
    DomainId<"SocialContentPublishReconciliationId">

// -----------------------------------------------------------------------------
// Provider reconciliation outcome
// -----------------------------------------------------------------------------

export type SocialContentPublishReconciliationOutcome =
    | {
        readonly status:
        "publicationFound"

        readonly providerPublicationRef:
        string

        readonly publishedAt:
        IsoDateTime
    }
    | {
        /**
         * Provider has positively established that the publication
         * was not created.
         *
         * This is stronger than "not found in one lookup".
         */
        readonly status:
        "confirmedAbsent"
    }
    | {
        /**
         * We still cannot establish whether publication happened.
         *
         * Automatic retry remains unsafe.
         */
        readonly status:
        "inconclusive"

        readonly reasonCode:
        string

        readonly message?:
        string
    }

// -----------------------------------------------------------------------------
// Canonical reconciliation record
// -----------------------------------------------------------------------------

type SocialContentPublishReconciliationBase = {
    readonly id:
    SocialContentPublishReconciliationId

    readonly unknownResultId:
    SocialContentUnknownOutcomeResult["id"]

    readonly attemptId:
    SocialContentPublishAttempt["id"]

    readonly idempotencyKey:
    SocialContentPublishAttempt["idempotencyKey"]

    readonly contentId:
    SocialContentPublishAttempt["contentId"]

    readonly draftId:
    SocialContentPublishAttempt["draftId"]

    readonly draftVersion:
    number

    readonly scheduleId:
    SocialContentPublishAttempt["scheduleId"]

    readonly scheduleRevision:
    number

    readonly publishingAccountId:
    SocialContentPublishAttempt["publishingAccountId"]

    readonly channel:
    SocialContentPublishAttempt["channel"]

    readonly checkedAt:
    IsoDateTime
}

export type SocialContentPublishReconciliation =
    | (
        SocialContentPublishReconciliationBase & {
            readonly status:
            "publicationFound"

            readonly providerPublicationRef:
            string

            readonly publishedAt:
            IsoDateTime
        }
    )
    | (
        SocialContentPublishReconciliationBase & {
            readonly status:
            "confirmedAbsent"
        }
    )
    | (
        SocialContentPublishReconciliationBase & {
            readonly status:
            "inconclusive"

            readonly reasonCode:
            string

            readonly message?:
            string
        }
    )

// -----------------------------------------------------------------------------
// Validation helpers
// -----------------------------------------------------------------------------

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

function requiredText(
    value:
        string,

    label:
        string,
): string {
    const normalized =
        value.trim()

    if (
        normalized.length ===
        0
    ) {
        throw new Error(
            `${label} must not be blank`,
        )
    }

    return normalized
}

function optionalText(
    value:
        string | undefined,
): string | undefined {
    if (
        value ===
        undefined
    ) {
        return undefined
    }

    const normalized =
        value.trim()

    return normalized.length === 0
        ? undefined
        : normalized
}

// -----------------------------------------------------------------------------
// Provenance
// -----------------------------------------------------------------------------

function assertUnknownResultBelongsToAttempt(
    attempt:
        SocialContentPublishAttempt,

    result:
        SocialContentPublishResult,
): asserts result is SocialContentUnknownOutcomeResult {
    if (
        result.status !==
        "unknownOutcome"
    ) {
        throw new Error(
            "Publish reconciliation requires an unknownOutcome result",
        )
    }

    if (
        result.attemptId !==
        attempt.id
    ) {
        throw new Error(
            "Unknown publish result must belong to the supplied attempt",
        )
    }

    if (
        result.idempotencyKey !==
        attempt.idempotencyKey
    ) {
        throw new Error(
            "Unknown publish result must preserve attempt idempotency key",
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
            "Unknown publish result must preserve attempt publication lineage",
        )
    }
}

// -----------------------------------------------------------------------------
// Assembly
// -----------------------------------------------------------------------------

export type AssembleSocialContentPublishReconciliationInput = {
    readonly id:
    SocialContentPublishReconciliationId

    readonly attempt:
    SocialContentPublishAttempt

    readonly unknownResult:
    SocialContentPublishResult

    readonly outcome:
    SocialContentPublishReconciliationOutcome

    readonly checkedAt:
    IsoDateTime
}

export function assembleSocialContentPublishReconciliation(
    input:
        AssembleSocialContentPublishReconciliationInput,
): SocialContentPublishReconciliation {
    assertUnknownResultBelongsToAttempt(
        input.attempt,
        input.unknownResult,
    )

    const attemptedAt =
        absoluteInstant(
            input.attempt.attemptedAt,
            "attemptedAt",
        )

    const recordedAt =
        absoluteInstant(
            input.unknownResult.recordedAt,
            "unknown result recordedAt",
        )

    const checkedAt =
        absoluteInstant(
            input.checkedAt,
            "checkedAt",
        )

    if (
        checkedAt <
        recordedAt
    ) {
        throw new Error(
            "Publish reconciliation cannot predate the unknown result",
        )
    }

    const base:
        SocialContentPublishReconciliationBase =
    {
        id:
            input.id,

        unknownResultId:
            input.unknownResult.id,

        attemptId:
            input.attempt.id,

        idempotencyKey:
            input.attempt.idempotencyKey,

        contentId:
            input.attempt.contentId,

        draftId:
            input.attempt.draftId,

        draftVersion:
            input.attempt.draftVersion,

        scheduleId:
            input.attempt.scheduleId,

        scheduleRevision:
            input.attempt.scheduleRevision,

        publishingAccountId:
            input.attempt.publishingAccountId,

        channel:
            input.attempt.channel,

        checkedAt:
            input.checkedAt,
    }

    switch (
    input.outcome.status
    ) {
        case "publicationFound": {
            const publishedAt =
                absoluteInstant(
                    input.outcome.publishedAt,
                    "publishedAt",
                )

            if (
                publishedAt <
                attemptedAt
            ) {
                throw new Error(
                    "Reconciled publishedAt cannot predate the publish attempt",
                )
            }

            if (
                publishedAt >
                checkedAt
            ) {
                throw new Error(
                    "Reconciled publishedAt cannot be later than checkedAt",
                )
            }

            return {
                ...base,

                status:
                    "publicationFound",

                providerPublicationRef:
                    requiredText(
                        input.outcome.providerPublicationRef,
                        "providerPublicationRef",
                    ),

                publishedAt:
                    input.outcome.publishedAt,
            }
        }

        case "confirmedAbsent":
            return {
                ...base,

                status:
                    "confirmedAbsent",
            }

        case "inconclusive": {
            const message =
                optionalText(
                    input.outcome.message,
                )

            return {
                ...base,

                status:
                    "inconclusive",

                reasonCode:
                    requiredText(
                        input.outcome.reasonCode,
                        "reasonCode",
                    ),

                ...(message === undefined
                    ? {}
                    : {
                        message,
                    }),
            }
        }
    }
}