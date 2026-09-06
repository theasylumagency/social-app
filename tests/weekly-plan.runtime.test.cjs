const assert = require("node:assert/strict")
const test = require("node:test")

const {
    assembleWeeklyPlan,
    submitWeeklyPlanForReview,
    approveWeeklyPlan,
    requestWeeklyPlanChanges,
    supersedeWeeklyPlan,
} = require("../dist/blueprints/social/index.js")

function createValidInput() {
    return {
        id: "weekly-plan-1",
        brandId: "brand-1",

        startsOn: "2026-09-07",
        endsOn: "2026-09-13",

        version: 1,

        communicationEnvelopeId: "envelope-1",

        objective: {
            objective:
                "Reduce uncertainty around complex treatment planning.",
            rationale:
                "Decision clarity is the most useful progress this week.",
            deliberateOmissions: [
                "Aesthetic-service promotion",
            ],
        },

        audienceFocus: {
            primary: {
                source: "operator",
                id: "audience-1",
            },

            secondary: [
                {
                    source: "operator",
                    id: "audience-2",
                },
            ],

            rationale:
                "These audiences are closest to the week's decision problem.",
        },

        contentDirections: [
            {
                contentDirectionKey: "d2",
                id: "direction-2",
                order: 1,

                direction:
                    "Explain multidisciplinary planning.",

                purpose:
                    "Increase understanding of coordinated planning.",

                rationale:
                    "Supports trust in complex treatment planning.",
            },

            {
                contentDirectionKey: "d1",
                id: "direction-1",
                order: 0,

                direction:
                    "Explain what diagnostics clarifies.",

                purpose:
                    "Turn uncertainty into concrete clinical questions.",

                rationale:
                    "Supports the weekly objective directly.",
            },
        ],

        contentAudienceDirections: [
            {
                contentDirectionKey: "d1",

                audienceDirection: {
                    primaryAudience: {
                        source: "operator",
                        id: "audience-1",
                    },

                    secondaryAudiences: [
                        {
                            source: "operator",
                            id: "audience-2",
                        },
                    ],

                    bias: "moreExplanatory",
                },
            },

            {
                contentDirectionKey: "d2",

                audienceDirection: {
                    primaryAudience: {
                        source: "operator",
                        id: "audience-2",
                    },

                    secondaryAudiences: [],

                    bias: "moreTrustFocused",
                },
            },
        ],

        experimentDecision: {
            decision: "noExperiment",

            rationale:
                "Execution deserves priority over an ungrounded test.",

            experiment: null,
        },

        createdAt:
            "2026-09-06T20:00:00+04:00",

        updatedAt:
            "2026-09-06T20:00:00+04:00",
    }
}

test("weekly plan assembly creates a canonical ordered draft", () => {
    const plan =
        assembleWeeklyPlan(
            createValidInput(),
        )

    assert.equal(
        plan.state,
        "draft",
    )

    assert.equal(
        plan.version,
        1,
    )

    assert.equal(
        plan.contentDirections.length,
        2,
    )

    assert.equal(
        plan.contentDirections[0].id,
        "direction-1",
    )

    assert.equal(
        plan.contentDirections[0].order,
        0,
    )

    assert.equal(
        plan.contentDirections[1].id,
        "direction-2",
    )

    assert.equal(
        plan.contentDirections[1].order,
        1,
    )

    assert.equal(
        plan.contentDirections[0]
            .audienceDirection.bias,
        "moreExplanatory",
    )

    assert.equal(
        "contentDirectionKey"
        in plan.contentDirections[0],
        false,
    )

    assert.deepEqual(
        plan.experimentDecision,
        {
            decision:
                "noExperiment",

            rationale:
                "Execution deserves priority over an ungrounded test.",

            experiment:
                null,
        },
    )
})

test("weekly plan assembly rejects a missing audience-direction mapping", () => {
    const input =
        createValidInput()

    input.contentAudienceDirections =
        input.contentAudienceDirections.slice(
            0,
            1,
        )

    assert.throws(
        () =>
            assembleWeeklyPlan(input),

        /Missing Content Audience Direction/,
    )
})

test("weekly plan assembly rejects an unknown audience-direction key", () => {
    const input =
        createValidInput()

    input.contentAudienceDirections = [
        ...input.contentAudienceDirections,

        {
            contentDirectionKey:
                "unknown-direction",

            audienceDirection: {
                primaryAudience: {
                    source: "operator",
                    id: "audience-1",
                },

                secondaryAudiences: [],

                bias: "balanced",
            },
        },
    ]

    assert.throws(
        () =>
            assembleWeeklyPlan(input),

        /references unknown key/,
    )
})

