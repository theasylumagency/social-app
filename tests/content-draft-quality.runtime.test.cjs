const assert = require("node:assert/strict")
const test = require("node:test")

const {
    evaluateSocialContentDraftQuality,
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
                    "First heading",

                body:
                    "First body.",
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
            "weekly-direction-1",

        contentId:
            "content-1",

        communicationJob:
            "Explain what diagnostics should clarify before treatment decisions.",

        keyTakeaway:
            "Diagnostics helps clarify options before an individual recommendation.",

        supportingPoints: [
            "Clarify the problem.",
            "Clarify constraints.",
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

        constraints: [
            "Do not diagnose.",
        ],

        mustNotSay: [
            "Do not guarantee outcomes.",
        ],

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
            "Move from diagnostics to concrete decision questions.",
            "Keep the final frame reflective rather than promotional.",
        ],

        constraints: [
            "Preserve assessment boundary.",
        ],

        rationale:
            "Sequential explanation fits the communication job.",

        createdAt:
            "2026-09-06T10:15:00+04:00",

        ...overrides,
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

        audience: {
            value: {
                explanationNeed:
                    "high",
            },
        },

        contentDirection: {
            value: {
                direction:
                    "diagnostics before treatment choice",
            },
        },

        references: [],

        recentContent: [],
    }
}

test("content draft quality reviewer receives deterministic public projection and curated context", async () => {
    const calls = []

    const qualityResult = {
        status:
            "pass",

        dimensions: [
            {
                dimension:
                    "taskFit",

                rating:
                    "strong",
            },

            {
                dimension:
                    "brandFidelity",

                rating:
                    "strong",
            },
        ],

        issues: [],
    }

    const result =
        await evaluateSocialContentDraftQuality(
            {
                draft:
                    createDraft(),

                contentBrief:
                    createContentBrief(),

                contentExecutionSpec:
                    createExecutionSpec(),

                qualityContext:
                    createQualityContext(),
            },

            async (input) => {
                calls.push(
                    input,
                )

                return qualityResult
            },
        )

    assert.equal(
        calls.length,
        1,
    )

    const reviewerInput =
        calls[0]

    assert.equal(
        reviewerInput.projection.text,
        [
            "Caption.",
            "First heading",
            "First body.",
            "Second body.",
        ].join("\n\n"),
    )

    assert.deepEqual(
        reviewerInput.task,
        {
            communicationJob:
                "Explain what diagnostics should clarify before treatment decisions.",

            keyTakeaway:
                "Diagnostics helps clarify options before an individual recommendation.",

            supportingPoints: [
                "Clarify the problem.",
                "Clarify constraints.",
                "Clarify alternatives.",
            ],

            ctaIntent:
                "encourageReflection",
        },
    )

    assert.deepEqual(
        reviewerInput.execution,
        {
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
                "Move from diagnostics to concrete decision questions.",
                "Keep the final frame reflective rather than promotional.",
            ],
        },
    )

    assert.deepEqual(
        reviewerInput.context,
        createQualityContext(),
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
        result.quality,
        qualityResult,
    )
})

test("content draft quality reviewer does not receive evidence or safety authority from Content Brief", async () => {
    let reviewerInput

    await evaluateSocialContentDraftQuality(
        {
            draft:
                createDraft(),

            contentBrief:
                createContentBrief({
                    evidenceMode:
                        "proofRequired",

                    evidenceIds: [
                        "evidence-1",
                    ],

                    constraints: [
                        "Safety constraint.",
                    ],

                    mustNotSay: [
                        "Forbidden claim.",
                    ],

                    rationale:
                        "Internal planning rationale.",
                }),

            contentExecutionSpec:
                createExecutionSpec(),

            qualityContext:
                createQualityContext(),
        },

        async (input) => {
            reviewerInput =
                input

            return {
                status:
                    "pass",

                dimensions: [],

                issues: [],
            }
        },
    )

    assert.equal(
        Object.hasOwn(
            reviewerInput.task,
            "evidenceMode",
        ),
        false,
    )

    assert.equal(
        Object.hasOwn(
            reviewerInput.task,
            "evidenceIds",
        ),
        false,
    )

    assert.equal(
        Object.hasOwn(
            reviewerInput.task,
            "constraints",
        ),
        false,
    )

    assert.equal(
        Object.hasOwn(
            reviewerInput.task,
            "mustNotSay",
        ),
        false,
    )

    assert.equal(
        Object.hasOwn(
            reviewerInput.task,
            "rationale",
        ),
        false,
    )
})

