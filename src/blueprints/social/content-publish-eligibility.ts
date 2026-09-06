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
    SocialContentDraft,
    SocialContentDraftId,
} from "./content-draft"

import type {
    ContentExecutionSpec,
} from "./content-execution-spec"

import type {
    SocialContentSchedule,
} from "./content-schedule"

import type {
    SocialContentScheduleLifecycleState,
} from "./content-schedule-lifecycle"

// -----------------------------------------------------------------------------
// Connected publishing account
// -----------------------------------------------------------------------------

export type SocialPublishingAccountId =
    DomainId<"SocialPublishingAccountId">

export type SocialPublishingAccount = {
    readonly id:
    SocialPublishingAccountId

    readonly channel:
    ClaimContextChannel

    /**
     * Internal stable provider-side account reference.
     *
     * Access tokens / secrets do NOT belong in this domain object.
     */
    readonly providerAccountRef:
    string

    readonly connected:
    boolean
}

// -----------------------------------------------------------------------------
// Eligibility
// -----------------------------------------------------------------------------

export type SocialContentPublishEligibility =
    | {
        readonly eligible:
        true

        readonly contentId:
        ContentId

        readonly draftId:
        SocialContentDraftId

        readonly draftVersion:
        number

        readonly scheduleId:
        SocialContentSchedule["id"]

        readonly publishingAccountId:
        SocialPublishingAccountId

        readonly channel:
        ClaimContextChannel

        readonly publishAt:
        IsoDateTime

        readonly scheduleRevision:
        number
    }
    | {
        readonly eligible:
        false

        readonly reason:
        | "scheduleCancelled"
        | "notDue"
        | "publishingAccountDisconnected"
        | "channelMismatch"
    }

// -----------------------------------------------------------------------------
// Input
// -----------------------------------------------------------------------------

export type ResolveSocialContentPublishEligibilityInput = {
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

    /**
     * Worker-owned current instant.
     */
    readonly now:
    IsoDateTime
}

// -----------------------------------------------------------------------------
// Time
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
// Provenance
// -----------------------------------------------------------------------------

function assertPublishProvenance(
    input:
        ResolveSocialContentPublishEligibilityInput,
): void {
    const {
        draft,
        contentExecutionSpec,
        schedule,
        scheduleState,
    } = input

    if (
        schedule.contentId !==
        draft.contentId
    ) {
        throw new Error(
            "Publish schedule ContentId must match draft",
        )
    }

    if (
        schedule.draftId !==
        draft.id ||
        schedule.draftVersion !==
        draft.version
    ) {
        throw new Error(
            "Publish schedule must target the exact draft and version",
        )
    }

    if (
        schedule.contentExecutionSpecId !==
        contentExecutionSpec.id
    ) {
        throw new Error(
            "Publish schedule must match Content Execution Spec",
        )
    }

    if (
        draft.contentExecutionSpecId !==
        contentExecutionSpec.id
    ) {
        throw new Error(
            "Publish draft must match Content Execution Spec",
        )
    }

    if (
        draft.contentBriefId !==
        contentExecutionSpec.contentBriefId
    ) {
        throw new Error(
            "Publish draft and Content Execution Spec must share Content Brief provenance",
        )
    }

    if (
        draft.format !==
        contentExecutionSpec.format
    ) {
        throw new Error(
            "Publish draft format must match Content Execution Spec",
        )
    }

    if (
        schedule.channel !==
        contentExecutionSpec.channel
    ) {
        throw new Error(
            "Publish schedule channel must match Content Execution Spec",
        )
    }

    if (
        scheduleState.scheduleId !==
        schedule.id
    ) {
        throw new Error(
            "Publish schedule lifecycle state must belong to schedule",
        )
    }

    if (
        scheduleState.contentId !==
        schedule.contentId ||
        scheduleState.draftId !==
        schedule.draftId ||
        scheduleState.draftVersion !==
        schedule.draftVersion
    ) {
        throw new Error(
            "Publish schedule lifecycle must preserve scheduled draft lineage",
        )
    }

    if (
        !Number.isInteger(
            scheduleState.revision,
        ) ||
        scheduleState.revision < 0
    ) {
        throw new Error(
            "Publish schedule lifecycle revision must be a non-negative integer",
        )
    }
    if (
        scheduleState.revision ===
        0
    ) {
        if (
            scheduleState.status !==
            "scheduled"
        ) {
            throw new Error(
                "Initial schedule lifecycle state must be scheduled",
            )
        }

        const initialPublishAt =
            absoluteInstant(
                schedule.publishAt,
                "schedule publishAt",
            )

        const currentPublishAt =
            absoluteInstant(
                scheduleState.publishAt,
                "current publishAt",
            )

        if (
            initialPublishAt !==
            currentPublishAt
        ) {
            throw new Error(
                "Initial schedule lifecycle state must preserve original publishAt",
            )
        }
    }
}

// -----------------------------------------------------------------------------
// Resolution
// -----------------------------------------------------------------------------

export function resolveSocialContentPublishEligibility(
    input:
        ResolveSocialContentPublishEligibilityInput,
): SocialContentPublishEligibility {
    assertPublishProvenance(
        input,
    )

    const {
        draft,
        contentExecutionSpec,
        schedule,
        scheduleState,
        publishingAccount,
    } = input

    if (
        scheduleState.status ===
        "cancelled"
    ) {
        return {
            eligible:
                false,

            reason:
                "scheduleCancelled",
        }
    }

    if (
        !publishingAccount.connected
    ) {
        return {
            eligible:
                false,

            reason:
                "publishingAccountDisconnected",
        }
    }

    if (
        publishingAccount.channel !==
        schedule.channel
    ) {
        return {
            eligible:
                false,

            reason:
                "channelMismatch",
        }
    }

    const now =
        absoluteInstant(
            input.now,
            "now",
        )

    const publishAt =
        absoluteInstant(
            scheduleState.publishAt,
            "current publishAt",
        )

    if (
        now <
        publishAt
    ) {
        return {
            eligible:
                false,

            reason:
                "notDue",
        }
    }

    return {
        eligible:
            true,

        contentId:
            draft.contentId,

        draftId:
            draft.id,

        draftVersion:
            draft.version,

        scheduleId:
            schedule.id,

        publishingAccountId:
            publishingAccount.id,

        channel:
            contentExecutionSpec.channel,

        publishAt:
            scheduleState.publishAt,
        scheduleRevision:
            scheduleState.revision,
    }
}