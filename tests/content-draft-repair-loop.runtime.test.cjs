const assert = require("node:assert/strict")
const test = require("node:test")

const {
    runSocialContentDraftRepairLoop,
} = require(
    "../dist/blueprints/social/index.js",
)

// -----------------------------------------------------------------------------
// Fixtures
// -----------------------------------------------------------------------------

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

        caption:
            "Original caption.",

        frames: [
            {
                order:
                    1,

                heading:
                    "Frame 1",

                body:
                    "Original body 1.",
            },

            {
                order:
                    2,

                heading:
                    "Frame 2",

                body:
                    "Original body 2.",
            },
        ],

        createdAt:
            "2026-09-06T10:00:00+04:00",

        ...overrides,
    }
}

function createContentBrief() {
    return {
        id:
            "brief-1",

        weeklyPlanId:
            "weekly-plan-1",

        weeklyContentDirectionId:
            "weekly-direction-1",

        contentId:
            "content-1",

        communicationJob:
            "Explain the decision process.",

        keyTakeaway:
            "Assessment should precede recommendation.",

        supportingPoints: [
            "Individual factors may affect options.",
        ],

        audienceDirection: {
            primaryAudience: {
                source:
                    "operator",

                id:
                    "audience-1",
            },

            secondaryAudiences: [],

            bias:
                "moreExplanatory",
        },

        evidenceMode:
            "noProofNeeded",

        evidenceIds: [],

        ctaIntent:
            "encourageReflection",

        constraints: [
            "Do not imply an individual recommendation.",
        ],

        mustNotSay: [
            "Guaranteed result.",
        ],

        rationale:
            "Reduce uncertainty.",

        createdAt:
            "2026-09-06T09:00:00+04:00",
    }
}

function createExecutionSpec() {
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

        executionGuidance: [
            "Use a clear sequence.",
        ],

        constraints: [
            "Keep the carousel educational.",
        ],

        rationale:
            "Sequential explanation fits the task.",

        createdAt:
            "2026-09-06T09:15:00+04:00",
    }
}

function createEnvelope() {
    return {
        id:
            "envelope-1",

        brandId:
            "brand-1",

        landscapeVersion:
            1,

        profileIds: [
            "profile-1",
        ],

        complexity:
            "technicalWhenExplained",

        assumedKnowledge:
            "none",

        explanationDepth:
            "balanced",

        toneRange: [
            "calm",
            "professional",
        ],

        framingRules: [
            "Explain before recommending.",
        ],

        preferredStructures: [
            "sequential explanation",
        ],

        terminologyRules: [
            "Explain technical terms.",
        ],

        proofStyle: [
            "Use proof only when relevant.",
        ],

        ctaStyle:
            "consultative",

        salesPressure:
            "low",

        inclusivityRules: [
            "Avoid assuming diagnosis.",
        ],

        trustMechanisms: [
            "clarity",
        ],

        avoid: [
            "guarantees",
        ],

        rationale:
            "Fits current communication needs.",

        generatedAt:
            "2026-09-06T08:00:00+04:00",
    }
}

function createWriterContext() {
    return {
        taskId:
            "task-1",

        instruction:
            "Write approved copy.",

        publicFacts: [],

        internalGuidance: [],

        constraints: [],

        proof: [],

        voice: {
            value: {
                tone:
                    "calm",
            },
        },

        fallbacks: [],

        learnedPreferences: [],
    }
}

function createValidationContext() {
    return {
        taskId:
            "task-1",

        facts: [],

        claims: [],

        constraints: [],
    }
}

function createQualityContext() {
    return {
        taskId:
            "task-1",

        voice: {
            value: {
                tone:
                    "calm",
            },
        },

        references: [],

        recentContent: [],
    }
}

function createInput(
    overrides = {},
) {
    return {
        draft:
            createDraft(),

        contentBrief:
            createContentBrief(),

        contentExecutionSpec:
            createExecutionSpec(),

        communicationEnvelope:
            createEnvelope(),

        writerContext:
            createWriterContext(),

        validationContext:
            createValidationContext(),

        qualityContext:
            createQualityContext(),

        repairedDraftId:
            "draft-2",

        repairedDraftCreatedAt:
            "2026-09-06T11:00:00+04:00",

        ...overrides,
    }
}

function createRepairProposal() {
    return {
        text:
            null,

        caption:
            "Original caption.",

        frames: [
            {
                heading:
                    "Frame 1",

                body:
                    "Original body 1.",
            },

            {
                heading:
                    "Frame 2",

                body:
                    "Repaired body 2.",
            },
        ],

        script:
            null,

        onScreenText: [],
    }
}

