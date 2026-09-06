const assert = require("node:assert/strict")
const test = require("node:test")

const {
    resolveSocialContentSchedulingEligibility,
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

function createAudit(
    overrides = {},
) {
    return {
        id:
            "audit-1",

        contentId:
            "content-1",

        initialDraftId:
            "draft-1",

        initialDraftVersion:
            1,

        initialEvaluation: {},

        automaticRepairAttempts:
            1,

        repairBrief:
            null,

        repairedDraftId:
            "draft-2",

        repairedDraftVersion:
            2,

        finalEvaluation: {},

        finalDraftId:
            "draft-2",

        finalDraftVersion:
            2,

        finalOutcome: {
            status:
                "pass",
        },

        createdAt:
            "2026-09-06T10:30:00+04:00",

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

function createReviewRequest(
    overrides = {},
) {
    return {
        id:
            "review-request-1",

        contentId:
            "content-1",

        draftId:
            "draft-2",

        draftVersion:
            2,

        evaluationAuditId:
            "audit-1",

        reason:
            "standard",

        requestedAt:
            "2026-09-06T11:00:00+04:00",

        ...overrides,
    }
}

function createReviewDecision(
    overrides = {},
) {
    return {
        id:
            "review-decision-1",

        reviewRequestId:
            "review-request-1",

        contentId:
            "content-1",

        draftId:
            "draft-2",

        draftVersion:
            2,

        decision:
            "approved",

        decidedBy:
            "actor-1",

        decidedAt:
            "2026-09-06T11:15:00+04:00",

        ...overrides,
    }
}

function createInput(
    overrides = {},
) {
    return {
        draft:
            createDraft(),

        evaluationAudit:
            createAudit(),

        contentExecutionSpec:
            createExecutionSpec(),

        approvalPolicy: {
            mode:
                "reviewRequired",
        },

        ...overrides,
    }
}

// -----------------------------------------------------------------------------
// Human-review policy
// -----------------------------------------------------------------------------

test("passed content is not schedulable when policy requires review and no review exists", () => {
    const result =
        resolveSocialContentSchedulingEligibility(
            createInput(),
        )

    assert.deepEqual(
        result,
        {
            eligible:
                false,

            reason:
                "humanReviewRequired",
        },
    )
})

test("approved review makes exact draft schedulable", () => {
    const reviewRequest =
        createReviewRequest()

    const reviewDecision =
        createReviewDecision()

    const result =
        resolveSocialContentSchedulingEligibility(
            createInput({
                reviewRequest,
                reviewDecision,
            }),
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

            authorization: {
                type:
                    "humanApproved",

                reviewRequestId:
                    "review-request-1",

                reviewDecisionId:
                    "review-decision-1",
            },
        },
    )
})

test("pending review blocks scheduling even when direct publishing would otherwise be allowed", () => {
    const result =
        resolveSocialContentSchedulingEligibility(
            createInput({
                approvalPolicy: {
                    mode:
                        "directPublish",

                    maxRisk:
                        "high",
                },

                reviewRequest:
                    createReviewRequest(),
            }),
        )

    assert.deepEqual(
        result,
        {
            eligible:
                false,

            reason:
                "awaitingReviewDecision",
        },
    )
})

test("changesRequested review blocks scheduling", () => {
    const result =
        resolveSocialContentSchedulingEligibility(
            createInput({
                reviewRequest:
                    createReviewRequest(),

                reviewDecision:
                    createReviewDecision({
                        decision:
                            "changesRequested",

                        note:
                            "Revise the copy.",
                    }),
            }),
        )

    assert.deepEqual(
        result,
        {
            eligible:
                false,

            reason:
                "changesRequested",
        },
    )
})

test("rejected review blocks scheduling", () => {
    const result =
        resolveSocialContentSchedulingEligibility(
            createInput({
                reviewRequest:
                    createReviewRequest(),

                reviewDecision:
                    createReviewDecision({
                        decision:
                            "rejected",

                        note:
                            "Do not publish.",
                    }),
            }),
        )

    assert.deepEqual(
        result,
        {
            eligible:
                false,

            reason:
                "rejected",
        },
    )
})

// -----------------------------------------------------------------------------
// Direct publishing
// -----------------------------------------------------------------------------

test("low-risk educational content is directly schedulable under low-risk policy", () => {
    const result =
        resolveSocialContentSchedulingEligibility(
            createInput({
                approvalPolicy: {
                    mode:
                        "directPublish",

                    maxRisk:
                        "low",
                },

                contentExecutionSpec:
                    createExecutionSpec({
                        contentMode:
                            "social.educational",
                    }),
            }),
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

            authorization: {
                type:
                    "directPublish",

                risk:
                    "low",
            },
        },
    )
})

test("moderate-risk content is blocked by low-risk direct publish policy", () => {
    const result =
        resolveSocialContentSchedulingEligibility(
            createInput({
                approvalPolicy: {
                    mode:
                        "directPublish",

                    maxRisk:
                        "low",
                },

                contentExecutionSpec:
                    createExecutionSpec({
                        contentMode:
                            "social.brandStory",
                    }),
            }),
        )

    assert.deepEqual(
        result,
        {
            eligible:
                false,

            reason:
                "directPublishRiskExceeded",
        },
    )
})

test("moderate-risk content is allowed by moderate-risk direct publish policy", () => {
    const result =
        resolveSocialContentSchedulingEligibility(
            createInput({
                approvalPolicy: {
                    mode:
                        "directPublish",

                    maxRisk:
                        "moderate",
                },

                contentExecutionSpec:
                    createExecutionSpec({
                        contentMode:
                            "social.trustBuilder",
                    }),
            }),
        )

    assert.equal(
        result.eligible,
        true,
    )

    assert.deepEqual(
        result.authorization,
        {
            type:
                "directPublish",

            risk:
                "moderate",
        },
    )
})

test("high-risk direct offer is blocked by moderate-risk direct publish policy", () => {
    const result =
        resolveSocialContentSchedulingEligibility(
            createInput({
                approvalPolicy: {
                    mode:
                        "directPublish",

                    maxRisk:
                        "moderate",
                },

                contentExecutionSpec:
                    createExecutionSpec({
                        contentMode:
                            "social.directOffer",
                    }),
            }),
        )

    assert.deepEqual(
        result,
        {
            eligible:
                false,

            reason:
                "directPublishRiskExceeded",
        },
    )
})

test("high-risk content is allowed only when direct publish policy explicitly allows high risk", () => {
    const result =
        resolveSocialContentSchedulingEligibility(
            createInput({
                approvalPolicy: {
                    mode:
                        "directPublish",

                    maxRisk:
                        "high",
                },

                contentExecutionSpec:
                    createExecutionSpec({
                        contentMode:
                            "social.proofLed",
                    }),
            }),
        )

    assert.equal(
        result.eligible,
        true,
    )

    assert.deepEqual(
        result.authorization,
        {
            type:
                "directPublish",

            risk:
                "high",
        },
    )
})

// -----------------------------------------------------------------------------
// Evaluation authority
// -----------------------------------------------------------------------------

test("requiresReview outcome cannot be bypassed by direct publish policy", () => {
    const result =
        resolveSocialContentSchedulingEligibility(
            createInput({
                evaluationAudit:
                    createAudit({
                        finalOutcome: {
                            status:
                                "requiresReview",
                        },
                    }),

                approvalPolicy: {
                    mode:
                        "directPublish",

                    maxRisk:
                        "high",
                },
            }),
        )

    assert.deepEqual(
        result,
        {
            eligible:
                false,

            reason:
                "humanReviewRequired",
        },
    )
})

test("required review awaiting decision remains unschedulable", () => {
    const result =
        resolveSocialContentSchedulingEligibility(
            createInput({
                evaluationAudit:
                    createAudit({
                        finalOutcome: {
                            status:
                                "requiresReview",
                        },
                    }),

                approvalPolicy: {
                    mode:
                        "directPublish",

                    maxRisk:
                        "high",
                },

                reviewRequest:
                    createReviewRequest({
                        reason:
                            "required",
                    }),
            }),
        )

    assert.deepEqual(
        result,
        {
            eligible:
                false,

            reason:
                "awaitingReviewDecision",
        },
    )
})

test("human approval can authorize content that required review", () => {
    const result =
        resolveSocialContentSchedulingEligibility(
            createInput({
                evaluationAudit:
                    createAudit({
                        finalOutcome: {
                            status:
                                "requiresReview",
                        },
                    }),

                approvalPolicy: {
                    mode:
                        "directPublish",

                    maxRisk:
                        "high",
                },

                reviewRequest:
                    createReviewRequest({
                        reason:
                            "required",
                    }),

                reviewDecision:
                    createReviewDecision({
                        decision:
                            "approved",
                    }),
            }),
        )

    assert.equal(
        result.eligible,
        true,
    )

    assert.equal(
        result.authorization.type,
        "humanApproved",
    )
})

test("blocked outcome can never be scheduled", () => {
    const result =
        resolveSocialContentSchedulingEligibility(
            createInput({
                evaluationAudit:
                    createAudit({
                        finalOutcome: {
                            status:
                                "blocked",
                        },
                    }),

                approvalPolicy: {
                    mode:
                        "directPublish",

                    maxRisk:
                        "high",
                },
            }),
        )

    assert.deepEqual(
        result,
        {
            eligible:
                false,

            reason:
                "blocked",
        },
    )
})

// -----------------------------------------------------------------------------
// Provenance
// -----------------------------------------------------------------------------

test("review decision without review request is rejected", () => {
    assert.throws(
        () =>
            resolveSocialContentSchedulingEligibility(
                createInput({
                    reviewDecision:
                        createReviewDecision(),
                }),
            ),

        /Review decision requires its review request/,
    )
})

test("review decision must belong to supplied review request", () => {
    assert.throws(
        () =>
            resolveSocialContentSchedulingEligibility(
                createInput({
                    reviewRequest:
                        createReviewRequest(),

                    reviewDecision:
                        createReviewDecision({
                            reviewRequestId:
                                "review-request-999",
                        }),
                }),
            ),

        /Review decision must belong to the supplied review request/,
    )
})

test("review request must target exact scheduling draft", () => {
    assert.throws(
        () =>
            resolveSocialContentSchedulingEligibility(
                createInput({
                    reviewRequest:
                        createReviewRequest({
                            draftId:
                                "draft-999",
                        }),
                }),
            ),

        /Review request must target the scheduling draft/,
    )
})

test("evaluation audit must target exact scheduling draft", () => {
    assert.throws(
        () =>
            resolveSocialContentSchedulingEligibility(
                createInput({
                    evaluationAudit:
                        createAudit({
                            finalDraftId:
                                "draft-999",
                        }),
                }),
            ),

        /Scheduling eligibility must target the evaluation audit final draft/,
    )
})

test("execution spec must belong to scheduling draft", () => {
    assert.throws(
        () =>
            resolveSocialContentSchedulingEligibility(
                createInput({
                    contentExecutionSpec:
                        createExecutionSpec({
                            id:
                                "execution-spec-999",
                        }),
                }),
            ),

        /Scheduling draft must match Content Execution Spec/,
    )
})

test("execution spec format must match scheduling draft format", () => {
    assert.throws(
        () =>
            resolveSocialContentSchedulingEligibility(
                createInput({
                    contentExecutionSpec:
                        createExecutionSpec({
                            format:
                                "staticPost",
                        }),
                }),
            ),

        /Scheduling Content Execution Spec format must match draft format/,
    )
})

test("unknown content mode cannot silently receive direct-publish authorization", () => {
    assert.throws(
        () =>
            resolveSocialContentSchedulingEligibility(
                createInput({
                    approvalPolicy: {
                        mode:
                            "directPublish",

                        maxRisk:
                            "high",
                    },

                    contentExecutionSpec:
                        createExecutionSpec({
                            contentMode:
                                "social.unknownMode",
                        }),
                }),
            ),

        /Content execution mode has no Social Content Mode Policy/,
    )
})