import type {
    DomainId,
    IsoDateTime,
} from "../../core/domain"

import {
    isIsoDateTime,
} from "../../core/domain"

import type {
    SocialContentPublishAttempt,
    SocialContentPublishAttemptId,
    SocialContentPublishIdempotencyKey,
} from "./content-publish-attempt"

// -----------------------------------------------------------------------------
// Identity
// -----------------------------------------------------------------------------

export type SocialContentPublishResultId =
    DomainId<"SocialContentPublishResultId">

// -----------------------------------------------------------------------------
// Canonical result
// -----------------------------------------------------------------------------

type SocialContentPublishResultBase = {
    readonly id:
    SocialContentPublishResultId

    readonly attemptId:
    SocialContentPublishAttemptId

    readonly idempotencyKey:
    SocialContentPublishIdempotencyKey

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

    readonly recordedAt:
    IsoDateTime
}

export type SocialContentPublishedResult =
    SocialContentPublishResultBase & {
        readonly status:
        "published"

        /**
         * Stable provider-side identifier for the created post/media.
         */
        readonly providerPublicationRef:
        string

        readonly publishedAt:
        IsoDateTime
    }

export type SocialContentRetryableFailureResult =
    SocialContentPublishResultBase & {
        readonly status:
        "retryableFailure"

        readonly errorCode:
        string

        readonly message?:
        string

        /**
         * Optional next safe retry instant.
         */
        readonly retryAfter?:
        IsoDateTime
    }

export type SocialContentPermanentFailureResult =
    SocialContentPublishResultBase & {
        readonly status:
        "permanentFailure"

        readonly errorCode:
        string

        readonly message?:
        string
    }

export type SocialContentUnknownOutcomeResult =
    SocialContentPublishResultBase & {
        readonly status:
        "unknownOutcome"

        readonly errorCode:
        string

        readonly message?:
        string
    }

export type SocialContentPublishResult =
    | SocialContentPublishedResult
    | SocialContentRetryableFailureResult
    | SocialContentPermanentFailureResult
    | SocialContentUnknownOutcomeResult

// -----------------------------------------------------------------------------
// Provider outcome input
// -----------------------------------------------------------------------------

export type SocialContentPublishProviderOutcome =
    | {
        readonly status:
        "published"

        readonly providerPublicationRef:
        string

        readonly publishedAt:
        IsoDateTime
    }
    | {
        readonly status:
        "retryableFailure"

        readonly errorCode:
        string

        readonly message?:
        string

        readonly retryAfter?:
        IsoDateTime
    }
    | {
        readonly status:
        "permanentFailure"

        readonly errorCode:
        string

        readonly message?:
        string
    }
    | {
        readonly status:
        "unknownOutcome"

        readonly errorCode:
        string

        readonly message?:
        string
    }

// -----------------------------------------------------------------------------
// Validation
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
// Assembly
// -----------------------------------------------------------------------------

export type AssembleSocialContentPublishResultInput = {
    readonly id:
    SocialContentPublishResultId

    readonly attempt:
    SocialContentPublishAttempt

    readonly outcome:
    SocialContentPublishProviderOutcome

    readonly recordedAt:
    IsoDateTime
}

export function assembleSocialContentPublishResult(
    input:
        AssembleSocialContentPublishResultInput,
): SocialContentPublishResult {
    const attemptedAt =
        absoluteInstant(
            input.attempt.attemptedAt,
            "attemptedAt",
        )

    const recordedAt =
        absoluteInstant(
            input.recordedAt,
            "recordedAt",
        )

    if (
        recordedAt <
        attemptedAt
    ) {
        throw new Error(
            "Publish result cannot be recorded before its attempt",
        )
    }

    const base:
        SocialContentPublishResultBase =
    {
        id:
            input.id,

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

        recordedAt:
            input.recordedAt,
    }

    switch (
    input.outcome.status
    ) {
        case "published": {
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
                    "publishedAt cannot predate the publish attempt",
                )
            }
            if (
                publishedAt >
                recordedAt
            ) {
                throw new Error(
                    "publishedAt cannot be later than recordedAt",
                )
            }
            return {
                ...base,

                status:
                    "published",

                providerPublicationRef:
                    requiredText(
                        input.outcome.providerPublicationRef,
                        "providerPublicationRef",
                    ),

                publishedAt:
                    input.outcome.publishedAt,
            }
        }

        case "retryableFailure": {
            const errorCode =
                requiredText(
                    input.outcome.errorCode,
                    "errorCode",
                )

            const message =
                optionalText(
                    input.outcome.message,
                )

            if (
                input.outcome.retryAfter !==
                undefined
            ) {
                const retryAfter =
                    absoluteInstant(
                        input.outcome.retryAfter,
                        "retryAfter",
                    )

                if (
                    retryAfter <=
                    recordedAt
                ) {
                    throw new Error(
                        "retryAfter must be later than recordedAt",
                    )
                }

                return {
                    ...base,

                    status:
                        "retryableFailure",

                    errorCode,

                    ...(message === undefined
                        ? {}
                        : {
                            message,
                        }),

                    retryAfter:
                        input.outcome.retryAfter,
                }
            }

            return {
                ...base,

                status:
                    "retryableFailure",

                errorCode,

                ...(message === undefined
                    ? {}
                    : {
                        message,
                    }),
            }
        }

        case "permanentFailure": {
            const message =
                optionalText(
                    input.outcome.message,
                )

            return {
                ...base,

                status:
                    "permanentFailure",

                errorCode:
                    requiredText(
                        input.outcome.errorCode,
                        "errorCode",
                    ),

                ...(message === undefined
                    ? {}
                    : {
                        message,
                    }),
            }
        }

        case "unknownOutcome": {
            const message =
                optionalText(
                    input.outcome.message,
                )

            return {
                ...base,

                status:
                    "unknownOutcome",

                errorCode:
                    requiredText(
                        input.outcome.errorCode,
                        "errorCode",
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