test("content draft quality preserves revise result", async () => {
    const qualityResult = {
        status:
            "revise",

        dimensions: [
            {
                dimension:
                    "nonGenericity",

                rating:
                    "weak",

                note:
                    "Copy is too generic.",
            },
        ],

        issues: [
            {
                type:
                    "genericLanguage",

                dimension:
                    "nonGenericity",

                note:
                    "Copy relies on generic phrasing.",
            },
        ],

        repairInstructions: [
            "Make the explanation more concrete without inventing facts.",
        ],
    }

    const result =
        await evaluateSocialContentDraftQuality(
            {
                draft:
                    createDraft(),

                contentBrief:
                    createContentBrief(),

                contentExecutionSpec:
                    createExecutionSpec(),

                qualityContext:
                    createQualityContext(),
            },

            async () =>
                qualityResult,
        )

    assert.equal(
        result.quality.status,
        "revise",
    )

    assert.equal(
        result.quality,
        qualityResult,
    )
})

test("content draft quality rejects mismatched Content Brief provenance", async () => {
    let reviewerCalled =
        false

    await assert.rejects(
        () =>
            evaluateSocialContentDraftQuality(
                {
                    draft:
                        createDraft(),

                    contentBrief:
                        createContentBrief({
                            id:
                                "brief-2",
                        }),

                    contentExecutionSpec:
                        createExecutionSpec(),

                    qualityContext:
                        createQualityContext(),
                },

                async () => {
                    reviewerCalled =
                        true

                    return {
                        status:
                            "pass",

                        dimensions: [],

                        issues: [],
                    }
                },
            ),

        /does not belong to the supplied Content Brief/,
    )

    assert.equal(
        reviewerCalled,
        false,
    )
})

test("content draft quality rejects mismatched Content Execution Spec provenance", async () => {
    await assert.rejects(
        () =>
            evaluateSocialContentDraftQuality(
                {
                    draft:
                        createDraft(),

                    contentBrief:
                        createContentBrief(),

                    contentExecutionSpec:
                        createExecutionSpec({
                            id:
                                "execution-spec-2",
                        }),

                    qualityContext:
                        createQualityContext(),
                },

                async () => ({
                    status:
                        "pass",

                    dimensions: [],

                    issues: [],
                }),
            ),

        /does not belong to the supplied Content Execution Spec/,
    )
})

test("content draft quality rejects Execution Spec from another Content Brief", async () => {
    await assert.rejects(
        () =>
            evaluateSocialContentDraftQuality(
                {
                    draft:
                        createDraft(),

                    contentBrief:
                        createContentBrief(),

                    contentExecutionSpec:
                        createExecutionSpec({
                            contentBriefId:
                                "brief-2",
                        }),

                    qualityContext:
                        createQualityContext(),
                },

                async () => ({
                    status:
                        "pass",

                    dimensions: [],

                    issues: [],
                }),
            ),

        /Content Execution Spec does not belong to the supplied Content Brief/,
    )
})

test("content draft quality rejects format mismatch", async () => {
    await assert.rejects(
        () =>
            evaluateSocialContentDraftQuality(
                {
                    draft:
                        createDraft(),

                    contentBrief:
                        createContentBrief(),

                    contentExecutionSpec:
                        createExecutionSpec({
                            format:
                                "reel",
                        }),

                    qualityContext:
                        createQualityContext(),
                },

                async () => ({
                    status:
                        "pass",

                    dimensions: [],

                    issues: [],
                }),
            ),

        /format does not match/,
    )
})

test("content draft quality rejects mismatched content identity when Brief owns one", async () => {
    await assert.rejects(
        () =>
            evaluateSocialContentDraftQuality(
                {
                    draft:
                        createDraft({
                            contentId:
                                "content-2",
                        }),

                    contentBrief:
                        createContentBrief(),

                    contentExecutionSpec:
                        createExecutionSpec(),

                    qualityContext:
                        createQualityContext(),
                },

                async () => ({
                    status:
                        "pass",

                    dimensions: [],

                    issues: [],
                }),
            ),

        /does not match the Content Brief content identity/,
    )
})

test("content draft quality allows Brief without preassigned content identity", async () => {
    const brief =
        createContentBrief()

    delete brief.contentId

    const result =
        await evaluateSocialContentDraftQuality(
            {
                draft:
                    createDraft(),

                contentBrief:
                    brief,

                contentExecutionSpec:
                    createExecutionSpec(),

                qualityContext:
                    createQualityContext(),
            },

            async () => ({
                status:
                    "pass",

                dimensions: [],

                issues: [],
            }),
        )

    assert.equal(
        result.quality.status,
        "pass",
    )
})

test("content draft quality propagates reviewer failure", async () => {
    await assert.rejects(
        () =>
            evaluateSocialContentDraftQuality(
                {
                    draft:
                        createDraft(),

                    contentBrief:
                        createContentBrief(),

                    contentExecutionSpec:
                        createExecutionSpec(),

                    qualityContext:
                        createQualityContext(),
                },

                async () => {
                    throw new Error(
                        "quality reviewer failed",
                    )
                },
            ),

        /quality reviewer failed/,
    )
})