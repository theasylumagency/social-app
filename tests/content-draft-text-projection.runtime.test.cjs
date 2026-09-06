const assert = require("node:assert/strict")
const test = require("node:test")

const {
    projectSocialContentDraftText,
} = require(
    "../dist/blueprints/social/index.js",
)

function createBaseDraft(
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
            "Carousel caption.",

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

test("content draft text projection preserves carousel public copy and provenance", () => {
    const projection =
        projectSocialContentDraftText(
            createBaseDraft(),
        )

    assert.equal(
        projection.text,
        [
            "Carousel caption.",
            "First heading",
            "First body.",
            "Second body.",
        ].join("\n\n"),
    )

    assert.deepEqual(
        projection.segments,
        [
            {
                kind:
                    "caption",

                text:
                    "Carousel caption.",
            },

            {
                kind:
                    "frameHeading",

                frameOrder:
                    1,

                text:
                    "First heading",
            },

            {
                kind:
                    "frameBody",

                frameOrder:
                    1,

                text:
                    "First body.",
            },

            {
                kind:
                    "frameBody",

                frameOrder:
                    2,

                text:
                    "Second body.",
            },
        ],
    )
})

test("content draft text projection handles static post", () => {
    const projection =
        projectSocialContentDraftText(
            createBaseDraft({
                format:
                    "staticPost",

                text:
                    "  Final static copy.  ",

                caption:
                    undefined,

                frames:
                    undefined,
            }),
        )

    assert.equal(
        projection.text,
        "Final static copy.",
    )

    assert.deepEqual(
        projection.segments,
        [
            {
                kind:
                    "staticText",

                text:
                    "Final static copy.",
            },
        ],
    )
})

test("content draft text projection handles story frames", () => {
    const projection =
        projectSocialContentDraftText(
            createBaseDraft({
                format:
                    "story",

                caption:
                    undefined,

                frames: [
                    {
                        order:
                            1,

                        heading:
                            "Story heading",

                        body:
                            "Story body.",
                    },
                ],
            }),
        )

    assert.equal(
        projection.text,
        [
            "Story heading",
            "Story body.",
        ].join("\n\n"),
    )

    assert.deepEqual(
        projection.segments,
        [
            {
                kind:
                    "frameHeading",

                frameOrder:
                    1,

                text:
                    "Story heading",
            },

            {
                kind:
                    "frameBody",

                frameOrder:
                    1,

                text:
                    "Story body.",
            },
        ],
    )
})

test("content draft text projection handles reel copy", () => {
    const projection =
        projectSocialContentDraftText(
            createBaseDraft({
                format:
                    "reel",

                caption:
                    "  Reel caption.  ",

                frames:
                    undefined,

                script:
                    "  Spoken script.  ",

                onScreenText: [
                    "  First overlay  ",
                    "  Second overlay  ",
                ],
            }),
        )

    assert.equal(
        projection.text,
        [
            "Reel caption.",
            "Spoken script.",
            "First overlay",
            "Second overlay",
        ].join("\n\n"),
    )

    assert.deepEqual(
        projection.segments,
        [
            {
                kind:
                    "caption",

                text:
                    "Reel caption.",
            },

            {
                kind:
                    "script",

                text:
                    "Spoken script.",
            },

            {
                kind:
                    "onScreenText",

                itemOrder:
                    1,

                text:
                    "First overlay",
            },

            {
                kind:
                    "onScreenText",

                itemOrder:
                    2,

                text:
                    "Second overlay",
            },
        ],
    )
})

test("content draft text projection rejects non-canonical frame order", () => {
    const draft =
        createBaseDraft({
            frames: [
                {
                    order:
                        2,

                    heading:
                        "Wrong order",

                    body:
                        "Body.",
                },
            ],
        })

    assert.throws(
        () =>
            projectSocialContentDraftText(
                draft,
            ),

        /expected 1, received 2/,
    )
})

test("content draft text projection rejects blank canonical copy", () => {
    assert.throws(
        () =>
            projectSocialContentDraftText(
                createBaseDraft({
                    format:
                        "staticPost",

                    text:
                        "   ",

                    caption:
                        undefined,

                    frames:
                        undefined,
                }),
            ),

        /Static post draft text must not be blank/,
    )

    assert.throws(
        () =>
            projectSocialContentDraftText(
                createBaseDraft({
                    caption:
                        "   ",
                }),
            ),

        /Content draft caption must not be blank/,
    )
})

test("content draft text projection rejects blank frame content", () => {
    assert.throws(
        () =>
            projectSocialContentDraftText(
                createBaseDraft({
                    frames: [
                        {
                            order:
                                1,

                            heading:
                                "   ",

                            body:
                                "Body.",
                        },
                    ],
                }),
            ),

        /heading must not be blank/,
    )

    assert.throws(
        () =>
            projectSocialContentDraftText(
                createBaseDraft({
                    frames: [
                        {
                            order:
                                1,

                            body:
                                "   ",
                        },
                    ],
                }),
            ),

        /body must not be blank/,
    )
})

test("content draft text projection rejects blank reel copy", () => {
    assert.throws(
        () =>
            projectSocialContentDraftText(
                createBaseDraft({
                    format:
                        "reel",

                    caption:
                        undefined,

                    frames:
                        undefined,

                    script:
                        "   ",

                    onScreenText: [],
                }),
            ),

        /Reel draft script must not be blank/,
    )

    assert.throws(
        () =>
            projectSocialContentDraftText(
                createBaseDraft({
                    format:
                        "reel",

                    caption:
                        undefined,

                    frames:
                        undefined,

                    script:
                        "Valid script.",

                    onScreenText: [
                        "   ",
                    ],
                }),
            ),

        /on-screen text item 1 must not be blank/,
    )
})