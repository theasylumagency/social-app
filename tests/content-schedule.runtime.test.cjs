const assert = require("node:assert/strict")
const test = require("node:test")

const {
    assembleSocialContentSchedule,
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

function createEligibility(
    overrides = {},
) {
    return {
        eligible:
            true,

        contentId:
            "content-1",

        draftId:
            "draft-2",

        draftVersion:
            2,

        authorization: {
            type:
                "directPublish",

            risk:
                "low",
        },

        ...overrides,
    }
}

function createInput(
    overrides = {},
) {
    return {
        id:
            "schedule-1",

        draft:
            createDraft(),

        contentExecutionSpec:
            createExecutionSpec(),

        eligibility:
            createEligibility(),

        publishAt:
            "2026-09-07T10:00:00+04:00",

        scheduledAt:
            "2026-09-06T12:00:00+04:00",

        ...overrides,
    }
}

test("schedule assembles immutable entry for exact eligible draft", () => {
    const schedule =
        assembleSocialContentSchedule(
            createInput(),
        )

    assert.deepEqual(
        schedule,
        {
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
                "2026-09-07T10:00:00+04:00",

            scheduledAt:
                "2026-09-06T12:00:00+04:00",
        },
    )
})

test("schedule preserves human approval authorization snapshot", () => {
    const schedule =
        assembleSocialContentSchedule(
            createInput({
                eligibility:
                    createEligibility({
                        authorization: {
                            type:
                                "humanApproved",

                            reviewRequestId:
                                "review-request-1",

                            reviewDecisionId:
                                "review-decision-1",
                        },
                    }),
            }),
        )

    assert.deepEqual(
        schedule.authorization,
        {
            type:
                "humanApproved",

            reviewRequestId:
                "review-request-1",

            reviewDecisionId:
                "review-decision-1",
        },
    )
})

test("schedule rejects ineligible runtime input", () => {
    assert.throws(
        () =>
            assembleSocialContentSchedule(
                createInput({
                    eligibility: {
                        eligible:
                            false,

                        reason:
                            "humanReviewRequired",
                    },
                }),
            ),

        /Only eligible content may be scheduled/,
    )
})

test("schedule rejects eligibility for another ContentId", () => {
    assert.throws(
        () =>
            assembleSocialContentSchedule(
                createInput({
                    eligibility:
                        createEligibility({
                            contentId:
                                "content-999",
                        }),
                }),
            ),

        /Scheduling eligibility ContentId must match draft/,
    )
})

test("schedule rejects eligibility for another draft", () => {
    assert.throws(
        () =>
            assembleSocialContentSchedule(
                createInput({
                    eligibility:
                        createEligibility({
                            draftId:
                                "draft-999",
                        }),
                }),
            ),

        /Scheduling eligibility must authorize the exact draft/,
    )
})

test("schedule rejects eligibility for another draft version", () => {
    assert.throws(
        () =>
            assembleSocialContentSchedule(
                createInput({
                    eligibility:
                        createEligibility({
                            draftVersion:
                                3,
                        }),
                }),
            ),

        /Scheduling eligibility must authorize the exact draft version/,
    )
})

test("schedule rejects invalid draft version", () => {
    assert.throws(
        () =>
            assembleSocialContentSchedule(
                createInput({
                    draft:
                        createDraft({
                            version:
                                0,
                        }),

                    eligibility:
                        createEligibility({
                            draftVersion:
                                0,
                        }),
                }),
            ),

        /Scheduled content draft version must be a positive integer/,
    )
})

test("schedule rejects draft and execution spec ID mismatch", () => {
    assert.throws(
        () =>
            assembleSocialContentSchedule(
                createInput({
                    contentExecutionSpec:
                        createExecutionSpec({
                            id:
                                "execution-spec-999",
                        }),
                }),
            ),

        /Scheduled draft must match Content Execution Spec/,
    )
})

test("schedule rejects Content Brief provenance mismatch", () => {
    assert.throws(
        () =>
            assembleSocialContentSchedule(
                createInput({
                    contentExecutionSpec:
                        createExecutionSpec({
                            contentBriefId:
                                "brief-999",
                        }),
                }),
            ),

        /Scheduled draft and Content Execution Spec must share Content Brief provenance/,
    )
})

test("schedule rejects format mismatch", () => {
    assert.throws(
        () =>
            assembleSocialContentSchedule(
                createInput({
                    contentExecutionSpec:
                        createExecutionSpec({
                            format:
                                "staticPost",
                        }),
                }),
            ),

        /Scheduled draft format must match Content Execution Spec/,
    )
})

test("schedule rejects publishAt without timezone or offset", () => {
    assert.throws(
        () =>
            assembleSocialContentSchedule(
                createInput({
                    publishAt:
                        "2026-09-07T10:00:00",
                }),
            ),

        /publishAt must be a valid absolute ISO date-time/,
    )
})

test("schedule rejects scheduledAt without timezone or offset", () => {
    assert.throws(
        () =>
            assembleSocialContentSchedule(
                createInput({
                    scheduledAt:
                        "2026-09-06T12:00:00",
                }),
            ),

        /scheduledAt must be a valid absolute ISO date-time/,
    )
})

test("schedule rejects invalid publishAt", () => {
    assert.throws(
        () =>
            assembleSocialContentSchedule(
                createInput({
                    publishAt:
                        "not-a-date",
                }),
            ),

        /publishAt must be a valid absolute ISO date-time/,
    )
})

test("schedule rejects publishAt equal to scheduledAt", () => {
    assert.throws(
        () =>
            assembleSocialContentSchedule(
                createInput({
                    publishAt:
                        "2026-09-06T12:00:00+04:00",

                    scheduledAt:
                        "2026-09-06T12:00:00+04:00",
                }),
            ),

        /publishAt must be later than scheduledAt/,
    )
})

test("schedule rejects publishAt earlier than scheduledAt", () => {
    assert.throws(
        () =>
            assembleSocialContentSchedule(
                createInput({
                    publishAt:
                        "2026-09-06T11:59:59+04:00",

                    scheduledAt:
                        "2026-09-06T12:00:00+04:00",
                }),
            ),

        /publishAt must be later than scheduledAt/,
    )
})

test("schedule compares absolute instants rather than local clock text", () => {
    const schedule =
        assembleSocialContentSchedule(
            createInput({
                scheduledAt:
                    "2026-09-06T10:00:00Z",

                publishAt:
                    "2026-09-06T15:00:00+04:00",
            }),
        )

    /**
     * 10:00Z = 14:00+04
     * 15:00+04 = 11:00Z
     *
     * publishAt is therefore one hour later.
     */
    assert.equal(
        schedule.publishAt,
        "2026-09-06T15:00:00+04:00",
    )
})