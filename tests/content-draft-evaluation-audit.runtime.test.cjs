const assert = require("node:assert/strict")
const test = require("node:test")

const {
    assembleSocialContentDraftEvaluationAudit,
} = require(
    "../dist/blueprints/social/index.js",
)

function createDraft(
    overrides = {},
) {
    return {
        id:
            "draft-1",

        contentId:
            "content-1",

        contentBriefId:
            "brief-1",

        contentExecutionSpecId:
            "execution-spec-1",

        version:
            1,

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

function createEvaluation(
    draft,
    outcome,
) {
    return {
        contentDraftId:
            draft.id,

        version:
            draft.version,

        validation: {
            placeholder:
                true,
        },

        quality:
            null,

        outcome,
    }
}

function createNoRepairRun(
    draft,
    status = "pass",
) {
    const initialEvaluation =
        createEvaluation(
            draft,
            {
                status,
            },
        )

    return {
        initialEvaluation,

        repairedDraft:
            null,

        finalEvaluation:
            null,

        finalDraft:
            draft,

        outcome: {
            status,
        },
    }
}

function createRepairRun({
    finalEvaluationOutcome = {
        status:
            "pass",
    },

    finalOutcome = {
        status:
            "pass",
    },

    repairedDraftOverrides = {},
} = {}) {
    const initialDraft =
        createDraft()

    const repairedDraft =
        createDraft({
            id:
                "draft-2",

            version:
                2,

            ...repairedDraftOverrides,
        })

    const initialEvaluation =
        createEvaluation(
            initialDraft,
            {
                status:
                    "repair",

                brief: {
                    instructions: [
                        {
                            source:
                                "safety",

                            instruction:
                                "Remove unsupported certainty.",
                        },
                    ],

                    preserve: [
                        "taskIntent",
                        "tone",
                        "structure",
                    ],
                },
            },
        )

    const finalEvaluation =
        createEvaluation(
            repairedDraft,
            finalEvaluationOutcome,
        )

    return {
        initialDraft,

        run: {
            initialEvaluation,

            repairedDraft,

            finalEvaluation,

            finalDraft:
                repairedDraft,

            outcome:
                finalOutcome,
        },
    }
}

test("audit assembles terminal no-repair history", () => {
    const draft =
        createDraft()

    const run =
        createNoRepairRun(
            draft,
            "pass",
        )

    const audit =
        assembleSocialContentDraftEvaluationAudit({
            id:
                "audit-1",

            initialDraft:
                draft,

            run,

            createdAt:
                "2026-09-06T12:00:00+04:00",
        })

    assert.equal(
        audit.contentId,
        "content-1",
    )

    assert.equal(
        audit.initialDraftId,
        "draft-1",
    )

    assert.equal(
        audit.initialDraftVersion,
        1,
    )

    assert.equal(
        audit.automaticRepairAttempts,
        0,
    )

    assert.equal(
        audit.repairBrief,
        null,
    )

    assert.equal(
        audit.repairedDraftId,
        null,
    )

    assert.equal(
        audit.repairedDraftVersion,
        null,
    )

    assert.equal(
        audit.finalEvaluation,
        null,
    )

    assert.equal(
        audit.finalDraftId,
        "draft-1",
    )

    assert.equal(
        audit.finalDraftVersion,
        1,
    )

    assert.deepEqual(
        audit.finalOutcome,
        {
            status:
                "pass",
        },
    )
})

test("audit assembles exactly one successful automatic repair", () => {
    const {
        initialDraft,
        run,
    } = createRepairRun()

    const audit =
        assembleSocialContentDraftEvaluationAudit({
            id:
                "audit-1",

            initialDraft,

            run,

            createdAt:
                "2026-09-06T12:00:00+04:00",
        })

    assert.equal(
        audit.automaticRepairAttempts,
        1,
    )

    assert.deepEqual(
        audit.repairBrief,
        run.initialEvaluation.outcome.brief,
    )

    assert.equal(
        audit.repairedDraftId,
        "draft-2",
    )

    assert.equal(
        audit.repairedDraftVersion,
        2,
    )

    assert.equal(
        audit.finalDraftId,
        "draft-2",
    )

    assert.equal(
        audit.finalDraftVersion,
        2,
    )

    assert.equal(
        audit.finalEvaluation,
        run.finalEvaluation,
    )

    assert.deepEqual(
        audit.finalOutcome,
        {
            status:
                "pass",
        },
    )
})

test("audit accepts exhausted repair budget as requiresReview", () => {
    const {
        initialDraft,
        run,
    } = createRepairRun({
        finalEvaluationOutcome: {
            status:
                "repair",

            brief: {
                instructions: [
                    {
                        source:
                            "quality",

                        instruction:
                            "Further repair needed.",
                    },
                ],

                preserve: [
                    "taskIntent",
                ],
            },
        },

        finalOutcome: {
            status:
                "requiresReview",
        },
    })

    const audit =
        assembleSocialContentDraftEvaluationAudit({
            id:
                "audit-1",

            initialDraft,

            run,

            createdAt:
                "2026-09-06T12:00:00+04:00",
        })

    assert.equal(
        audit.automaticRepairAttempts,
        1,
    )

    assert.deepEqual(
        audit.finalOutcome,
        {
            status:
                "requiresReview",
        },
    )

    assert.equal(
        audit.finalEvaluation.outcome.status,
        "repair",
    )
})

test("audit rejects initial evaluation belonging to another draft", () => {
    const draft =
        createDraft()

    const run =
        createNoRepairRun(
            draft,
        )

    run.initialEvaluation.contentDraftId =
        "another-draft"

    assert.throws(
        () =>
            assembleSocialContentDraftEvaluationAudit({
                id:
                    "audit-1",

                initialDraft:
                    draft,

                run,

                createdAt:
                    "2026-09-06T12:00:00+04:00",
            }),

        /Initial evaluation draft ID does not match draft/,
    )
})

test("audit rejects repair outcome without repaired draft", () => {
    const draft =
        createDraft()

    const run = {
        initialEvaluation:
            createEvaluation(
                draft,
                {
                    status:
                        "repair",

                    brief: {
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
                },
            ),

        repairedDraft:
            null,

        finalEvaluation:
            null,

        finalDraft:
            draft,

        outcome: {
            status:
                "requiresReview",
        },
    }

    assert.throws(
        () =>
            assembleSocialContentDraftEvaluationAudit({
                id:
                    "audit-1",

                initialDraft:
                    draft,

                run,

                createdAt:
                    "2026-09-06T12:00:00+04:00",
            }),

        /Repair evaluation must produce a repaired draft/,
    )
})

test("audit rejects repaired draft that skips a version", () => {
    const {
        initialDraft,
        run,
    } = createRepairRun({
        repairedDraftOverrides: {
            version:
                3,
        },
    })

    /**
     * Keep final evaluation consistent with the malformed
     * repaired draft so the version-lineage check is isolated.
     */
    run.finalEvaluation.version =
        3

    assert.throws(
        () =>
            assembleSocialContentDraftEvaluationAudit({
                id:
                    "audit-1",

                initialDraft,

                run,

                createdAt:
                    "2026-09-06T12:00:00+04:00",
            }),

        /Repaired draft version must increment exactly once/,
    )
})

test("audit rejects repaired draft that changes stable ContentId", () => {
    const {
        initialDraft,
        run,
    } = createRepairRun({
        repairedDraftOverrides: {
            contentId:
                "content-2",
        },
    })

    assert.throws(
        () =>
            assembleSocialContentDraftEvaluationAudit({
                id:
                    "audit-1",

                initialDraft,

                run,

                createdAt:
                    "2026-09-06T12:00:00+04:00",
            }),

        /Evaluation audit draft must preserve ContentId/,
    )
})

test("audit rejects final evaluation belonging to another repaired draft", () => {
    const {
        initialDraft,
        run,
    } = createRepairRun()

    run.finalEvaluation.contentDraftId =
        "draft-999"

    assert.throws(
        () =>
            assembleSocialContentDraftEvaluationAudit({
                id:
                    "audit-1",

                initialDraft,

                run,

                createdAt:
                    "2026-09-06T12:00:00+04:00",
            }),

        /Final evaluation draft ID does not match draft/,
    )
})

test("audit rejects illegal final repair outcome after budget exhaustion", () => {
    const {
        initialDraft,
        run,
    } = createRepairRun({
        finalEvaluationOutcome: {
            status:
                "repair",

            brief: {
                instructions: [
                    {
                        source:
                            "quality",

                        instruction:
                            "Repair again.",
                    },
                ],

                preserve: [
                    "taskIntent",
                ],
            },
        },

        /**
         * This state must never survive the repair loop.
         */
        finalOutcome: {
            status:
                "repair",
        },
    })

    assert.throws(
        () =>
            assembleSocialContentDraftEvaluationAudit({
                id:
                    "audit-1",

                initialDraft,

                run,

                createdAt:
                    "2026-09-06T12:00:00+04:00",
            }),

        /Final outcome does not respect automatic repair budget/,
    )
})

test("audit rejects no-repair run whose final outcome disagrees with initial terminal outcome", () => {
    const draft =
        createDraft()

    const run =
        createNoRepairRun(
            draft,
            "blocked",
        )

    run.outcome = {
        status:
            "pass",
    }

    assert.throws(
        () =>
            assembleSocialContentDraftEvaluationAudit({
                id:
                    "audit-1",

                initialDraft:
                    draft,

                run,

                createdAt:
                    "2026-09-06T12:00:00+04:00",
            }),

        /Final outcome must match initial terminal outcome when no repair occurred/,
    )
})