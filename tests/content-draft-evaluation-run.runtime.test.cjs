const assert = require("node:assert/strict")
const test = require("node:test")

const {
    evaluateSocialContentDraft,
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

        caption:
            "Caption.",

        frames: [
            {
                order:
                    1,

                heading:
                    "Heading",

                body:
                    "Body.",
            },

            {
                order:
                    2,

                body:
                    "Second body.",
            },
        ],

        createdAt:
            "2026-09-06T10:45:00+04:00",

        ...overrides,
    }
}

function createContentBrief(
    overrides = {},
) {
    return {
        id:
            "brief-1",

        weeklyPlanId:
            "weekly-plan-1",

        weeklyContentDirectionId:
            "direction-1",

        contentId:
            "content-1",

        communicationJob:
            "Explain the role of diagnostics.",

        keyTakeaway:
            "Diagnostics should clarify options before recommendation.",

        supportingPoints: [
            "Clarify the problem.",
            "Clarify alternatives.",
        ],

        audienceDirection: {
            primaryAudience:
                "audience-1",

            secondaryAudiences: [],

            bias:
                "moreExplanatory",
        },

        evidenceMode:
            "noProofNeeded",

        evidenceIds: [],

        ctaIntent:
            "encourageReflection",

        constraints: [],

        mustNotSay: [],

        rationale:
            "Reduce uncertainty.",

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

        executionGuidance: [
            "Use sequential explanation.",
        ],

        constraints: [],

        rationale:
            "Carousel fits the brief.",

        createdAt:
            "2026-09-06T10:15:00+04:00",

        ...overrides,
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

        references: [],

        recentContent: [],
    }
}

function createInput() {
    return {
        draft:
            createDraft(),

        contentBrief:
            createContentBrief(),

        contentExecutionSpec:
            createExecutionSpec(),

        validationContext:
            createValidationContext(),

        qualityContext:
            createQualityContext(),
    }
}

test("content draft evaluation returns pass when validation and quality both pass", async () => {
    const result =
        await evaluateSocialContentDraft(
            createInput(),

            {
                scanClaims:
                    async () => ({
                        signals: [],
                        candidates: [],
                    }),

                validateGeneration:
                    async () => ({
                        status:
                            "pass",

                        issues: [],
                    }),

                reviewEditorialQuality:
                    async () => ({
                        status:
                            "pass",

                        dimensions: [],

                        issues: [],
                    }),
            },
        )

    assert.equal(
        result.outcome.status,
        "pass",
    )

    assert.equal(
        result.quality !== null,
        true,
    )
})

test("content draft evaluation short-circuits quality review when validation blocks", async () => {
    let qualityCalled =
        false

    const result =
        await evaluateSocialContentDraft(
            createInput(),

            {
                scanClaims:
                    async () => ({
                        signals: [],
                        candidates: [],
                    }),

                validateGeneration:
                    async () => ({
                        status:
                            "blocked",

                        issues: [
                            {
                                type:
                                    "forbiddenClaim",

                                severity:
                                    "high",

                                reason:
                                    "Blocked.",
                            },
                        ],
                    }),

                reviewEditorialQuality:
                    async () => {
                        qualityCalled =
                            true

                        return {
                            status:
                                "pass",

                            dimensions: [],

                            issues: [],
                        }
                    },
            },
        )

    assert.equal(
        qualityCalled,
        false,
    )

    assert.equal(
        result.quality,
        null,
    )

    assert.deepEqual(
        result.outcome,
        {
            status:
                "blocked",
        },
    )
})

test("content draft evaluation short-circuits quality review when validation requires review", async () => {
    let qualityCalled =
        false

    const result =
        await evaluateSocialContentDraft(
            createInput(),

            {
                scanClaims:
                    async () => ({
                        signals: [],
                        candidates: [],
                    }),

                validateGeneration:
                    async () => ({
                        status:
                            "requiresReview",

                        issues: [
                            {
                                type:
                                    "ambiguousClaim",

                                severity:
                                    "medium",

                                reason:
                                    "Needs human review.",
                            },
                        ],
                    }),

                reviewEditorialQuality:
                    async () => {
                        qualityCalled =
                            true

                        return {
                            status:
                                "pass",

                            dimensions: [],

                            issues: [],
                        }
                    },
            },
        )

    assert.equal(
        qualityCalled,
        false,
    )

    assert.equal(
        result.quality,
        null,
    )

    assert.deepEqual(
        result.outcome,
        {
            status:
                "requiresReview",
        },
    )
})

