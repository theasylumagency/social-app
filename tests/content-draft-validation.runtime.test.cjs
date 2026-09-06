const assert = require("node:assert/strict")
const test = require("node:test")

const {
    validateSocialContentDraft,
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

function createValidationContext() {
    return {
        taskId:
            "task-1",

        facts: [],

        claims: [],

        constraints: [],
    }
}

test("content draft validation passes the same deterministic projection through scanner and validator", async () => {
    const scannerCalls = []
    const validatorCalls = []

    const scanResult = {
        signals: [
            {
                type:
                    "comparative",

                span:
                    "First body.",

                signalStrength:
                    "low",

                source:
                    "lexical",
            },
        ],

        candidates: [
            {
                text:
                    "First body.",

                signals: [],
            },
        ],
    }

    const validationResult = {
        status:
            "pass",

        issues: [],
    }

    const result =
        await validateSocialContentDraft(
            {
                draft:
                    createDraft(),

                validationContext:
                    createValidationContext(),
            },

            {
                scanClaims:
                    async (input) => {
                        scannerCalls.push(
                            input,
                        )

                        return scanResult
                    },

                validateGeneration:
                    async (input) => {
                        validatorCalls.push(
                            input,
                        )

                        return validationResult
                    },
            },
        )

    const expectedText =
        [
            "Caption.",
            "First heading",
            "First body.",
            "Second body.",
        ].join("\n\n")

    assert.equal(
        scannerCalls.length,
        1,
    )

    assert.deepEqual(
        scannerCalls[0],
        {
            draft:
                expectedText,
        },
    )

    assert.equal(
        validatorCalls.length,
        1,
    )

    assert.equal(
        validatorCalls[0].draft,
        expectedText,
    )

    assert.equal(
        validatorCalls[0].scan,
        scanResult,
    )

    assert.deepEqual(
        validatorCalls[0].context,
        createValidationContext(),
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
        result.projection.text,
        expectedText,
    )

    assert.equal(
        result.scan,
        scanResult,
    )

    assert.equal(
        result.validation,
        validationResult,
    )
})

test("content draft validation preserves repairable validator result", async () => {
    const validationResult = {
        status:
            "repairable",

        issues: [
            {
                type:
                    "unsupportedClaim",

                severity:
                    "medium",

                span:
                    "First body.",

                reason:
                    "Claim needs support.",
            },
        ],

        repairInstructions: [
            "Remove the unsupported claim.",
        ],
    }

    const result =
        await validateSocialContentDraft(
            {
                draft:
                    createDraft(),

                validationContext:
                    createValidationContext(),
            },

            {
                scanClaims:
                    async () => ({
                        signals: [],
                        candidates: [],
                    }),

                validateGeneration:
                    async () =>
                        validationResult,
            },
        )

    assert.equal(
        result.validation.status,
        "repairable",
    )

    assert.equal(
        result.validation,
        validationResult,
    )
})

test("content draft validation preserves requiresReview validator result", async () => {
    const result =
        await validateSocialContentDraft(
            {
                draft:
                    createDraft(),

                validationContext:
                    createValidationContext(),
            },

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
                                    "Claim cannot be resolved automatically.",
                            },
                        ],
                    }),
            },
        )

    assert.equal(
        result.validation.status,
        "requiresReview",
    )
})

test("content draft validation preserves blocked validator result", async () => {
    const result =
        await validateSocialContentDraft(
            {
                draft:
                    createDraft(),

                validationContext:
                    createValidationContext(),
            },

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
                                    "Publishing is not allowed.",
                            },
                        ],
                    }),
            },
        )

    assert.equal(
        result.validation.status,
        "blocked",
    )
})

test("content draft validation stops if claim scanning fails", async () => {
    let validatorCalled =
        false

    await assert.rejects(
        () =>
            validateSocialContentDraft(
                {
                    draft:
                        createDraft(),

                    validationContext:
                        createValidationContext(),
                },

                {
                    scanClaims:
                        async () => {
                            throw new Error(
                                "scanner failed",
                            )
                        },

                    validateGeneration:
                        async () => {
                            validatorCalled =
                                true

                            return {
                                status:
                                    "pass",

                                issues: [],
                            }
                        },
                },
            ),

        /scanner failed/,
    )

    assert.equal(
        validatorCalled,
        false,
    )
})

test("content draft validation propagates validator failure", async () => {
    await assert.rejects(
        () =>
            validateSocialContentDraft(
                {
                    draft:
                        createDraft(),

                    validationContext:
                        createValidationContext(),
                },

                {
                    scanClaims:
                        async () => ({
                            signals: [],
                            candidates: [],
                        }),

                    validateGeneration:
                        async () => {
                            throw new Error(
                                "validator failed",
                            )
                        },
                },
            ),

        /validator failed/,
    )
})