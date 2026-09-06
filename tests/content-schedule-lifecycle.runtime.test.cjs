const assert = require("node:assert/strict")
const test = require("node:test")

const {
    createInitialSocialContentScheduleLifecycleState,
    rescheduleSocialContent,
    cancelSocialContentSchedule,
} = require(
    "../dist/blueprints/social/index.js",
)

function createSchedule(
    overrides = {},
) {
    return {
        id:
            "schedule-1",

        contentId:
            "content-1",

        draftId:
            "draft-2",

        draftVersion:
            2,

        contentExecutionSpecId:
            "execution-spec-1",

        channel:
            "instagram",

        authorization: {
            type:
                "directPublish",

            risk:
                "low",
        },

        publishAt:
            "2026-09-08T10:00:00+04:00",

        scheduledAt:
            "2026-09-06T12:00:00+04:00",

        ...overrides,
    }
}

// -----------------------------------------------------------------------------
// Initial state
// -----------------------------------------------------------------------------

test("initial lifecycle state is projected from immutable schedule", () => {
    const schedule =
        createSchedule()

    const state =
        createInitialSocialContentScheduleLifecycleState(
            schedule,
        )

    assert.deepEqual(
        state,
        {
            scheduleId:
                "schedule-1",

            contentId:
                "content-1",

            draftId:
                "draft-2",

            draftVersion:
                2,

            revision:
                0,

            status:
                "scheduled",

            publishAt:
                "2026-09-08T10:00:00+04:00",
        },
    )
})

// -----------------------------------------------------------------------------
// Reschedule
// -----------------------------------------------------------------------------

test("reschedule creates immutable event and increments lifecycle revision", () => {
    const schedule =
        createSchedule()

    const currentState =
        createInitialSocialContentScheduleLifecycleState(
            schedule,
        )

    const result =
        rescheduleSocialContent({
            id:
                "schedule-event-1",

            schedule,

            currentState,

            publishAt:
                "2026-09-09T12:00:00+04:00",

            changedBy:
                "actor-1",

            changedAt:
                "2026-09-07T10:00:00+04:00",
        })

    assert.deepEqual(
        result.event,
        {
            id:
                "schedule-event-1",

            scheduleId:
                "schedule-1",

            contentId:
                "content-1",

            draftId:
                "draft-2",

            draftVersion:
                2,

            revision:
                1,

            type:
                "rescheduled",

            previousPublishAt:
                "2026-09-08T10:00:00+04:00",

            publishAt:
                "2026-09-09T12:00:00+04:00",

            changedBy:
                "actor-1",

            createdAt:
                "2026-09-07T10:00:00+04:00",
        },
    )

    assert.deepEqual(
        result.state,
        {
            scheduleId:
                "schedule-1",

            contentId:
                "content-1",

            draftId:
                "draft-2",

            draftVersion:
                2,

            revision:
                1,

            status:
                "scheduled",

            publishAt:
                "2026-09-09T12:00:00+04:00",
        },
    )

    /**
     * Original schedule remains unchanged.
     */
    assert.equal(
        schedule.publishAt,
        "2026-09-08T10:00:00+04:00",
    )
})

test("repeated reschedules form a monotonic revision chain", () => {
    const schedule =
        createSchedule()

    const initialState =
        createInitialSocialContentScheduleLifecycleState(
            schedule,
        )

    const first =
        rescheduleSocialContent({
            id:
                "schedule-event-1",

            schedule,

            currentState:
                initialState,

            publishAt:
                "2026-09-09T12:00:00+04:00",

            changedBy:
                "actor-1",

            changedAt:
                "2026-09-07T10:00:00+04:00",
        })

    const second =
        rescheduleSocialContent({
            id:
                "schedule-event-2",

            schedule,

            currentState:
                first.state,

            publishAt:
                "2026-09-10T15:00:00+04:00",

            changedBy:
                "actor-2",

            changedAt:
                "2026-09-08T11:00:00+04:00",
        })

    assert.equal(
        first.event.revision,
        1,
    )

    assert.equal(
        second.event.revision,
        2,
    )

    assert.equal(
        second.event.previousPublishAt,
        "2026-09-09T12:00:00+04:00",
    )

    assert.equal(
        second.state.publishAt,
        "2026-09-10T15:00:00+04:00",
    )

    assert.equal(
        second.state.revision,
        2,
    )
})

test("reschedule rejects same absolute publish instant expressed with another offset", () => {
    const schedule =
        createSchedule({
            publishAt:
                "2026-09-08T10:00:00Z",
        })

    const currentState =
        createInitialSocialContentScheduleLifecycleState(
            schedule,
        )

    assert.throws(
        () =>
            rescheduleSocialContent({
                id:
                    "schedule-event-1",

                schedule,

                currentState,

                /**
                 * Same instant as 10:00Z.
                 */
                publishAt:
                    "2026-09-08T14:00:00+04:00",

                changedBy:
                    "actor-1",

                changedAt:
                    "2026-09-07T10:00:00Z",
            }),

        /Reschedule must change publishAt instant/,
    )
})

