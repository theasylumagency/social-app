import type {
    ActorId,
    ContentId,
    DomainId,
    IsoDateTime,
} from "../../core/domain"

import {
    isIsoDateTime,
} from "../../core/domain"

import type {
    SocialContentDraftId,
} from "./content-draft"

import type {
    SocialContentSchedule,
    SocialContentScheduleId,
} from "./content-schedule"

// -----------------------------------------------------------------------------
// Identity
// -----------------------------------------------------------------------------

export type SocialContentScheduleEventId =
    DomainId<"SocialContentScheduleEventId">

// -----------------------------------------------------------------------------
// Lifecycle state
// -----------------------------------------------------------------------------

type SocialContentScheduleLifecycleBase = {
    readonly scheduleId:
    SocialContentScheduleId

    readonly contentId:
    ContentId

    readonly draftId:
    SocialContentDraftId

    readonly draftVersion:
    number

    /**
     * Initial schedule = revision 0.
     * Every lifecycle event increments exactly once.
     */
    readonly revision:
    number
}

export type SocialContentScheduleLifecycleState =
    | (
        SocialContentScheduleLifecycleBase & {
            readonly status:
            "scheduled"

            readonly publishAt:
            IsoDateTime
        }
    )
    | (
        SocialContentScheduleLifecycleBase & {
            readonly status:
            "cancelled"

            /**
             * Last intended publish instant before cancellation.
             */
            readonly lastPublishAt:
            IsoDateTime

            readonly cancelledAt:
            IsoDateTime
        }
    )

// -----------------------------------------------------------------------------
// Immutable events
// -----------------------------------------------------------------------------

export type SocialContentScheduleRescheduledEvent = {
    readonly id:
    SocialContentScheduleEventId

    readonly scheduleId:
    SocialContentScheduleId

    readonly contentId:
    ContentId

    readonly draftId:
    SocialContentDraftId

    readonly draftVersion:
    number

    readonly revision:
    number

    readonly type:
    "rescheduled"

    readonly previousPublishAt:
    IsoDateTime

    readonly publishAt:
    IsoDateTime

    readonly changedBy:
    ActorId

    readonly createdAt:
    IsoDateTime
}

export type SocialContentScheduleCancelledEvent = {
    readonly id:
    SocialContentScheduleEventId

    readonly scheduleId:
    SocialContentScheduleId

    readonly contentId:
    ContentId

    readonly draftId:
    SocialContentDraftId

    readonly draftVersion:
    number

    readonly revision:
    number

    readonly type:
    "cancelled"

    readonly previousPublishAt:
    IsoDateTime

    readonly reason?:
    string

    readonly changedBy:
    ActorId

    readonly createdAt:
    IsoDateTime
}

export type SocialContentScheduleEvent =
    | SocialContentScheduleRescheduledEvent
    | SocialContentScheduleCancelledEvent

// -----------------------------------------------------------------------------
// Initial projection
// -----------------------------------------------------------------------------

export function createInitialSocialContentScheduleLifecycleState(
    schedule:
        SocialContentSchedule,
): SocialContentScheduleLifecycleState {
    return {
        scheduleId:
            schedule.id,

        contentId:
            schedule.contentId,

        draftId:
            schedule.draftId,

        draftVersion:
            schedule.draftVersion,

        revision:
            0,

        status:
            "scheduled",

        publishAt:
            schedule.publishAt,
    }
}

// -----------------------------------------------------------------------------
// Validation helpers
// -----------------------------------------------------------------------------

const ABSOLUTE_ISO_DATE_TIME_PATTERN =
    /(?:Z|[+-]\d{2}:\d{2})$/u

