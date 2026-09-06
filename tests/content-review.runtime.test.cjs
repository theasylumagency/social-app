const assert = require("node:assert/strict")
const test = require("node:test")

const {
    assembleSocialContentReviewRequest,
    assembleSocialContentReviewDecision,
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

        frames: [
            {
                order:
                    1,

                heading:
                    "Frame 1",

                body:
                    "Body 1.",
            },

            {
                order:
                    2,

                heading:
                    "Frame 2",

                body:
                    "Body 2.",
            },
        ],

        createdAt:
            "2026-09-06T10:00:00+04:00",

        ...overrides,
    }
}

function createEvaluationAudit(
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

        initialEvaluation: {
            placeholder:
                true,
        },

        automaticRepairAttempts:
            1,

        repairBrief: {
            instructions: [
                {
                    source:
                        "safety",

                    instruction:
                        "Repair.",
                },
            ],

            preserve: [
                "taskIntent",
            ],
        },

        repairedDraftId:
            "draft-2",

        repairedDraftVersion:
            2,

        finalEvaluation: {
            placeholder:
                true,
        },

        finalDraftId:
            "draft-2",

        finalDraftVersion:
            2,

        finalOutcome: {
            status:
                "pass",
        },

        createdAt:
            "2026-09-06T11:00:00+04:00",

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
            "2026-09-06T11:30:00+04:00",

        ...overrides,
    }
}

// -----------------------------------------------------------------------------
// Review Request
// -----------------------------------------------------------------------------

test("review request assembles standard review for passed final draft", () => {
    const request =
        assembleSocialContentReviewRequest({
            id:
                "review-request-1",

            draft:
                createDraft(),

            evaluationAudit:
                createEvaluationAudit(),

            reason:
                "standard",

            requestedAt:
                "2026-09-06T11:30:00+04:00",
        })

    assert.deepEqual(
        request,
        {
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
                "2026-09-06T11:30:00+04:00",
        },
    )
})

test("review request assembles required review for requiresReview outcome", () => {
    const request =
        assembleSocialContentReviewRequest({
            id:
                "review-request-1",

            draft:
                createDraft(),

            evaluationAudit:
                createEvaluationAudit({
                    finalOutcome: {
                        status:
                            "requiresReview",
                    },
                }),

            reason:
                "required",

            requestedAt:
                "2026-09-06T11:30:00+04:00",
        })

    assert.equal(
        request.reason,
        "required",
    )

    assert.equal(
        request.draftId,
        "draft-2",
    )
})

test("review request rejects blocked content", () => {
    assert.throws(
        () =>
            assembleSocialContentReviewRequest({
                id:
                    "review-request-1",

                draft:
                    createDraft(),

                evaluationAudit:
                    createEvaluationAudit({
                        finalOutcome: {
                            status:
                                "blocked",
                        },
                    }),

                reason:
                    "required",

                requestedAt:
                    "2026-09-06T11:30:00+04:00",
            }),

        /Blocked content cannot enter approval review/,
    )
})

test("review request rejects required reason for passed content", () => {
    assert.throws(
        () =>
            assembleSocialContentReviewRequest({
                id:
                    "review-request-1",

                draft:
                    createDraft(),

                evaluationAudit:
                    createEvaluationAudit({
                        finalOutcome: {
                            status:
                                "pass",
                        },
                    }),

                reason:
                    "required",

                requestedAt:
                    "2026-09-06T11:30:00+04:00",
            }),

        /Passed content may only create a standard review request/,
    )
})

test("review request rejects standard reason for requiresReview content", () => {
    assert.throws(
        () =>
            assembleSocialContentReviewRequest({
                id:
                    "review-request-1",

                draft:
                    createDraft(),

                evaluationAudit:
                    createEvaluationAudit({
                        finalOutcome: {
                            status:
                                "requiresReview",
                        },
                    }),

                reason:
                    "standard",

                requestedAt:
                    "2026-09-06T11:30:00+04:00",
            }),

        /requiresReview outcome must create a required review request/,
    )
})

test("review request rejects draft that is not evaluation audit final draft", () => {
    assert.throws(
        () =>
            assembleSocialContentReviewRequest({
                id:
                    "review-request-1",

                draft:
                    createDraft({
                        id:
                            "draft-3",
                    }),

                evaluationAudit:
                    createEvaluationAudit(),

                reason:
                    "standard",

                requestedAt:
                    "2026-09-06T11:30:00+04:00",
            }),

        /Review must target the evaluation audit final draft/,
    )
})

test("review request rejects draft version mismatch with evaluation audit", () => {
    assert.throws(
        () =>
            assembleSocialContentReviewRequest({
                id:
                    "review-request-1",

                draft:
                    createDraft({
                        version:
                            3,
                    }),

                evaluationAudit:
                    createEvaluationAudit(),

                reason:
                    "standard",

                requestedAt:
                    "2026-09-06T11:30:00+04:00",
            }),

        /Review draft version must match evaluation audit final draft version/,
    )
})

