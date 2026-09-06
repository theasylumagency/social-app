const assert = require("node:assert/strict")
const test = require("node:test")

const {
    resolveSocialContentPublishEligibility,
} = require(
    "../dist/blueprints/social/index.js",
)

function createDraft(
    overrides = {},
) {
    return {
        id:
            "draft-2",

        contentId:
            "content-1",

        contentBriefId:
            "brief-1",

        contentExecutionSpecId:
            "execution-spec-1",

        version:
            2,

        locale:
            "ka",

        format:
            "carousel",

        caption:
            "Caption.",

        frames: [
            {
                order:
                    1,

                heading:
                    "Frame 1",

                body:
                    "Body 1.",
            },
        ],

        createdAt:
            "2026-09-06T10:00:00+04:00",

        ...overrides,
    }
}

function createExecutionSpec(
    overrides = {},
) {
    return {
        id:
            "execution-spec-1",

        contentBriefId:
            "brief-1",

        channel:
            "instagram",

        contentMode:
            "social.educational",

        format:
            "carousel",

        depth:
            "standard",

        visualDependency:
            "supporting",

        executionGuidance: [],

        constraints: [],

        rationale:
            "Fixture.",

        createdAt:
            "2026-09-06T09:00:00+04:00",

        ...overrides,
    }
}

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

function createScheduleState(
    overrides = {},
) {
    return {
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

        ...overrides,
    }
}

function createPublishingAccount(
    overrides = {},
) {
    return {
        id:
            "publishing-account-1",

        channel:
            "instagram",

        providerAccountRef:
            "provider-account-123",

        connected:
            true,

        ...overrides,
    }
}

function createInput(
    overrides = {},
) {
    return {
        draft:
            createDraft(),

        contentExecutionSpec:
            createExecutionSpec(),

        schedule:
            createSchedule(),

        scheduleState:
            createScheduleState(),

        publishingAccount:
            createPublishingAccount(),

        now:
            "2026-09-08T10:00:00+04:00",

        ...overrides,
    }
}

// -----------------------------------------------------------------------------
// Eligible
// -----------------------------------------------------------------------------

test("publish eligibility allows exact due scheduled draft on connected matching account", () => {
    const result =
        resolveSocialContentPublishEligibility(
            createInput(),
        )

    assert.deepEqual(
        result,
        {
            eligible:
                true,

            contentId:
                "content-1",

            draftId:
                "draft-2",

            draftVersion:
                2,

            scheduleId:
                "schedule-1",

            publishingAccountId:
                "publishing-account-1",

            channel:
                "instagram",

            publishAt:
                "2026-09-08T10:00:00+04:00",
            scheduleRevision:
                0,
        },
    )
})

test("publish eligibility treats exact due instant as eligible", () => {
    const result =
        resolveSocialContentPublishEligibility(
            createInput({
                now:
                    "2026-09-08T06:00:00Z",
            }),
        )

    /**
     * 06:00Z = 10:00+04.
     */
    assert.equal(
        result.eligible,
        true,
    )
})

// -----------------------------------------------------------------------------
// Schedule lifecycle authority
// -----------------------------------------------------------------------------

test("cancelled schedule is never publish eligible", () => {
    const result =
        resolveSocialContentPublishEligibility(
            createInput({
                scheduleState:
                    createScheduleState({
                        revision:
                            1,

                        status:
                            "cancelled",

                        publishAt:
                            undefined,

                        lastPublishAt:
                            "2026-09-08T10:00:00+04:00",

                        cancelledAt:
                            "2026-09-07T12:00:00+04:00",
                    }),
            }),
        )

    assert.deepEqual(
        result,
        {
            eligible:
                false,

            reason:
                "scheduleCancelled",
        },
    )
})