// -----------------------------------------------------------------------------
// Evaluation mock helpers
// -----------------------------------------------------------------------------

function validationPass() {
    return {
        status:
            "pass",

        issues: [],
    }
}

function validationRepairable(
    instruction =
        "Repair this draft.",
) {
    return {
        status:
            "repairable",

        issues: [],

        repairInstructions: [
            instruction,
        ],
    }
}

function validationRequiresReview() {
    return {
        status:
            "requiresReview",

        issues: [],
    }
}

function validationBlocked() {
    return {
        status:
            "blocked",

        issues: [],
    }
}

function qualityPass() {
    return {
        status:
            "pass",

        dimensions: [],

        issues: [],
    }
}

/**
 * Validation results are consumed in order:
 *
 * call 1 = Draft v1
 * call 2 = Draft v2, when repair occurs.
 */
function createDependencies(
    validationResults,
) {
    let validationCall =
        0

    let scannerCalls =
        0

    let qualityCalls =
        0

    let repairWriterCalls =
        0

    const dependencies = {
        scanClaims:
            async () => {
                scannerCalls +=
                    1

                /**
                 * Validator mock ignores scanner shape,
                 * so a minimal opaque result is sufficient.
                 */
                return {}
            },

        validateGeneration:
            async () => {
                const result =
                    validationResults[
                    validationCall
                    ]

                validationCall +=
                    1

                if (!result) {
                    throw new Error(
                        "Unexpected validation call",
                    )
                }

                return result
            },

        reviewEditorialQuality:
            async () => {
                qualityCalls +=
                    1

                return qualityPass()
            },

        repairWriter:
            async () => {
                repairWriterCalls +=
                    1

                return createRepairProposal()
            },
    }

    return {
        dependencies,

        counters: {
            get validationCalls() {
                return validationCall
            },

            get scannerCalls() {
                return scannerCalls
            },

            get qualityCalls() {
                return qualityCalls
            },

            get repairWriterCalls() {
                return repairWriterCalls
            },
        },
    }
}

// -----------------------------------------------------------------------------
// Tests
// -----------------------------------------------------------------------------

test("repair loop returns original draft immediately when initial evaluation passes", async () => {
    const {
        dependencies,
        counters,
    } = createDependencies([
        validationPass(),
    ])

    const input =
        createInput()

    const result =
        await runSocialContentDraftRepairLoop(
            input,
            dependencies,
        )

    assert.deepEqual(
        result.outcome,
        {
            status:
                "pass",
        },
    )

    assert.equal(
        result.finalDraft,
        input.draft,
    )

    assert.equal(
        result.repairedDraft,
        null,
    )

    assert.equal(
        result.finalEvaluation,
        null,
    )

    assert.equal(
        counters.repairWriterCalls,
        0,
    )

    assert.equal(
        counters.validationCalls,
        1,
    )

    assert.equal(
        counters.scannerCalls,
        1,
    )

    assert.equal(
        counters.qualityCalls,
        1,
    )
})

test("repair loop short-circuits blocked initial draft without calling repair writer", async () => {
    const {
        dependencies,
        counters,
    } = createDependencies([
        validationBlocked(),
    ])

    const input =
        createInput()

    const result =
        await runSocialContentDraftRepairLoop(
            input,
            dependencies,
        )

    assert.deepEqual(
        result.outcome,
        {
            status:
                "blocked",
        },
    )

    assert.equal(
        result.finalDraft,
        input.draft,
    )

    assert.equal(
        result.repairedDraft,
        null,
    )

    assert.equal(
        result.finalEvaluation,
        null,
    )

    assert.equal(
        counters.repairWriterCalls,
        0,
    )

    /**
     * Unified evaluation short-circuits quality
     * on terminal safety status.
     */
    assert.equal(
        counters.qualityCalls,
        0,
    )
})

test("repair loop short-circuits requiresReview initial draft without calling repair writer", async () => {
    const {
        dependencies,
        counters,
    } = createDependencies([
        validationRequiresReview(),
    ])

    const input =
        createInput()

    const result =
        await runSocialContentDraftRepairLoop(
            input,
            dependencies,
        )

    assert.deepEqual(
        result.outcome,
        {
            status:
                "requiresReview",
        },
    )

    assert.equal(
        result.finalDraft,
        input.draft,
    )

    assert.equal(
        result.repairedDraft,
        null,
    )

    assert.equal(
        result.finalEvaluation,
        null,
    )

    assert.equal(
        counters.repairWriterCalls,
        0,
    )

    assert.equal(
        counters.qualityCalls,
        0,
    )
})