function assertAbsoluteDateTime(
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

function assertLifecycleMatchesSchedule(
    schedule:
        SocialContentSchedule,

    state:
        SocialContentScheduleLifecycleState,
): void {
    if (
        state.scheduleId !==
        schedule.id
    ) {
        throw new Error(
            "Schedule lifecycle state must belong to the schedule",
        )
    }

    if (
        state.contentId !==
        schedule.contentId ||
        state.draftId !==
        schedule.draftId ||
        state.draftVersion !==
        schedule.draftVersion
    ) {
        throw new Error(
            "Schedule lifecycle state must preserve scheduled draft lineage",
        )
    }

    if (
        !Number.isInteger(
            state.revision,
        ) ||
        state.revision < 0
    ) {
        throw new Error(
            "Schedule lifecycle revision must be a non-negative integer",
        )
    }
}

function normalizedOptionalReason(
    reason:
        string | undefined,
): string | undefined {
    if (
        reason ===
        undefined
    ) {
        return undefined
    }

    const normalized =
        reason.trim()

    return normalized.length === 0
        ? undefined
        : normalized
}

// -----------------------------------------------------------------------------
// Reschedule
// -----------------------------------------------------------------------------

export type RescheduleSocialContentInput = {
    readonly id:
    SocialContentScheduleEventId

    readonly schedule:
    SocialContentSchedule

    readonly currentState:
    SocialContentScheduleLifecycleState

    readonly publishAt:
    IsoDateTime

    readonly changedBy:
    ActorId

    readonly changedAt:
    IsoDateTime
}

export type RescheduleSocialContentResult = {
    readonly event:
    SocialContentScheduleRescheduledEvent

    readonly state:
    SocialContentScheduleLifecycleState
}

export function rescheduleSocialContent(
    input:
        RescheduleSocialContentInput,
): RescheduleSocialContentResult {
    assertLifecycleMatchesSchedule(
        input.schedule,
        input.currentState,
    )

    if (
        input.currentState.status !==
        "scheduled"
    ) {
        throw new Error(
            "Cancelled schedule cannot be rescheduled",
        )
    }

    const changedAt =
        assertAbsoluteDateTime(
            input.changedAt,
            "changedAt",
        )

    const newPublishAt =
        assertAbsoluteDateTime(
            input.publishAt,
            "publishAt",
        )

    const scheduledAt =
        assertAbsoluteDateTime(
            input.schedule.scheduledAt,
            "scheduledAt",
        )

    if (
        changedAt <
        scheduledAt
    ) {
        throw new Error(
            "Schedule lifecycle event cannot predate the original schedule",
        )
    }

    if (
        newPublishAt <=
        changedAt
    ) {
        throw new Error(
            "Rescheduled publishAt must be later than changedAt",
        )
    }

    const previousPublishAt =
        assertAbsoluteDateTime(
            input.currentState.publishAt,
            "current publishAt",
        )

    if (
        newPublishAt ===
        previousPublishAt
    ) {
        throw new Error(
            "Reschedule must change publishAt instant",
        )
    }

    const revision =
        input.currentState.revision + 1

    const event:
        SocialContentScheduleRescheduledEvent =
    {
        id:
            input.id,

        scheduleId:
            input.schedule.id,

        contentId:
            input.schedule.contentId,

        draftId:
            input.schedule.draftId,

        draftVersion:
            input.schedule.draftVersion,

        revision,

        type:
            "rescheduled",

        previousPublishAt:
            input.currentState.publishAt,

        publishAt:
            input.publishAt,

        changedBy:
            input.changedBy,

        createdAt:
            input.changedAt,
    }

    return {
        event,

        state: {
            scheduleId:
                input.schedule.id,

            contentId:
                input.schedule.contentId,

            draftId:
                input.schedule.draftId,

            draftVersion:
                input.schedule.draftVersion,

            revision,

            status:
                "scheduled",

            publishAt:
                input.publishAt,
        },
    }
}

// -----------------------------------------------------------------------------
// Cancel
// -----------------------------------------------------------------------------

export type CancelSocialContentScheduleInput = {
    readonly id:
    SocialContentScheduleEventId

    readonly schedule:
    SocialContentSchedule

    readonly currentState:
    SocialContentScheduleLifecycleState

    readonly reason?:
    string

    readonly changedBy:
    ActorId

    readonly changedAt:
    IsoDateTime
}

export type CancelSocialContentScheduleResult = {
    readonly event:
    SocialContentScheduleCancelledEvent

    readonly state:
    SocialContentScheduleLifecycleState
}

export function cancelSocialContentSchedule(
    input:
        CancelSocialContentScheduleInput,
): CancelSocialContentScheduleResult {
    assertLifecycleMatchesSchedule(
        input.schedule,
        input.currentState,
    )

    if (
        input.currentState.status !==
        "scheduled"
    ) {
        throw new Error(
            "Schedule is already cancelled",
        )
    }
    assertAbsoluteDateTime(
        input.currentState.publishAt,
        "current publishAt",
    )
    const changedAt =
        assertAbsoluteDateTime(
            input.changedAt,
            "changedAt",
        )

    const scheduledAt =
        assertAbsoluteDateTime(
            input.schedule.scheduledAt,
            "scheduledAt",
        )

    if (
        changedAt <
        scheduledAt
    ) {
        throw new Error(
            "Schedule lifecycle event cannot predate the original schedule",
        )
    }

    const revision =
        input.currentState.revision + 1

    const reason =
        normalizedOptionalReason(
            input.reason,
        )

    const event:
        SocialContentScheduleCancelledEvent =
    {
        id:
            input.id,

        scheduleId:
            input.schedule.id,

        contentId:
            input.schedule.contentId,

        draftId:
            input.schedule.draftId,

        draftVersion:
            input.schedule.draftVersion,

        revision,

        type:
            "cancelled",

        previousPublishAt:
            input.currentState.publishAt,

        ...(reason === undefined
            ? {}
            : {
                reason,
            }),

        changedBy:
            input.changedBy,

        createdAt:
            input.changedAt,
    }

    return {
        event,

        state: {
            scheduleId:
                input.schedule.id,

            contentId:
                input.schedule.contentId,

            draftId:
                input.schedule.draftId,

            draftVersion:
                input.schedule.draftVersion,

            revision,

            status:
                "cancelled",

            lastPublishAt:
                input.currentState.publishAt,

            cancelledAt:
                input.changedAt,
        },
    }
}