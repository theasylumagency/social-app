const assert = require("node:assert/strict")
const test = require("node:test")

const {
    reduceSocialContentDraftEvaluation,
} = require(
    "../dist/blueprints/social/index.js",
)

function validation(
    status,
    overrides = {},
) {
    return {
        status,
        issues: [],
        ...overrides,
    }
}

function quality(
    status,
    overrides = {},
) {
    return {
        status,
        dimensions: [],
        issues: [],
        ...overrides,
    }
}

test("content draft evaluation passes only when validation and quality both pass", () => {
    const result =
        reduceSocialContentDraftEvaluation({
            validation:
                validation("pass"),

            quality:
                quality("pass"),
        })

    assert.deepEqual(
        result,
        {
            status:
                "pass",
        },
    )
})

test("content draft evaluation blocked validation always wins", () => {
    for (
        const qualityStatus
        of ["pass", "revise"]
    ) {
        const result =
            reduceSocialContentDraftEvaluation({
                validation:
                    validation(
                        "blocked",
                    ),

                quality:
                    quality(
                        qualityStatus,
                        qualityStatus === "revise"
                            ? {
                                repairInstructions: [
                                    "Improve wording.",
                                ],
                            }
                            : {},
                    ),
            })

        assert.deepEqual(
            result,
            {
                status:
                    "blocked",
            },
        )
    }
})

test("content draft evaluation requiresReview validation outranks editorial repair", () => {
    const result =
        reduceSocialContentDraftEvaluation({
            validation:
                validation(
                    "requiresReview",
                ),

            quality:
                quality(
                    "revise",
                    {
                        repairInstructions: [
                            "Improve clarity.",
                        ],
                    },
                ),
        })

    assert.deepEqual(
        result,
        {
            status:
                "requiresReview",
        },
    )
})