test("review request rejects ContentId mismatch", () => {
    assert.throws(
        () =>
            assembleSocialContentReviewRequest({
                id:
                    "review-request-1",

                draft:
                    createDraft({
                        contentId:
                            "content-2",
                    }),

                evaluationAudit:
                    createEvaluationAudit(),

                reason:
                    "standard",

                requestedAt:
                    "2026-09-06T11:30:00+04:00",
            }),

        /Review draft ContentId must match evaluation audit/,
    )
})

test("review request rejects invalid draft version", () => {
    assert.throws(
        () =>
            assembleSocialContentReviewRequest({
                id:
                    "review-request-1",

                draft:
                    createDraft({
                        version:
                            0,
                    }),

                evaluationAudit:
                    createEvaluationAudit({
                        finalDraftVersion:
                            0,
                    }),

                reason:
                    "standard",

                requestedAt:
                    "2026-09-06T11:30:00+04:00",
            }),

        /Review draft version must be a positive integer/,
    )
})

// -----------------------------------------------------------------------------
// Review Decision
// -----------------------------------------------------------------------------

test("review decision assembles approval pinned to exact request draft", () => {
    const decision =
        assembleSocialContentReviewDecision({
            id:
                "review-decision-1",

            request:
                createReviewRequest(),

            decision:
                "approved",

            decidedBy:
                "actor-1",

            decidedAt:
                "2026-09-06T11:45:00+04:00",
        })

    assert.deepEqual(
        decision,
        {
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
                "2026-09-06T11:45:00+04:00",
        },
    )
})

test("review decision allows optional normalized note on approval", () => {
    const decision =
        assembleSocialContentReviewDecision({
            id:
                "review-decision-1",

            request:
                createReviewRequest(),

            decision:
                "approved",

            note:
                "  Looks good.  ",

            decidedBy:
                "actor-1",

            decidedAt:
                "2026-09-06T11:45:00+04:00",
        })

    assert.equal(
        decision.note,
        "Looks good.",
    )
})

test("review decision drops blank optional note on approval", () => {
    const decision =
        assembleSocialContentReviewDecision({
            id:
                "review-decision-1",

            request:
                createReviewRequest(),

            decision:
                "approved",

            note:
                "   ",

            decidedBy:
                "actor-1",

            decidedAt:
                "2026-09-06T11:45:00+04:00",
        })

    assert.equal(
        Object.prototype.hasOwnProperty.call(
            decision,
            "note",
        ),
        false,
    )
})

test("review decision requires note for changesRequested", () => {
    assert.throws(
        () =>
            assembleSocialContentReviewDecision({
                id:
                    "review-decision-1",

                request:
                    createReviewRequest(),

                decision:
                    "changesRequested",

                decidedBy:
                    "actor-1",

                decidedAt:
                    "2026-09-06T11:45:00+04:00",
            }),

        /changesRequested review decision requires a note/,
    )
})

test("review decision requires nonblank note for rejected", () => {
    assert.throws(
        () =>
            assembleSocialContentReviewDecision({
                id:
                    "review-decision-1",

                request:
                    createReviewRequest(),

                decision:
                    "rejected",

                note:
                    "   ",

                decidedBy:
                    "actor-1",

                decidedAt:
                    "2026-09-06T11:45:00+04:00",
            }),

        /rejected review decision requires a note/,
    )
})

test("review decision assembles changesRequested with normalized note", () => {
    const decision =
        assembleSocialContentReviewDecision({
            id:
                "review-decision-1",

            request:
                createReviewRequest(),

            decision:
                "changesRequested",

            note:
                "  Make the final frame less formal.  ",

            decidedBy:
                "actor-1",

            decidedAt:
                "2026-09-06T11:45:00+04:00",
        })

    assert.equal(
        decision.note,
        "Make the final frame less formal.",
    )

    assert.equal(
        decision.draftId,
        "draft-2",
    )

    assert.equal(
        decision.draftVersion,
        2,
    )
})

test("review decision preserves immutable request lineage", () => {
    const request =
        createReviewRequest({
            contentId:
                "content-99",

            draftId:
                "draft-17",

            draftVersion:
                17,
        })

    const decision =
        assembleSocialContentReviewDecision({
            id:
                "review-decision-1",

            request,

            decision:
                "approved",

            decidedBy:
                "actor-1",

            decidedAt:
                "2026-09-06T11:45:00+04:00",
        })

    assert.equal(
        decision.contentId,
        "content-99",
    )

    assert.equal(
        decision.draftId,
        "draft-17",
    )

    assert.equal(
        decision.draftVersion,
        17,
    )

    assert.equal(
        decision.reviewRequestId,
        "review-request-1",
    )
})