test("weekly plan assembly rejects duplicate content-direction keys", () => {
    const input =
        createValidInput()

    input.contentDirections = [
        input.contentDirections[0],

        {
            ...input.contentDirections[1],

            contentDirectionKey:
                input.contentDirections[0]
                    .contentDirectionKey,
        },
    ]

    assert.throws(
        () =>
            assembleWeeklyPlan(input),

        /Duplicate contentDirectionKey/,
    )
})

test("weekly plan assembly rejects duplicate order values", () => {
    const input =
        createValidInput()

    input.contentDirections = [
        input.contentDirections[0],

        {
            ...input.contentDirections[1],

            order:
                input.contentDirections[0]
                    .order,
        },
    ]

    assert.throws(
        () =>
            assembleWeeklyPlan(input),

        /Duplicate content direction order/,
    )
})
test("weekly plan lifecycle submits draft for review", () => {
    const plan =
        assembleWeeklyPlan(
            createValidInput(),
        )

    const submitted =
        submitWeeklyPlanForReview(
            plan,
            "2026-09-06T21:00:00+04:00",
        )

    assert.equal(
        submitted.state,
        "awaitingReview",
    )

    assert.equal(
        submitted.version,
        1,
    )
})

test("weekly plan lifecycle approves only a plan awaiting review", () => {
    const draft =
        assembleWeeklyPlan(
            createValidInput(),
        )

    const submitted =
        submitWeeklyPlanForReview(
            draft,
            "2026-09-06T21:00:00+04:00",
        )

    const result =
        approveWeeklyPlan(
            submitted,
            "2026-09-06T21:05:00+04:00",
        )

    assert.equal(
        result.plan.state,
        "approved",
    )

    assert.equal(
        result.plan.version,
        1,
    )

    assert.deepEqual(
        result.decision,
        {
            type: "approved",
            planId: "weekly-plan-1",
            planVersion: 1,
            decidedAt:
                "2026-09-06T21:05:00+04:00",
        },
    )
})

test("weekly plan lifecycle preserves a trimmed change request", () => {
    const draft =
        assembleWeeklyPlan(
            createValidInput(),
        )

    const submitted =
        submitWeeklyPlanForReview(
            draft,
            "2026-09-06T21:00:00+04:00",
        )

    const result =
        requestWeeklyPlanChanges(
            submitted,
            "  Make diagnostics more prominent.  ",
            "2026-09-06T21:10:00+04:00",
        )

    assert.equal(
        result.plan.state,
        "changesRequested",
    )

    assert.equal(
        result.plan.version,
        1,
    )

    assert.equal(
        result.decision.type,
        "changesRequested",
    )

    assert.equal(
        result.decision.note,
        "Make diagnostics more prominent.",
    )
})

test("weekly plan lifecycle rejects invalid review transitions", () => {
    const draft =
        assembleWeeklyPlan(
            createValidInput(),
        )

    assert.throws(
        () =>
            approveWeeklyPlan(
                draft,
                "2026-09-06T21:05:00+04:00",
            ),

        /Invalid WeeklyPlan state transition/,
    )

    assert.throws(
        () =>
            requestWeeklyPlanChanges(
                draft,
                "Change something.",
                "2026-09-06T21:05:00+04:00",
            ),

        /Invalid WeeklyPlan state transition/,
    )
})

test("weekly plan lifecycle rejects empty change requests", () => {
    const draft =
        assembleWeeklyPlan(
            createValidInput(),
        )

    const submitted =
        submitWeeklyPlanForReview(
            draft,
            "2026-09-06T21:00:00+04:00",
        )

    assert.throws(
        () =>
            requestWeeklyPlanChanges(
                submitted,
                "   ",
                "2026-09-06T21:05:00+04:00",
            ),

        /change request note must be non-empty/,
    )
})

test("weekly plan lifecycle supersedes reviewed plans without changing version", () => {
    const draft =
        assembleWeeklyPlan(
            createValidInput(),
        )

    const submitted =
        submitWeeklyPlanForReview(
            draft,
            "2026-09-06T21:00:00+04:00",
        )

    const approved =
        approveWeeklyPlan(
            submitted,
            "2026-09-06T21:05:00+04:00",
        ).plan

    const superseded =
        supersedeWeeklyPlan(
            approved,
            "2026-09-06T22:00:00+04:00",
        )

    assert.equal(
        superseded.state,
        "superseded",
    )

    assert.equal(
        superseded.version,
        1,
    )
})