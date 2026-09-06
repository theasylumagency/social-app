const assert = require("node:assert/strict")
const test = require("node:test")

const {
    repairSocialContentDraft,
} = require(
    "../dist/blueprints/social/index.js",
)

function createPreviousDraft(
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
                    "Defective body 2.",
            },

            {
                order:
                    3,

                heading:
                    "Frame 3",

                body:
                    "Original body 3.",
            },
        ],

        createdAt:
            "2026-09-06T10:00:00+04:00",

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
            "Explain a treatment-planning concept.",

        keyTakeaway:
            "Assessment should clarify options before recommendation.",

        supportingPoints: [
            "Different factors can affect options.",
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
            "This is the best treatment for you.",
        ],

        rationale:
            "Reduce uncertainty.",

        createdAt:
            "2026-09-06T09:00:00+04:00",

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
            "Use a clear sequence.",
        ],

        constraints: [
            "Keep the carousel educational.",
        ],

        rationale:
            "Carousel supports sequential explanation.",

        createdAt:
            "2026-09-06T09:15:00+04:00",

        ...overrides,
    }
}

function createCommunicationEnvelope(
    overrides = {},
) {
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
            "Avoid assuming a diagnosis.",
        ],

        trustMechanisms: [
            "clarity",
        ],

        avoid: [
            "guarantees",
        ],

        rationale:
            "Fits the current audience landscape.",

        generatedAt:
            "2026-09-06T08:00:00+04:00",

        ...overrides,
    }
}

function createWriterContext() {
    return {
        taskId:
            "task-1",

        instruction:
            "Repair the approved Georgian carousel.",

        publicFacts: [
            {
                key:
                    "fact-1",

                value:
                    "Assessment and planning are part of the process.",
            },
        ],

        internalGuidance: [
            {
                key:
                    "guidance-1",

                value:
                    "Keep the tone calm.",
            },
        ],

        constraints: [],

        proof: [],

        audience: {
            value:
                "Audience context.",
        },

        contentDirection: {
            value:
                "Explain before recommendation.",
        },

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

function createRepairEvaluation(
    overrides = {},
) {
    return {
        status:
            "repair",

        brief: {
            instructions: [
                {
                    source:
                        "safety",

                    instruction:
                        "Remove the unsupported claim from frame 2.",
                },
            ],

            preserve: [
                "taskIntent",
                "tone",
                "structure",
            ],
        },

        ...overrides,
    }
}

function createInput(
    overrides = {},
) {
    return {
        previousDraft:
            createPreviousDraft(),

        evaluation:
            createRepairEvaluation(),

        contentBrief:
            createContentBrief(),

        contentExecutionSpec:
            createExecutionSpec(),

        communicationEnvelope:
            createCommunicationEnvelope(),

        writerContext:
            createWriterContext(),

        repairedDraftId:
            "draft-2",

        createdAt:
            "2026-09-06T11:00:00+04:00",

        ...overrides,
    }
}

function createRepairProposal(
    overrides = {},
) {
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

            {
                heading:
                    "Frame 3",

                body:
                    "Original body 3.",
            },
        ],

        script:
            null,

        onScreenText: [],

        ...overrides,
    }
}

test("production repair creates a new immutable draft with inherited lineage and version + 1", async () => {
    const previousDraft =
        createPreviousDraft()

    const snapshot =
        structuredClone(
            previousDraft,
        )

    const repaired =
        await repairSocialContentDraft(
            createInput({
                previousDraft,
            }),

            async () =>
                createRepairProposal(),
        )

    assert.equal(
        repaired.id,
        "draft-2",
    )

    assert.equal(
        repaired.contentId,
        "content-1",
    )

    assert.equal(
        repaired.contentBriefId,
        "brief-1",
    )

    assert.equal(
        repaired.contentExecutionSpecId,
        "execution-spec-1",
    )

    assert.equal(
        repaired.version,
        2,
    )

    assert.equal(
        repaired.locale,
        "ka",
    )

    assert.equal(
        repaired.format,
        "carousel",
    )

    assert.deepEqual(
        previousDraft,
        snapshot,
    )
})

test("production repair writer receives copy-only previous draft without application authority", async () => {
    let receivedInput =
        null

    await repairSocialContentDraft(
        createInput(),

        async (input) => {
            receivedInput =
                input

            return createRepairProposal()
        },
    )

    assert.deepEqual(
        receivedInput.previousDraft,
        {
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
                        "Defective body 2.",
                },

                {
                    heading:
                        "Frame 3",

                    body:
                        "Original body 3.",
                },
            ],

            script:
                null,

            onScreenText: [],
        },
    )

    for (
        const forbiddenField
        of [
            "id",
            "contentId",
            "contentBriefId",
            "contentExecutionSpecId",
            "version",
            "locale",
            "format",
            "createdAt",
        ]
    ) {
        assert.equal(
            Object.prototype.hasOwnProperty.call(
                receivedInput.previousDraft,
                forbiddenField,
            ),
            false,
        )
    }

    for (
        const frame
        of receivedInput.previousDraft.frames
    ) {
        assert.equal(
            Object.prototype.hasOwnProperty.call(
                frame,
                "order",
            ),
            false,
        )
    }
})