test("reschedule rejects publish time not later than changedAt", () => {
    const schedule =
        createSchedule()

    const currentState =
        createInitialSocialContentScheduleLifecycleState(
            schedule,
        )

    assert.throws(
        () =>
            rescheduleSocialContent({
                id:
                    "schedule-event-1",

                schedule,

                currentState,

                publishAt:
                    "2026-09-07T10:00:00+04:00",

                changedBy:
                    "actor-1",

                changedAt:
                    "2026-09-07T10:00:00+04:00",
            }),

        /Rescheduled publishAt must be later than changedAt/,
    )
})

test("reschedule rejects lifecycle event predating original schedule creation", () => {
    const schedule =
        createSchedule()

    const currentState =
        createInitialSocialContentScheduleLifecycleState(
            schedule,
        )

    assert.throws(
        () =>
            rescheduleSocialContent({
                id:
                    "schedule-event-1",

                schedule,

                currentState,

                publishAt:
                    "2026-09-09T10:00:00+04:00",

                changedBy:
                    "actor-1",

                changedAt:
                    "2026-09-06T11:59:59+04:00",
            }),

        /Schedule lifecycle event cannot predate the original schedule/,
    )
})

// -----------------------------------------------------------------------------
// Cancellation
// -----------------------------------------------------------------------------

test("cancel creates immutable terminal event and preserves last publish time", () => {
    const schedule =
        createSchedule()

    const currentState =
        createInitialSocialContentScheduleLifecycleState(
            schedule,
        )

    const result =
        cancelSocialContentSchedule({
            id:
                "schedule-event-1",

            schedule,

            currentState,

            reason:
                "  Campaign changed.  ",

            changedBy:
                "actor-1",

            changedAt:
                "2026-09-07T12:00:00+04:00",
        })

    assert.deepEqual(
        result.event,
        {
            id:
                "schedule-event-1",

            scheduleId:
                "schedule-1",

            contentId:
                "content-1",

            draftId:
                "draft-2",

            draftVersion:
                2,

            revision:
                1,

            type:
                "cancelled",

            previousPublishAt:
                "2026-09-08T10:00:00+04:00",

            reason:
                "Campaign changed.",

            changedBy:
                "actor-1",

            createdAt:
                "2026-09-07T12:00:00+04:00",
        },
    )

    assert.deepEqual(
        result.state,
        {
            scheduleId:
                "schedule-1",

            contentId:
                "content-1",

            draftId:
                "draft-2",

            draftVersion:
                2,

            revision:
                1,

            status:
                "cancelled",

            lastPublishAt:
                "2026-09-08T10:00:00+04:00",

            cancelledAt:
                "2026-09-07T12:00:00+04:00",
        },
    )
})

test("cancel drops blank optional reason", () => {
    const schedule =
        createSchedule()

    const currentState =
        createInitialSocialContentScheduleLifecycleState(
            schedule,
        )

    const result =
        cancelSocialContentSchedule({
            id:
                "schedule-event-1",

            schedule,

            currentState,

            reason:
                "   ",

            changedBy:
                "actor-1",

            changedAt:
                "2026-09-07T12:00:00+04:00",
        })

    assert.equal(
        Object.prototype.hasOwnProperty.call(
            result.event,
            "reason",
        ),
        false,
    )
})

test("cancel after reschedule preserves current publish time rather than original publish time", () => {
    const schedule =
        createSchedule()

    const initialState =
        createInitialSocialContentScheduleLifecycleState(
            schedule,
        )

    const rescheduled =
        rescheduleSocialContent({
            id:
                "schedule-event-1",

            schedule,

            currentState:
                initialState,

            publishAt:
                "2026-09-10T15:00:00+04:00",

            changedBy:
                "actor-1",

            changedAt:
                "2026-09-07T10:00:00+04:00",
        })

    const cancelled =
        cancelSocialContentSchedule({
            id:
                "schedule-event-2",

            schedule,

            currentState:
                rescheduled.state,

            changedBy:
                "actor-2",

            changedAt:
                "2026-09-08T10:00:00+04:00",
        })

    assert.equal(
        cancelled.event.revision,
        2,
    )

    assert.equal(
        cancelled.event.previousPublishAt,
        "2026-09-10T15:00:00+04:00",
    )

    assert.equal(
        cancelled.state.lastPublishAt,
        "2026-09-10T15:00:00+04:00",
    )
})

