import type {
    ClaimContextChannel,
    ContentId,
    DomainId,
    IsoDateTime,
} from "../../core/domain"
import {
    isIsoDateTime,
} from "../../core/domain"
import type {
    ContentExecutionSpec,
} from "./content-execution-spec"

import type {
    SocialContentDraft,
    SocialContentDraftId,
} from "./content-draft"

import type {
    SocialContentSchedulingAuthorization,
    SocialContentSchedulingEligibility,
} from "./content-scheduling-eligibility"

// -----------------------------------------------------------------------------
// Identity
// -----------------------------------------------------------------------------

export type SocialContentScheduleId =
    DomainId<"SocialContentScheduleId">

// -----------------------------------------------------------------------------
// Eligible input
// -----------------------------------------------------------------------------

export type EligibleSocialContentForScheduling =
    Extract<
        SocialContentSchedulingEligibility,
        {
            readonly eligible:
            true
        }
    >

// -----------------------------------------------------------------------------
// Canonical initial schedule entry
// -----------------------------------------------------------------------------

export type SocialContentSchedule = {
    readonly id:
    SocialContentScheduleId

    readonly contentId:
    ContentId

    /**
     * Scheduling is pinned to one immutable draft.
     */
    readonly draftId:
    SocialContentDraftId

    readonly draftVersion:
    number

    readonly contentExecutionSpecId:
    ContentExecutionSpec["id"]

    readonly channel:
    ClaimContextChannel

    /**
     * Snapshot of WHY this exact draft was allowed
     * to enter the publishing queue.
     */
    readonly authorization:
    SocialContentSchedulingAuthorization

    /**
     * Intended provider-local publication instant,
     * represented as an absolute ISO date-time.
     */
    readonly publishAt:
    IsoDateTime

    readonly scheduledAt:
    IsoDateTime
}

// -----------------------------------------------------------------------------
// Assembly
// -----------------------------------------------------------------------------

export type AssembleSocialContentScheduleInput = {
    readonly id:
    SocialContentScheduleId

    readonly draft:
    SocialContentDraft

    readonly contentExecutionSpec:
    ContentExecutionSpec

    readonly eligibility:
    EligibleSocialContentForScheduling

    readonly publishAt:
    IsoDateTime

    readonly scheduledAt:
    IsoDateTime
}

function assertPositiveVersion(
    version:
        number,
): void {
    if (
        !Number.isInteger(version) ||
        version < 1
    ) {
        throw new Error(
            "Scheduled content draft version must be a positive integer",
        )
    }
}

function assertSchedulingIdentity(
    input:
        AssembleSocialContentScheduleInput,
): void {
    const {
        draft,
        contentExecutionSpec,
        eligibility,
    } = input
    if (
        (
            eligibility as
            SocialContentSchedulingEligibility
        ).eligible !== true
    ) {
        throw new Error(
            "Only eligible content may be scheduled",
        )
    }
    assertPositiveVersion(
        draft.version,
    )

    if (
        eligibility.contentId !==
        draft.contentId
    ) {
        throw new Error(
            "Scheduling eligibility ContentId must match draft",
        )
    }

    if (
        eligibility.draftId !==
        draft.id
    ) {
        throw new Error(
            "Scheduling eligibility must authorize the exact draft",
        )
    }

    if (
        eligibility.draftVersion !==
        draft.version
    ) {
        throw new Error(
            "Scheduling eligibility must authorize the exact draft version",
        )
    }

    if (
        draft.contentExecutionSpecId !==
        contentExecutionSpec.id
    ) {
        throw new Error(
            "Scheduled draft must match Content Execution Spec",
        )
    }

    if (
        draft.contentBriefId !==
        contentExecutionSpec.contentBriefId
    ) {
        throw new Error(
            "Scheduled draft and Content Execution Spec must share Content Brief provenance",
        )
    }

    if (
        draft.format !==
        contentExecutionSpec.format
    ) {
        throw new Error(
            "Scheduled draft format must match Content Execution Spec",
        )
    }
}
const ABSOLUTE_ISO_DATE_TIME_PATTERN =
    /(?:Z|[+-]\d{2}:\d{2})$/u

function assertValidScheduleTimes(
    publishAt:
        IsoDateTime,

    scheduledAt:
        IsoDateTime,
): void {
    const publishAtValue =
        publishAt as string

    const scheduledAtValue =
        scheduledAt as string

    if (
        !isIsoDateTime(
            publishAtValue,
        ) ||
        !ABSOLUTE_ISO_DATE_TIME_PATTERN.test(
            publishAtValue,
        )
    ) {
        throw new Error(
            "publishAt must be a valid absolute ISO date-time",
        )
    }

    if (
        !isIsoDateTime(
            scheduledAtValue,
        ) ||
        !ABSOLUTE_ISO_DATE_TIME_PATTERN.test(
            scheduledAtValue,
        )
    ) {
        throw new Error(
            "scheduledAt must be a valid absolute ISO date-time",
        )
    }

    const publishTime =
        Date.parse(
            publishAtValue,
        )

    const scheduledTime =
        Date.parse(
            scheduledAtValue,
        )

    if (
        !Number.isFinite(
            publishTime,
        ) ||
        !Number.isFinite(
            scheduledTime,
        )
    ) {
        throw new Error(
            "Schedule timestamps must represent valid instants",
        )
    }

    if (
        publishTime <=
        scheduledTime
    ) {
        throw new Error(
            "publishAt must be later than scheduledAt",
        )
    }
}
export function assembleSocialContentSchedule(
    input:
        AssembleSocialContentScheduleInput,
): SocialContentSchedule {
    assertSchedulingIdentity(
        input,
    )
    assertValidScheduleTimes(
        input.publishAt,
        input.scheduledAt,
    )
    return {
        id:
            input.id,

        contentId:
            input.draft.contentId,

        draftId:
            input.draft.id,

        draftVersion:
            input.draft.version,

        contentExecutionSpecId:
            input.contentExecutionSpec.id,

        channel:
            input.contentExecutionSpec.channel,

        authorization:
            input.eligibility.authorization,

        publishAt:
            input.publishAt,

        scheduledAt:
            input.scheduledAt,
    }
}