test("production repair writer receives exact consolidated repair brief", async () => {
    const evaluation =
        createRepairEvaluation()

    let receivedInput =
        null

    await repairSocialContentDraft(
        createInput({
            evaluation,
        }),

        async (input) => {
            receivedInput =
                input

            return createRepairProposal()
        },
    )

    assert.deepEqual(
        receivedInput.repairBrief,
        evaluation.brief,
    )
})

test("production repair writer receives curated brief, execution, and envelope authority", async () => {
    let receivedInput =
        null

    await repairSocialContentDraft(
        createInput(),

        async (input) => {
            receivedInput =
                input

            return createRepairProposal()
        },
    )

    assert.deepEqual(
        Object.keys(
            receivedInput.contentBrief,
        ).sort(),
        [
            "audienceDirection",
            "communicationJob",
            "constraints",
            "ctaIntent",
            "evidenceMode",
            "keyTakeaway",
            "mustNotSay",
            "supportingPoints",
        ].sort(),
    )

    assert.deepEqual(
        Object.keys(
            receivedInput.execution,
        ).sort(),
        [
            "channel",
            "constraints",
            "contentMode",
            "depth",
            "executionGuidance",
            "format",
            "visualDependency",
        ].sort(),
    )

    assert.equal(
        Object.prototype.hasOwnProperty.call(
            receivedInput.communicationEnvelope,
            "id",
        ),
        false,
    )

    assert.equal(
        Object.prototype.hasOwnProperty.call(
            receivedInput.communicationEnvelope,
            "brandId",
        ),
        false,
    )

    assert.equal(
        Object.prototype.hasOwnProperty.call(
            receivedInput.communicationEnvelope,
            "rationale",
        ),
        false,
    )

    assert.deepEqual(
        receivedInput.writerContext,
        createWriterContext(),
    )
})

test("production repair rejects provenance mismatch before repair writer runs", async () => {
    let writerCalled =
        false

    const input =
        createInput({
            contentExecutionSpec:
                createExecutionSpec({
                    id:
                        "execution-spec-2",
                }),
        })

    await assert.rejects(
        () =>
            repairSocialContentDraft(
                input,

                async () => {
                    writerCalled =
                        true

                    return createRepairProposal()
                },
            ),
    )

    assert.equal(
        writerCalled,
        false,
    )
})

test("production repair propagates repair writer failure without creating a repaired draft", async () => {
    const error =
        new Error(
            "repair writer failed",
        )

    await assert.rejects(
        () =>
            repairSocialContentDraft(
                createInput(),

                async () => {
                    throw error
                },
            ),

        error,
    )
})

test("production repair enforces structure preservation after model output", async () => {
    await assert.rejects(
        () =>
            repairSocialContentDraft(
                createInput(),

                async () => ({
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
                }),
            ),

        /Repair must preserve frame count when structure preservation is required/,
    )
})

test("production repair allows frame-count change when structure preservation is not required", async () => {
    const input =
        createInput({
            evaluation: {
                status:
                    "repair",

                brief: {
                    instructions: [
                        {
                            source:
                                "quality",

                            instruction:
                                "Simplify the structure.",
                        },
                    ],

                    preserve: [
                        "taskIntent",
                        "tone",
                    ],
                },
            },
        })

    const repaired =
        await repairSocialContentDraft(
            input,

            async () => ({
                text:
                    null,

                caption:
                    "Original caption.",

                frames: [
                    {
                        heading:
                            "Frame 1",

                        body:
                            "Revised body 1.",
                    },

                    {
                        heading:
                            "Frame 2",

                        body:
                            "Revised body 2.",
                    },
                ],

                script:
                    null,

                onScreenText: [],
            }),
        )

    assert.equal(
        repaired.frames.length,
        2,
    )

    assert.equal(
        repaired.version,
        2,
    )
})

test("production repair rejects model attempts to return application authority", async () => {
    await assert.rejects(
        () =>
            repairSocialContentDraft(
                createInput(),

                async () => ({
                    ...createRepairProposal(),

                    version:
                        2,
                }),
            ),

        /Content draft proposal contains unsupported field: version/,
    )
})

test("production repair canonicalizes repaired copy through the normal draft assembler", async () => {
    const repaired =
        await repairSocialContentDraft(
            createInput(),

            async () =>
                createRepairProposal({
                    caption:
                        "  Repaired caption.  ",

                    frames: [
                        {
                            heading:
                                "  Frame 1  ",

                            body:
                                "  Original body 1.  ",
                        },

                        {
                            heading:
                                "  Frame 2  ",

                            body:
                                "  Repaired body 2.  ",
                        },

                        {
                            heading:
                                "  Frame 3  ",

                            body:
                                "  Original body 3.  ",
                        },
                    ],
                }),
        )

    assert.equal(
        repaired.caption,
        "Repaired caption.",
    )

    assert.deepEqual(
        repaired.frames,
        [
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
                    "Repaired body 2.",
            },

            {
                order:
                    3,

                heading:
                    "Frame 3",

                body:
                    "Original body 3.",
            },
        ],
    )
})