test("repair loop performs exactly one repair and returns repaired draft when final evaluation passes", async () => {
    const {
        dependencies,
        counters,
    } = createDependencies([
        validationRepairable(
            "Remove unsupported certainty.",
        ),

        validationPass(),
    ])

    const result =
        await runSocialContentDraftRepairLoop(
            createInput(),
            dependencies,
        )

    assert.deepEqual(
        result.outcome,
        {
            status:
                "pass",
        },
    )

    assert.equal(
        counters.repairWriterCalls,
        1,
    )

    assert.equal(
        counters.validationCalls,
        2,
    )

    assert.equal(
        counters.scannerCalls,
        2,
    )

    assert.equal(
        counters.qualityCalls,
        2,
    )

    assert.notEqual(
        result.repairedDraft,
        null,
    )

    assert.notEqual(
        result.finalEvaluation,
        null,
    )

    assert.equal(
        result.finalDraft,
        result.repairedDraft,
    )

    assert.equal(
        result.finalDraft.id,
        "draft-2",
    )

    assert.equal(
        result.finalDraft.contentId,
        "content-1",
    )

    assert.equal(
        result.finalDraft.version,
        2,
    )

    assert.equal(
        result.finalDraft.frames[1].body,
        "Repaired body 2.",
    )
})

test("repair loop converts a second repair outcome into requiresReview and never calls repair writer twice", async () => {
    const {
        dependencies,
        counters,
    } = createDependencies([
        validationRepairable(
            "First repair instruction.",
        ),

        validationRepairable(
            "Remaining repair instruction.",
        ),
    ])

    const result =
        await runSocialContentDraftRepairLoop(
            createInput(),
            dependencies,
        )

    /**
     * This is the central repair-budget invariant.
     */
    assert.deepEqual(
        result.outcome,
        {
            status:
                "requiresReview",
        },
    )

    assert.equal(
        counters.repairWriterCalls,
        1,
    )

    assert.equal(
        counters.validationCalls,
        2,
    )

    assert.equal(
        counters.scannerCalls,
        2,
    )

    assert.equal(
        counters.qualityCalls,
        2,
    )

    assert.equal(
        result.finalDraft.id,
        "draft-2",
    )

    assert.equal(
        result.finalDraft.version,
        2,
    )

    assert.equal(
        result.finalEvaluation.outcome.status,
        "repair",
    )
})

test("repair loop preserves blocked outcome from repaired draft", async () => {
    const {
        dependencies,
        counters,
    } = createDependencies([
        validationRepairable(),

        validationBlocked(),
    ])

    const result =
        await runSocialContentDraftRepairLoop(
            createInput(),
            dependencies,
        )

    assert.deepEqual(
        result.outcome,
        {
            status:
                "blocked",
        },
    )

    assert.equal(
        counters.repairWriterCalls,
        1,
    )

    assert.equal(
        counters.validationCalls,
        2,
    )

    /**
     * Initial repairable evaluation runs quality.
     * Final blocked evaluation does not.
     */
    assert.equal(
        counters.qualityCalls,
        1,
    )
})

test("repair loop preserves requiresReview outcome from repaired draft", async () => {
    const {
        dependencies,
        counters,
    } = createDependencies([
        validationRepairable(),

        validationRequiresReview(),
    ])

    const result =
        await runSocialContentDraftRepairLoop(
            createInput(),
            dependencies,
        )

    assert.deepEqual(
        result.outcome,
        {
            status:
                "requiresReview",
        },
    )

    assert.equal(
        counters.repairWriterCalls,
        1,
    )

    assert.equal(
        counters.validationCalls,
        2,
    )

    assert.equal(
        counters.qualityCalls,
        1,
    )
})

test("repair loop propagates repair writer failure and does not evaluate a nonexistent repaired draft", async () => {
    let validationCalls =
        0

    let repairWriterCalls =
        0

    const expectedError =
        new Error(
            "repair writer failed",
        )

    const dependencies = {
        scanClaims:
            async () => ({}),

        validateGeneration:
            async () => {
                validationCalls +=
                    1

                if (
                    validationCalls === 1
                ) {
                    return validationRepairable()
                }

                throw new Error(
                    "Second validation must not occur",
                )
            },

        reviewEditorialQuality:
            async () =>
                qualityPass(),

        repairWriter:
            async () => {
                repairWriterCalls +=
                    1

                throw expectedError
            },
    }

    await assert.rejects(
        () =>
            runSocialContentDraftRepairLoop(
                createInput(),
                dependencies,
            ),

        expectedError,
    )

    assert.equal(
        repairWriterCalls,
        1,
    )

    assert.equal(
        validationCalls,
        1,
    )
})