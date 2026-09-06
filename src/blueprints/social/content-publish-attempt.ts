import type {
    DomainId,
    IsoDateTime,
} from "../../core/domain"

import {
    isIsoDateTime,
} from "../../core/domain"

import type {
    SocialContentPublishEligibility,
} from "./content-publish-eligibility"

// -----------------------------------------------------------------------------
// Identity
// -----------------------------------------------------------------------------

export type SocialContentPublishAttemptId =
    DomainId<"SocialContentPublishAttemptId">

export type SocialContentPublishIdempotencyKey =
    string

type EligibleSocialContentForPublishing =
    Extract<
        SocialContentPublishEligibility,
        {
            readonly eligible:
            true
        }
    >

// -----------------------------------------------------------------------------
// Attempt
// -----------------------------------------------------------------------------

export type SocialContentPublishAttempt = {
    readonly id:
    SocialContentPublishAttemptId
    readonly attemptNumber:
    number
    /**
     * Stable across retries of the same publication intent.
     */
    readonly idempotencyKey:
    SocialContentPublishIdempotencyKey

    readonly contentId:
    EligibleSocialContentForPublishing["contentId"]

    readonly draftId:
    EligibleSocialContentForPublishing["draftId"]

    readonly draftVersion:
    number

    readonly scheduleId:
    EligibleSocialContentForPublishing["scheduleId"]

    /**
     * Exact schedule lifecycle revision that authorized this attempt.
     *
     * This belongs in provenance, but deliberately NOT in the
     * idempotency key.
     */
    readonly scheduleRevision:
    number

    readonly publishingAccountId:
    EligibleSocialContentForPublishing["publishingAccountId"]

    readonly channel:
    EligibleSocialContentForPublishing["channel"]

    readonly publishAt:
    IsoDateTime

    readonly attemptedAt:
    IsoDateTime
}

// -----------------------------------------------------------------------------
// Idempotency
// -----------------------------------------------------------------------------

function idempotencyPart(
    value:
        string | number,
): string {
    return encodeURIComponent(
        String(value),
    )
}

export function createSocialContentPublishIdempotencyKey(
    eligibility:
        EligibleSocialContentForPublishing,
): SocialContentPublishIdempotencyKey {
    return [
        "social-publish:v1",

        `schedule=${idempotencyPart(
            eligibility.scheduleId as string,
        )}`,

        `draft=${idempotencyPart(
            eligibility.draftId as string,
        )}`,

        `version=${idempotencyPart(
            eligibility.draftVersion,
        )}`,

        `account=${idempotencyPart(
            eligibility.publishingAccountId as string,
        )}`,
    ].join("|")
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

// -----------------------------------------------------------------------------
// Assembly
// -----------------------------------------------------------------------------

export type AssembleSocialContentPublishAttemptInput = {
    readonly id:
    SocialContentPublishAttemptId

    readonly attemptNumber:
    number

    readonly eligibility:
    EligibleSocialContentForPublishing

    readonly attemptedAt:
    IsoDateTime
}

export function assembleSocialContentPublishAttempt(
    input:
        AssembleSocialContentPublishAttemptInput,
): SocialContentPublishAttempt {
    const eligibility =
        input.eligibility as
        SocialContentPublishEligibility
    if (
        !Number.isInteger(
            input.attemptNumber,
        ) ||
        input.attemptNumber < 1
    ) {
        throw new Error(
            "Publish attempt number must be a positive integer",
        )
    }
    if (
        eligibility.eligible !==
        true
    ) {
        throw new Error(
            "Publish attempt requires eligible content",
        )
    }

    if (
        !Number.isInteger(
            eligibility.draftVersion,
        ) ||
        eligibility.draftVersion < 1
    ) {
        throw new Error(
            "Publish attempt draft version must be a positive integer",
        )
    }

    if (
        !Number.isInteger(
            eligibility.scheduleRevision,
        ) ||
        eligibility.scheduleRevision < 0
    ) {
        throw new Error(
            "Publish attempt schedule revision must be a non-negative integer",
        )
    }

    const publishAt =
        absoluteInstant(
            eligibility.publishAt,
            "publishAt",
        )

    const attemptedAt =
        absoluteInstant(
            input.attemptedAt,
            "attemptedAt",
        )

    if (
        attemptedAt <
        publishAt
    ) {
        throw new Error(
            "Publish attempt cannot occur before publishAt",
        )
    }

    return {
        id:
            input.id,
        attemptNumber:
            input.attemptNumber,
        idempotencyKey:
            createSocialContentPublishIdempotencyKey(
                eligibility,
            ),

        contentId:
            eligibility.contentId,

        draftId:
            eligibility.draftId,

        draftVersion:
            eligibility.draftVersion,

        scheduleId:
            eligibility.scheduleId,

        scheduleRevision:
            eligibility.scheduleRevision,

        publishingAccountId:
            eligibility.publishingAccountId,

        channel:
            eligibility.channel,

        publishAt:
            eligibility.publishAt,

        attemptedAt:
            input.attemptedAt,
    }
}