test("content draft evaluation converts repairable safety result into repair", () => {
    const result =
        reduceSocialContentDraftEvaluation({
            validation:
                validation(
                    "repairable",
                    {
                        repairInstructions: [
                            "Remove unsupported specificity.",
                        ],
                    },
                ),

            quality:
                quality("pass"),
        })

    assert.deepEqual(
        result,
        {
            status:
                "repair",

            brief: {
                instructions: [
                    {
                        source:
                            "safety",

                        instruction:
                            "Remove unsupported specificity.",
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
})

test("content draft evaluation converts editorial revise into repair", () => {
    const result =
        reduceSocialContentDraftEvaluation({
            validation:
                validation("pass"),

            quality:
                quality(
                    "revise",
                    {
                        repairInstructions: [
                            "Make the explanation more concrete.",
                        ],
                    },
                ),
        })

    assert.deepEqual(
        result,
        {
            status:
                "repair",

            brief: {
                instructions: [
                    {
                        source:
                            "quality",

                        instruction:
                            "Make the explanation more concrete.",
                    },
                ],

                preserve: [
                    "taskIntent",
                    "tone",
                    "structure",
                    "specificity",
                ],
            },
        },
    )
})

test("content draft evaluation consolidates safety and quality repair instructions", () => {
    const result =
        reduceSocialContentDraftEvaluation({
            validation:
                validation(
                    "repairable",
                    {
                        repairInstructions: [
                            "Remove unsupported claim.",
                        ],
                    },
                ),

            quality:
                quality(
                    "revise",
                    {
                        repairInstructions: [
                            "Improve the opening.",
                        ],
                    },
                ),
        })

    assert.deepEqual(
        result,
        {
            status:
                "repair",

            brief: {
                instructions: [
                    {
                        source:
                            "safety",

                        instruction:
                            "Remove unsupported claim.",
                    },

                    {
                        source:
                            "quality",

                        instruction:
                            "Improve the opening.",
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
})

test("content draft evaluation does not preserve weak brand fidelity", () => {
    const result =
        reduceSocialContentDraftEvaluation({
            validation:
                validation("pass"),

            quality:
                quality(
                    "revise",
                    {
                        dimensions: [
                            {
                                dimension:
                                    "brandFidelity",

                                rating:
                                    "weak",
                            },
                        ],

                        repairInstructions: [
                            "Restore the approved brand voice.",
                        ],
                    },
                ),
        })

    assert.deepEqual(
        result.brief.preserve,
        [
            "taskIntent",
            "structure",
            "specificity",
        ],
    )
})

test("content draft evaluation does not preserve weak structure", () => {
    const result =
        reduceSocialContentDraftEvaluation({
            validation:
                validation("pass"),

            quality:
                quality(
                    "revise",
                    {
                        dimensions: [
                            {
                                dimension:
                                    "structure",

                                rating:
                                    "weak",
                            },
                        ],

                        repairInstructions: [
                            "Restructure the content.",
                        ],
                    },
                ),
        })

    assert.deepEqual(
        result.brief.preserve,
        [
            "taskIntent",
            "tone",
            "specificity",
        ],
    )
})

test("content draft evaluation does not preserve weak specificity", () => {
    const result =
        reduceSocialContentDraftEvaluation({
            validation:
                validation("pass"),

            quality:
                quality(
                    "revise",
                    {
                        dimensions: [
                            {
                                dimension:
                                    "specificity",

                                rating:
                                    "weak",
                            },
                        ],

                        repairInstructions: [
                            "Make the explanation more specific using supported context.",
                        ],
                    },
                ),
        })

    assert.deepEqual(
        result.brief.preserve,
        [
            "taskIntent",
            "tone",
            "structure",
        ],
    )
})

test("content draft evaluation can release tone structure and specificity independently", () => {
    const result =
        reduceSocialContentDraftEvaluation({
            validation:
                validation("pass"),

            quality:
                quality(
                    "revise",
                    {
                        dimensions: [
                            {
                                dimension:
                                    "brandFidelity",

                                rating:
                                    "weak",
                            },

                            {
                                dimension:
                                    "structure",

                                rating:
                                    "weak",
                            },

                            {
                                dimension:
                                    "specificity",

                                rating:
                                    "weak",
                            },
                        ],

                        repairInstructions: [
                            "Rewrite within the approved task intent.",
                        ],
                    },
                ),
        })

    assert.deepEqual(
        result.brief.preserve,
        [
            "taskIntent",
        ],
    )
})

test("content draft evaluation never preserves specificity during safety repair", () => {
    const result =
        reduceSocialContentDraftEvaluation({
            validation:
                validation(
                    "repairable",
                    {
                        repairInstructions: [
                            "Reduce unsupported specificity.",
                        ],
                    },
                ),

            quality:
                quality(
                    "revise",
                    {
                        dimensions: [
                            {
                                dimension:
                                    "specificity",

                                rating:
                                    "strong",
                            },
                        ],

                        repairInstructions: [
                            "Improve clarity.",
                        ],
                    },
                ),
        })

    assert.equal(
        result.status,
        "repair",
    )

    assert.equal(
        result.brief.preserve.includes(
            "specificity",
        ),
        false,
    )
})

test("content draft evaluation requires review when safety repair has no actionable instruction", () => {
    const result =
        reduceSocialContentDraftEvaluation({
            validation:
                validation(
                    "repairable",
                ),

            quality:
                quality("pass"),
        })

    assert.deepEqual(
        result,
        {
            status:
                "requiresReview",
        },
    )
})

test("content draft evaluation requires review when quality revision has no actionable instruction", () => {
    const result =
        reduceSocialContentDraftEvaluation({
            validation:
                validation("pass"),

            quality:
                quality("revise"),
        })

    assert.deepEqual(
        result,
        {
            status:
                "requiresReview",
        },
    )
})

test("content draft evaluation ignores blank repair instructions", () => {
    const result =
        reduceSocialContentDraftEvaluation({
            validation:
                validation(
                    "repairable",
                    {
                        repairInstructions: [
                            "   ",
                        ],
                    },
                ),

            quality:
                quality("pass"),
        })

    assert.deepEqual(
        result,
        {
            status:
                "requiresReview",
        },
    )
})

test("content draft evaluation trims and deduplicates repair instructions per source", () => {
    const result =
        reduceSocialContentDraftEvaluation({
            validation:
                validation(
                    "repairable",
                    {
                        repairInstructions: [
                            "  Remove unsupported claim.  ",
                            "Remove unsupported claim.",
                        ],
                    },
                ),

            quality:
                quality(
                    "revise",
                    {
                        repairInstructions: [
                            "  Improve clarity.  ",
                            "Improve clarity.",
                        ],
                    },
                ),
        })

    assert.deepEqual(
        result.brief.instructions,
        [
            {
                source:
                    "safety",

                instruction:
                    "Remove unsupported claim.",
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