test("cancelled schedule cannot be rescheduled", () => {
    const schedule =
        createSchedule()

    const initialState =
        createInitialSocialContentScheduleLifecycleState(
            schedule,
        )

    const cancelled =
        cancelSocialContentSchedule({
            id:
                "schedule-event-1",

            schedule,

            currentState:
                initialState,

            changedBy:
                "actor-1",

            changedAt:
                "2026-09-07T12:00:00+04:00",
        })

    assert.throws(
        () =>
            rescheduleSocialContent({
                id:
                    "schedule-event-2",

                schedule,

                currentState:
                    cancelled.state,

                publishAt:
                    "2026-09-10T10:00:00+04:00",

                changedBy:
                    "actor-1",

                changedAt:
                    "2026-09-08T10:00:00+04:00",
            }),

        /Cancelled schedule cannot be rescheduled/,
    )
})

test("schedule cannot be cancelled twice", () => {
    const schedule =
        createSchedule()

    const initialState =
        createInitialSocialContentScheduleLifecycleState(
            schedule,
        )

    const first =
        cancelSocialContentSchedule({
            id:
                "schedule-event-1",

            schedule,

            currentState:
                initialState,

            changedBy:
                "actor-1",

            changedAt:
                "2026-09-07T12:00:00+04:00",
        })

    assert.throws(
        () =>
            cancelSocialContentSchedule({
                id:
                    "schedule-event-2",

                schedule,

                currentState:
                    first.state,

                changedBy:
                    "actor-2",

                changedAt:
                    "2026-09-08T12:00:00+04:00",
            }),

        /Schedule is already cancelled/,
    )
})

// -----------------------------------------------------------------------------
// Provenance / malformed state
// -----------------------------------------------------------------------------

test("lifecycle rejects state belonging to another schedule", () => {
    const schedule =
        createSchedule()

    const currentState = {
        ...createInitialSocialContentScheduleLifecycleState(
            schedule,
        ),

        scheduleId:
            "schedule-999",
    }

    assert.throws(
        () =>
            rescheduleSocialContent({
                id:
                    "schedule-event-1",

                schedule,

                currentState,

                publishAt:
                    "2026-09-09T10:00:00+04:00",

                changedBy:
                    "actor-1",

                changedAt:
                    "2026-09-07T10:00:00+04:00",
            }),

        /Schedule lifecycle state must belong to the schedule/,
    )
})

test("lifecycle rejects state that changes scheduled draft lineage", () => {
    const schedule =
        createSchedule()

    const currentState = {
        ...createInitialSocialContentScheduleLifecycleState(
            schedule,
        ),

        draftId:
            "draft-999",
    }

    assert.throws(
        () =>
            cancelSocialContentSchedule({
                id:
                    "schedule-event-1",

                schedule,

                currentState,

                changedBy:
                    "actor-1",

                changedAt:
                    "2026-09-07T10:00:00+04:00",
            }),

        /Schedule lifecycle state must preserve scheduled draft lineage/,
    )
})

test("lifecycle rejects invalid revision", () => {
    const schedule =
        createSchedule()

    const currentState = {
        ...createInitialSocialContentScheduleLifecycleState(
            schedule,
        ),

        revision:
            -1,
    }

    assert.throws(
        () =>
            rescheduleSocialContent({
                id:
                    "schedule-event-1",

                schedule,

                currentState,

                publishAt:
                    "2026-09-09T10:00:00+04:00",

                changedBy:
                    "actor-1",

                changedAt:
                    "2026-09-07T10:00:00+04:00",
            }),

        /Schedule lifecycle revision must be a non-negative integer/,
    )
})

test("reschedule rejects malformed current publishAt", () => {
    const schedule =
        createSchedule()

    const currentState = {
        ...createInitialSocialContentScheduleLifecycleState(
            schedule,
        ),

        publishAt:
            "not-a-date",
    }

    assert.throws(
        () =>
            rescheduleSocialContent({
                id:
                    "schedule-event-1",

                schedule,

                currentState,

                publishAt:
                    "2026-09-09T10:00:00+04:00",

                changedBy:
                    "actor-1",

                changedAt:
                    "2026-09-07T10:00:00+04:00",
            }),

        /current publishAt must be a valid absolute ISO date-time/,
    )
})

test("cancel rejects malformed current publishAt", () => {
    const schedule =
        createSchedule()

    const currentState = {
        ...createInitialSocialContentScheduleLifecycleState(
            schedule,
        ),

        publishAt:
            "not-a-date",
    }

    assert.throws(
        () =>
            cancelSocialContentSchedule({
                id:
                    "schedule-event-1",

                schedule,

                currentState,

                changedBy:
                    "actor-1",

                changedAt:
                    "2026-09-07T10:00:00+04:00",
            }),

        /current publishAt must be a valid absolute ISO date-time/,
    )
})

test("lifecycle requires absolute changedAt", () => {
    const schedule =
        createSchedule()

    const currentState =
        createInitialSocialContentScheduleLifecycleState(
            schedule,
        )

    assert.throws(
        () =>
            cancelSocialContentSchedule({
                id:
                    "schedule-event-1",

                schedule,

                currentState,

                changedBy:
                    "actor-1",

                changedAt:
                    "2026-09-07T10:00:00",
            }),

        /changedAt must be a valid absolute ISO date-time/,
    )
})