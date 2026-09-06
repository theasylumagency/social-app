const assert = require("node:assert/strict")
const test = require("node:test")

const {
    assembleContentExecutionSpecs,
} = require("../dist/blueprints/social/index.js")

function createProposal(
    overrides = {},
) {
    return {
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
            "Explain the idea in a clear sequence.",
        ],

        constraints: [
            "Do not turn general guidance into individual advice.",
        ],

        rationale:
            "The sequential format supports the communication job.",

        ...overrides,
    }
}

function createValidInput() {
    return {
        contentBriefId:
            "content-brief-1",

        eligibleChannels: [
            "facebook",
            "instagram",
        ],

        eligibleContentModes: [
            "social.educational",
            "social.trustBuilder",
        ],

        specs: [
            {
                id:
                    "execution-spec-1",

                proposal:
                    createProposal(),
            },
        ],

        createdAt:
            "2026-09-06T23:00:00+04:00",
    }
}

test("content execution spec assembly creates canonical destination specs", () => {
    const specs =
        assembleContentExecutionSpecs(
            createValidInput(),
        )

    assert.equal(
        specs.length,
        1,
    )

    assert.equal(
        specs[0].id,
        "execution-spec-1",
    )

    assert.equal(
        specs[0].contentBriefId,
        "content-brief-1",
    )

    assert.equal(
        specs[0].channel,
        "instagram",
    )

    assert.equal(
        specs[0].contentMode,
        "social.educational",
    )

    assert.equal(
        specs[0].format,
        "carousel",
    )
})

test("content execution spec assembly supports separate eligible destinations", () => {
    const input =
        createValidInput()

    input.specs = [
        {
            id:
                "execution-spec-instagram",

            proposal:
                createProposal({
                    channel:
                        "instagram",

                    format:
                        "carousel",
                }),
        },

        {
            id:
                "execution-spec-facebook",

            proposal:
                createProposal({
                    channel:
                        "facebook",

                    format:
                        "staticPost",

                    visualDependency:
                        "none",
                }),
        },
    ]

    const specs =
        assembleContentExecutionSpecs(
            input,
        )

    assert.equal(
        specs.length,
        2,
    )

    assert.deepEqual(
        specs.map(
            (spec) =>
                spec.channel,
        ),
        [
            "instagram",
            "facebook",
        ],
    )
})

test("content execution spec assembly rejects duplicate destination and identity", () => {
    const duplicateChannel =
        createValidInput()

    duplicateChannel.specs = [
        {
            id:
                "execution-spec-1",

            proposal:
                createProposal(),
        },

        {
            id:
                "execution-spec-2",

            proposal:
                createProposal(),
        },
    ]

    assert.throws(
        () =>
            assembleContentExecutionSpecs(
                duplicateChannel,
            ),

        /Duplicate execution channel/,
    )

    const duplicateId =
        createValidInput()

    duplicateId.specs = [
        {
            id:
                "execution-spec-1",

            proposal:
                createProposal({
                    channel:
                        "instagram",
                }),
        },

        {
            id:
                "execution-spec-1",

            proposal:
                createProposal({
                    channel:
                        "facebook",
                }),
        },
    ]

    assert.throws(
        () =>
            assembleContentExecutionSpecs(
                duplicateId,
            ),

        /Duplicate ContentExecutionSpecId/,
    )
})

test("content execution spec assembly rejects ineligible channel and mode", () => {
    const badChannel =
        createValidInput()

    badChannel.eligibleChannels = [
        "facebook",
    ]

    assert.throws(
        () =>
            assembleContentExecutionSpecs(
                badChannel,
            ),

        /Execution channel is not eligible/,
    )

    const badMode =
        createValidInput()

    badMode.eligibleContentModes = [
        "social.trustBuilder",
    ]

    assert.throws(
        () =>
            assembleContentExecutionSpecs(
                badMode,
            ),

        /Content mode is not eligible/,
    )
})

test("content execution spec assembly enforces canonical channel policy", () => {
    const input =
        createValidInput()

    input.specs = [
        {
            id:
                "execution-spec-1",

            proposal:
                createProposal({
                    format:
                        "unsupported-format",
                }),
        },
    ]

    assert.throws(
        () =>
            assembleContentExecutionSpecs(
                input,
            ),

        /is not supported by channel/,
    )
})

test("content execution spec assembly rejects invalid execution vocabulary", () => {
    const badDepth =
        createValidInput()

    badDepth.specs = [
        {
            id:
                "execution-spec-1",

            proposal:
                createProposal({
                    depth:
                        "very-deep",
                }),
        },
    ]

    assert.throws(
        () =>
            assembleContentExecutionSpecs(
                badDepth,
            ),

        /Invalid Content Execution depth/,
    )

    const badVisualDependency =
        createValidInput()

    badVisualDependency.specs = [
        {
            id:
                "execution-spec-1",

            proposal:
                createProposal({
                    visualDependency:
                        "mandatory",
                }),
        },
    ]

    assert.throws(
        () =>
            assembleContentExecutionSpecs(
                badVisualDependency,
            ),

        /Invalid Content Execution visual dependency/,
    )
})

test("content execution spec assembly requires useful execution guidance", () => {
    const emptyGuidance =
        createValidInput()

    emptyGuidance.specs = [
        {
            id:
                "execution-spec-1",

            proposal:
                createProposal({
                    executionGuidance: [],
                }),
        },
    ]

    assert.throws(
        () =>
            assembleContentExecutionSpecs(
                emptyGuidance,
            ),

        /must contain execution guidance/,
    )

    const blankGuidance =
        createValidInput()

    blankGuidance.specs = [
        {
            id:
                "execution-spec-1",

            proposal:
                createProposal({
                    executionGuidance: [
                        "   ",
                    ],
                }),
        },
    ]

    assert.throws(
        () =>
            assembleContentExecutionSpecs(
                blankGuidance,
            ),

        /executionGuidance must be a non-empty string/,
    )
})