test("rescheduled lifecycle time overrides original schedule publishAt", () => {
    const result =
        resolveSocialContentPublishEligibility(
            createInput({
                scheduleState:
                    createScheduleState({
                        revision:
                            1,

                        publishAt:
                            "2026-09-10T15:00:00+04:00",
                    }),

                now:
                    "2026-09-08T11:00:00+04:00",
            }),
        )

    assert.deepEqual(
        result,
        {
            eligible:
                false,

            reason:
                "notDue",
        },
    )
})

test("rescheduled draft becomes eligible when current lifecycle publishAt is reached", () => {
    const result =
        resolveSocialContentPublishEligibility(
            createInput({
                scheduleState:
                    createScheduleState({
                        revision:
                            2,

                        publishAt:
                            "2026-09-10T15:00:00+04:00",
                    }),

                now:
                    "2026-09-10T15:00:00+04:00",
            }),
        )

    assert.equal(
        result.eligible,
        true,
    )

    assert.equal(
        result.publishAt,
        "2026-09-10T15:00:00+04:00",
    )
})

test("revision zero must preserve original schedule publishAt instant", () => {
    assert.throws(
        () =>
            resolveSocialContentPublishEligibility(
                createInput({
                    scheduleState:
                        createScheduleState({
                            revision:
                                0,

                            publishAt:
                                "2026-09-09T10:00:00+04:00",
                        }),
                }),
            ),

        /Initial schedule lifecycle state must preserve original publishAt/,
    )
})

test("revision zero cannot be cancelled", () => {
    assert.throws(
        () =>
            resolveSocialContentPublishEligibility(
                createInput({
                    scheduleState:
                        createScheduleState({
                            revision:
                                0,

                            status:
                                "cancelled",

                            publishAt:
                                undefined,

                            lastPublishAt:
                                "2026-09-08T10:00:00+04:00",

                            cancelledAt:
                                "2026-09-07T12:00:00+04:00",
                        }),
                }),
            ),

        /Initial schedule lifecycle state must be scheduled/,
    )
})

// -----------------------------------------------------------------------------
// Time
// -----------------------------------------------------------------------------

test("publish eligibility returns notDue before current publishAt", () => {
    const result =
        resolveSocialContentPublishEligibility(
            createInput({
                now:
                    "2026-09-08T09:59:59+04:00",
            }),
        )

    assert.deepEqual(
        result,
        {
            eligible:
                false,

            reason:
                "notDue",
        },
    )
})

test("publish eligibility requires absolute now", () => {
    assert.throws(
        () =>
            resolveSocialContentPublishEligibility(
                createInput({
                    now:
                        "2026-09-08T10:00:00",
                }),
            ),

        /now must be a valid absolute ISO date-time/,
    )
})

test("publish eligibility requires valid current publishAt", () => {
    assert.throws(
        () =>
            resolveSocialContentPublishEligibility(
                createInput({
                    scheduleState:
                        createScheduleState({
                            revision:
                                1,

                            publishAt:
                                "not-a-date",
                        }),
                }),
            ),

        /current publishAt must be a valid absolute ISO date-time/,
    )
})

// -----------------------------------------------------------------------------
// Publishing account
// -----------------------------------------------------------------------------

test("disconnected publishing account blocks provider call", () => {
    const result =
        resolveSocialContentPublishEligibility(
            createInput({
                publishingAccount:
                    createPublishingAccount({
                        connected:
                            false,
                    }),
            }),
        )

    assert.deepEqual(
        result,
        {
            eligible:
                false,

            reason:
                "publishingAccountDisconnected",
        },
    )
})

test("publishing account channel must match schedule channel", () => {
    const result =
        resolveSocialContentPublishEligibility(
            createInput({
                publishingAccount:
                    createPublishingAccount({
                        channel:
                            "facebook",
                    }),
            }),
        )

    assert.deepEqual(
        result,
        {
            eligible:
                false,

            reason:
                "channelMismatch",
        },
    )
})

// -----------------------------------------------------------------------------
// Draft / schedule provenance
// -----------------------------------------------------------------------------

