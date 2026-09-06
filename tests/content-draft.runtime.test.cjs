const assert = require("node:assert/strict")
const test = require("node:test")

const {
    assembleSocialContentDraft,
} = require(
    "../dist/blueprints/social/index.js",
)

function createBaseInput(
    overrides = {},
) {
    return {
        id:
            "draft-1",

        contentId:
            "content-1",

        contentBriefId:
            "content-brief-1",

        contentExecutionSpecId:
            "execution-spec-1",

        format:
            "carousel",

        version:
            1,

        locale:
            "ka",

        proposal: {
            text:
                null,

            caption:
                "  Caption text.  ",

            frames: [
                {
                    heading:
                        "  First heading  ",

                    body:
                        "  First body.  ",
                },

                {
                    heading:
                        null,

                    body:
                        "  Second body.  ",
                },
            ],

            script:
                null,

            onScreenText: [],
        },

        createdAt:
            "2026-09-06T10:45:00+04:00",

        ...overrides,
    }
}

test("content draft assembly creates canonical carousel and assigns frame order", () => {
    const draft =
        assembleSocialContentDraft(
            createBaseInput(),
        )

    assert.equal(
        draft.format,
        "carousel",
    )

    assert.equal(
        draft.id,
        "draft-1",
    )

    assert.equal(
        draft.contentId,
        "content-1",
    )

    assert.equal(
        draft.contentBriefId,
        "content-brief-1",
    )

    assert.equal(
        draft.contentExecutionSpecId,
        "execution-spec-1",
    )

    assert.equal(
        draft.version,
        1,
    )

    assert.equal(
        draft.locale,
        "ka",
    )

    assert.equal(
        draft.caption,
        "Caption text.",
    )

    assert.deepEqual(
        draft.frames,
        [
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
    )
})

test("content draft assembly creates canonical static post", () => {
    const draft =
        assembleSocialContentDraft(
            createBaseInput({
                format:
                    "staticPost",

                proposal: {
                    text:
                        "  Final post copy.  ",

                    caption:
                        null,

                    frames: [],

                    script:
                        null,

                    onScreenText: [],
                },
            }),
        )

    assert.deepEqual(
        draft,
        {
            id:
                "draft-1",

            contentId:
                "content-1",

            contentBriefId:
                "content-brief-1",

            contentExecutionSpecId:
                "execution-spec-1",

            version:
                1,

            locale:
                "ka",

            format:
                "staticPost",

            text:
                "Final post copy.",

            createdAt:
                "2026-09-06T10:45:00+04:00",
        },
    )
})

test("content draft assembly creates canonical story", () => {
    const draft =
        assembleSocialContentDraft(
            createBaseInput({
                format:
                    "story",

                proposal: {
                    text:
                        null,

                    caption:
                        null,

                    frames: [
                        {
                            heading:
                                null,

                            body:
                                "  Story frame.  ",
                        },
                    ],

                    script:
                        null,

                    onScreenText: [],
                },
            }),
        )

    assert.equal(
        draft.format,
        "story",
    )

    assert.deepEqual(
        draft.frames,
        [
            {
                order:
                    1,

                body:
                    "Story frame.",
            },
        ],
    )
})

test("content draft assembly creates canonical reel", () => {
    const draft =
        assembleSocialContentDraft(
            createBaseInput({
                format:
                    "reel",

                proposal: {
                    text:
                        null,

                    caption:
                        "  Reel caption.  ",

                    frames: [],

                    script:
                        "  Spoken reel script.  ",

                    onScreenText: [
                        "  First overlay  ",
                        "  Second overlay  ",
                    ],
                },
            }),
        )

    assert.equal(
        draft.format,
        "reel",
    )

    assert.equal(
        draft.caption,
        "Reel caption.",
    )

    assert.equal(
        draft.script,
        "Spoken reel script.",
    )

    assert.deepEqual(
        draft.onScreenText,
        [
            "First overlay",
            "Second overlay",
        ],
    )
})

test("content draft assembly rejects invalid version", () => {
    assert.throws(
        () =>
            assembleSocialContentDraft(
                createBaseInput({
                    version:
                        0,
                }),
            ),

        /version must be a positive integer/,
    )

    assert.throws(
        () =>
            assembleSocialContentDraft(
                createBaseInput({
                    version:
                        1.5,
                }),
            ),

        /version must be a positive integer/,
    )
})

test("content draft assembly rejects model authority fields", () => {
    const input =
        createBaseInput()

    input.proposal = {
        ...input.proposal,

        format:
            "reel",
    }

    assert.throws(
        () =>
            assembleSocialContentDraft(
                input,
            ),

        /contains unsupported field: format/,
    )
})

test("content draft assembly rejects frame authority fields", () => {
    const input =
        createBaseInput()

    input.proposal = {
        ...input.proposal,

        frames: [
            {
                order:
                    99,

                heading:
                    "Heading",

                body:
                    "Body",
            },

            {
                heading:
                    null,

                body:
                    "Second body",
            },
        ],
    }

    assert.throws(
        () =>
            assembleSocialContentDraft(
                input,
            ),

        /Content draft frame contains unsupported field: order/,
    )
})

test("content draft assembly rejects blank copy fields", () => {
    const blankFrameBody =
        createBaseInput()

    blankFrameBody.proposal = {
        ...blankFrameBody.proposal,

        frames: [
            {
                heading:
                    "Heading",

                body:
                    "   ",
            },

            {
                heading:
                    null,

                body:
                    "Second body",
            },
        ],
    }

    assert.throws(
        () =>
            assembleSocialContentDraft(
                blankFrameBody,
            ),

        /frame body must be a non-empty string/,
    )

    const blankOnScreenText =
        createBaseInput({
            format:
                "reel",

            proposal: {
                text:
                    null,

                caption:
                    null,

                frames: [],

                script:
                    "Valid script.",

                onScreenText: [
                    "   ",
                ],
            },
        })

    assert.throws(
        () =>
            assembleSocialContentDraft(
                blankOnScreenText,
            ),

        /onScreenText item must be a non-empty string/,
    )
})

test("content draft assembly enforces carousel transport shape", () => {
    const input =
        createBaseInput()

    input.proposal = {
        text:
            "Not allowed.",

        caption:
            null,

        frames: [
            {
                heading:
                    null,

                body:
                    "Only one frame.",
            },
        ],

        script:
            "Not allowed.",

        onScreenText: [
            "Not allowed.",
        ],
    }

    assert.throws(
        () =>
            assembleSocialContentDraft(
                input,
            ),

        /carousel text must be null/,
    )
})

test("content draft assembly enforces static post transport shape", () => {
    const input =
        createBaseInput({
            format:
                "staticPost",

            proposal: {
                text:
                    null,

                caption:
                    "Not allowed.",

                frames: [],

                script:
                    null,

                onScreenText: [],
            },
        })

    assert.throws(
        () =>
            assembleSocialContentDraft(
                input,
            ),

        /staticPost requires non-empty text/,
    )
})

test("content draft assembly enforces story transport shape", () => {
    const input =
        createBaseInput({
            format:
                "story",

            proposal: {
                text:
                    null,

                caption:
                    "Not allowed.",

                frames: [
                    {
                        heading:
                            null,

                        body:
                            "Story body.",
                    },
                ],

                script:
                    null,

                onScreenText: [],
            },
        })

    assert.throws(
        () =>
            assembleSocialContentDraft(
                input,
            ),

        /story caption must be null/,
    )
})

test("content draft assembly enforces reel transport shape", () => {
    const input =
        createBaseInput({
            format:
                "reel",

            proposal: {
                text:
                    null,

                caption:
                    null,

                frames: [],

                script:
                    null,

                onScreenText: [],
            },
        })

    assert.throws(
        () =>
            assembleSocialContentDraft(
                input,
            ),

        /reel requires non-empty script/,
    )
})