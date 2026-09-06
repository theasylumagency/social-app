const assert = require("node:assert/strict")
const test = require("node:test")

const {
    assembleRepairedSocialContentDraft,
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
            "Old caption.",

        frames: [
            {
                order:
                    1,

                heading:
                    "Old heading",

                body:
                    "Old body.",
            },

            {
                order:
                    2,

                body:
                    "Old second body.",
            },
        ],

        createdAt:
            "2026-09-06T10:45:00+04:00",

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
            "  New caption.  ",

        frames: [
            {
                heading:
                    "  New heading  ",

                body:
                    "  New body.  ",
            },

            {
                heading:
                    null,

                body:
                    "  New second body.  ",
            },
        ],

        script:
            null,

        onScreenText: [],

        ...overrides,
    }
}

test("repaired content draft preserves content lineage and increments version", () => {
    const previousDraft =
        createPreviousDraft()

    const repaired =
        assembleRepairedSocialContentDraft({
            id:
                "draft-2",

            previousDraft,

            proposal:
                createRepairProposal(),

            createdAt:
                "2026-09-06T11:00:00+04:00",
        })

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
})

test("repaired content draft uses canonical assembly for repaired copy", () => {
    const repaired =
        assembleRepairedSocialContentDraft({
            id:
                "draft-2",

            previousDraft:
                createPreviousDraft(),

            proposal:
                createRepairProposal(),

            createdAt:
                "2026-09-06T11:00:00+04:00",
        })

    assert.equal(
        repaired.caption,
        "New caption.",
    )

    assert.deepEqual(
        repaired.frames,
        [
            {
                order:
                    1,

                heading:
                    "New heading",

                body:
                    "New body.",
            },

            {
                order:
                    2,

                body:
                    "New second body.",
            },
        ],
    )
})

test("repaired content draft requires a new immutable draft ID", () => {
    assert.throws(
        () =>
            assembleRepairedSocialContentDraft({
                id:
                    "draft-1",

                previousDraft:
                    createPreviousDraft(),

                proposal:
                    createRepairProposal(),

                createdAt:
                    "2026-09-06T11:00:00+04:00",
            }),

        /must receive a new draft ID/,
    )
})

test("repaired content draft increments any valid previous version exactly once", () => {
    const repaired =
        assembleRepairedSocialContentDraft({
            id:
                "draft-8",

            previousDraft:
                createPreviousDraft({
                    id:
                        "draft-7",

                    version:
                        7,
                }),

            proposal:
                createRepairProposal(),

            createdAt:
                "2026-09-06T11:00:00+04:00",
        })

    assert.equal(
        repaired.version,
        8,
    )
})

test("repaired content draft rejects invalid previous version", () => {
    assert.throws(
        () =>
            assembleRepairedSocialContentDraft({
                id:
                    "draft-2",

                previousDraft:
                    createPreviousDraft({
                        version:
                            0,
                    }),

                proposal:
                    createRepairProposal(),

                createdAt:
                    "2026-09-06T11:00:00+04:00",
            }),

        /Previous content draft version must be a positive integer/,
    )
})

test("repaired content draft cannot change inherited format through proposal", () => {
    assert.throws(
        () =>
            assembleRepairedSocialContentDraft({
                id:
                    "draft-2",

                previousDraft:
                    createPreviousDraft(),

                proposal: {
                    ...createRepairProposal(),

                    format:
                        "reel",
                },

                createdAt:
                    "2026-09-06T11:00:00+04:00",
            }),

        /contains unsupported field: format/,
    )
})

test("repaired content draft enforces inherited format transport shape", () => {
    assert.throws(
        () =>
            assembleRepairedSocialContentDraft({
                id:
                    "draft-2",

                previousDraft:
                    createPreviousDraft(),

                proposal: {
                    text:
                        "Static copy.",

                    caption:
                        null,

                    frames: [],

                    script:
                        null,

                    onScreenText: [],
                },

                createdAt:
                    "2026-09-06T11:00:00+04:00",
            }),

        /carousel text must be null/,
    )
})

test("repaired content draft does not mutate previous draft", () => {
    const previousDraft =
        createPreviousDraft()

    const snapshot =
        structuredClone(
            previousDraft,
        )

    assembleRepairedSocialContentDraft({
        id:
            "draft-2",

        previousDraft,

        proposal:
            createRepairProposal(),

        createdAt:
            "2026-09-06T11:00:00+04:00",
    })

    assert.deepEqual(
        previousDraft,
        snapshot,
    )
})

test("repaired content draft preserves locale and execution provenance from previous draft", () => {
    const repaired =
        assembleRepairedSocialContentDraft({
            id:
                "draft-11",

            previousDraft:
                createPreviousDraft({
                    id:
                        "draft-10",

                    locale:
                        "en",

                    version:
                        10,
                }),

            proposal:
                createRepairProposal(),

            createdAt:
                "2026-09-06T11:00:00+04:00",
        })

    assert.equal(
        repaired.locale,
        "en",
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
        11,
    )
})