test("publish schedule ContentId must match draft", () => {
    assert.throws(
        () =>
            resolveSocialContentPublishEligibility(
                createInput({
                    schedule:
                        createSchedule({
                            contentId:
                                "content-999",
                        }),
                }),
            ),

        /Publish schedule ContentId must match draft/,
    )
})

test("publish schedule must target exact draft ID", () => {
    assert.throws(
        () =>
            resolveSocialContentPublishEligibility(
                createInput({
                    schedule:
                        createSchedule({
                            draftId:
                                "draft-999",
                        }),
                }),
            ),

        /Publish schedule must target the exact draft and version/,
    )
})

test("publish schedule must target exact draft version", () => {
    assert.throws(
        () =>
            resolveSocialContentPublishEligibility(
                createInput({
                    schedule:
                        createSchedule({
                            draftVersion:
                                3,
                        }),
                }),
            ),

        /Publish schedule must target the exact draft and version/,
    )
})

test("publish schedule must match Content Execution Spec", () => {
    assert.throws(
        () =>
            resolveSocialContentPublishEligibility(
                createInput({
                    schedule:
                        createSchedule({
                            contentExecutionSpecId:
                                "execution-spec-999",
                        }),
                }),
            ),

        /Publish schedule must match Content Execution Spec/,
    )
})

test("publish draft must match Content Execution Spec", () => {
    assert.throws(
        () =>
            resolveSocialContentPublishEligibility(
                createInput({
                    draft:
                        createDraft({
                            contentExecutionSpecId:
                                "execution-spec-999",
                        }),
                }),
            ),

        /Publish draft must match Content Execution Spec/,
    )
})

test("publish draft and execution spec must share Content Brief provenance", () => {
    assert.throws(
        () =>
            resolveSocialContentPublishEligibility(
                createInput({
                    contentExecutionSpec:
                        createExecutionSpec({
                            contentBriefId:
                                "brief-999",
                        }),
                }),
            ),

        /Publish draft and Content Execution Spec must share Content Brief provenance/,
    )
})

test("publish draft format must match Content Execution Spec", () => {
    assert.throws(
        () =>
            resolveSocialContentPublishEligibility(
                createInput({
                    contentExecutionSpec:
                        createExecutionSpec({
                            format:
                                "staticPost",
                        }),
                }),
            ),

        /Publish draft format must match Content Execution Spec/,
    )
})

test("publish schedule channel must match Content Execution Spec", () => {
    assert.throws(
        () =>
            resolveSocialContentPublishEligibility(
                createInput({
                    schedule:
                        createSchedule({
                            channel:
                                "facebook",
                        }),
                }),
            ),

        /Publish schedule channel must match Content Execution Spec/,
    )
})

// -----------------------------------------------------------------------------
// Lifecycle provenance
// -----------------------------------------------------------------------------

test("publish lifecycle state must belong to schedule", () => {
    assert.throws(
        () =>
            resolveSocialContentPublishEligibility(
                createInput({
                    scheduleState:
                        createScheduleState({
                            scheduleId:
                                "schedule-999",
                        }),
                }),
            ),

        /Publish schedule lifecycle state must belong to schedule/,
    )
})

test("publish lifecycle state must preserve scheduled draft lineage", () => {
    assert.throws(
        () =>
            resolveSocialContentPublishEligibility(
                createInput({
                    scheduleState:
                        createScheduleState({
                            draftId:
                                "draft-999",
                        }),
                }),
            ),

        /Publish schedule lifecycle must preserve scheduled draft lineage/,
    )
})

test("publish lifecycle revision must be non-negative integer", () => {
    assert.throws(
        () =>
            resolveSocialContentPublishEligibility(
                createInput({
                    scheduleState:
                        createScheduleState({
                            revision:
                                -1,
                        }),
                }),
            ),

        /Publish schedule lifecycle revision must be a non-negative integer/,
    )
})