test("content draft evaluation runs quality review for repairable validation and consolidates repair", async () => {
    let qualityCalled =
        false

    const result =
        await evaluateSocialContentDraft(
            createInput(),

            {
                scanClaims:
                    async () => ({
                        signals: [],
                        candidates: [],
                    }),

                validateGeneration:
                    async () => ({
                        status:
                            "repairable",

                        issues: [],

                        repairInstructions: [
                            "Remove unsupported specificity.",
                        ],
                    }),

                reviewEditorialQuality:
                    async () => {
                        qualityCalled =
                            true

                        return {
                            status:
                                "revise",

                            dimensions: [],

                            issues: [],

                            repairInstructions: [
                                "Improve clarity.",
                            ],
                        }
                    },
            },
        )

    assert.equal(
        qualityCalled,
        true,
    )

    assert.equal(
        result.outcome.status,
        "repair",
    )

    assert.deepEqual(
        result.outcome.brief.instructions,
        [
            {
                source:
                    "safety",

                instruction:
                    "Remove unsupported specificity.",
            },

            {
                source:
                    "quality",

                instruction:
                    "Improve clarity.",
            },
        ],
    )
})

test("content draft evaluation turns quality revise into repair after validation passes", async () => {
    const result =
        await evaluateSocialContentDraft(
            createInput(),

            {
                scanClaims:
                    async () => ({
                        signals: [],
                        candidates: [],
                    }),

                validateGeneration:
                    async () => ({
                        status:
                            "pass",

                        issues: [],
                    }),

                reviewEditorialQuality:
                    async () => ({
                        status:
                            "revise",

                        dimensions: [
                            {
                                dimension:
                                    "clarity",

                                rating:
                                    "weak",
                            },
                        ],

                        issues: [],

                        repairInstructions: [
                            "Simplify the explanation.",
                        ],
                    }),
            },
        )

    assert.equal(
        result.outcome.status,
        "repair",
    )

    assert.deepEqual(
        result.outcome.brief.instructions,
        [
            {
                source:
                    "quality",

                instruction:
                    "Simplify the explanation.",
            },
        ],
    )
})

test("content draft evaluation checks provenance before scanner runs", async () => {
    let scannerCalled =
        false

    const input =
        createInput()

    input.contentExecutionSpec =
        createExecutionSpec({
            id:
                "execution-spec-2",
        })

    await assert.rejects(
        () =>
            evaluateSocialContentDraft(
                input,

                {
                    scanClaims:
                        async () => {
                            scannerCalled =
                                true

                            return {
                                signals: [],
                                candidates: [],
                            }
                        },

                    validateGeneration:
                        async () => ({
                            status:
                                "pass",

                            issues: [],
                        }),

                    reviewEditorialQuality:
                        async () => ({
                            status:
                                "pass",

                            dimensions: [],

                            issues: [],
                        }),
                },
            ),

        /does not belong to the supplied Content Execution Spec/,
    )

    assert.equal(
        scannerCalled,
        false,
    )
})

test("content draft evaluation preserves immutable draft identity across both evaluation runs", async () => {
    const result =
        await evaluateSocialContentDraft(
            createInput(),

            {
                scanClaims:
                    async () => ({
                        signals: [],
                        candidates: [],
                    }),

                validateGeneration:
                    async () => ({
                        status:
                            "pass",

                        issues: [],
                    }),

                reviewEditorialQuality:
                    async () => ({
                        status:
                            "pass",

                        dimensions: [],

                        issues: [],
                    }),
            },
        )

    assert.equal(
        result.contentDraftId,
        "draft-1",
    )

    assert.equal(
        result.version,
        1,
    )

    assert.equal(
        result.validation.contentDraftId,
        "draft-1",
    )

    assert.equal(
        result.validation.version,
        1,
    )

    assert.equal(
        result.quality.contentDraftId,
        "draft-1",
    )

    assert.equal(
        result.quality.version,
        1,
    )
})