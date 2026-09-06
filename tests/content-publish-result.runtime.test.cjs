const assert = require("node:assert/strict")
const test = require("node:test")

const {
    assembleSocialContentPublishResult,
} = require(
    "../dist/blueprints/social/index.js",
)

function createAttempt(
    overrides = {},
) {
    return {
        id:
            "publish-attempt-1",

        idempotencyKey:
            "social-publish:v1|schedule=schedule-1|draft=draft-2|version=2|account=publishing-account-1",

        contentId:
            "content-1",

        draftId:
            "draft-2",

        draftVersion:
            2,

        scheduleId:
            "schedule-1",

        scheduleRevision:
            1,

        publishingAccountId:
            "publishing-account-1",

        channel:
            "instagram",

        publishAt:
            "2026-09-08T10:00:00+04:00",

        attemptedAt:
            "2026-09-08T10:00:01+04:00",
        attemptNumber:
            1,

        ...overrides,
    }
}

function createInput(
    overrides = {},
) {
    return {
        id:
            "publish-result-1",

        attempt:
            createAttempt(),

        outcome: {
            status:
                "published",

            providerPublicationRef:
                "provider-post-123",

            publishedAt:
                "2026-09-08T10:00:02+04:00",
        },

        recordedAt:
            "2026-09-08T10:00:03+04:00",

        ...overrides,
    }
}

// -----------------------------------------------------------------------------
// Published
// -----------------------------------------------------------------------------

test("published result preserves exact attempt lineage", () => {
    const result =
        assembleSocialContentPublishResult(
            createInput(),
        )

    assert.deepEqual(
        result,
        {
            id:
                "publish-result-1",

            attemptId:
                "publish-attempt-1",

            idempotencyKey:
                "social-publish:v1|schedule=schedule-1|draft=draft-2|version=2|account=publishing-account-1",

            contentId:
                "content-1",

            draftId:
                "draft-2",

            draftVersion:
                2,

            scheduleId:
                "schedule-1",

            scheduleRevision:
                1,

            publishingAccountId:
                "publishing-account-1",

            channel:
                "instagram",

            recordedAt:
                "2026-09-08T10:00:03+04:00",

            status:
                "published",

            providerPublicationRef:
                "provider-post-123",

            publishedAt:
                "2026-09-08T10:00:02+04:00",
        },
    )
})

test("published provider reference is trimmed", () => {
    const result =
        assembleSocialContentPublishResult(
            createInput({
                outcome: {
                    status:
                        "published",

                    providerPublicationRef:
                        "  provider-post-123  ",

                    publishedAt:
                        "2026-09-08T10:00:02+04:00",
                },
            }),
        )

    assert.equal(
        result.providerPublicationRef,
        "provider-post-123",
    )
})

test("published result rejects blank provider publication reference", () => {
    assert.throws(
        () =>
            assembleSocialContentPublishResult(
                createInput({
                    outcome: {
                        status:
                            "published",

                        providerPublicationRef:
                            "   ",

                        publishedAt:
                            "2026-09-08T10:00:02+04:00",
                    },
                }),
            ),

        /providerPublicationRef must not be blank/,
    )
})

test("publishedAt may equal attemptedAt", () => {
    const result =
        assembleSocialContentPublishResult(
            createInput({
                outcome: {
                    status:
                        "published",

                    providerPublicationRef:
                        "provider-post-123",

                    publishedAt:
                        "2026-09-08T10:00:01+04:00",
                },
            }),
        )

    assert.equal(
        result.status,
        "published",
    )
})

test("publishedAt may equal recordedAt", () => {
    const result =
        assembleSocialContentPublishResult(
            createInput({
                outcome: {
                    status:
                        "published",

                    providerPublicationRef:
                        "provider-post-123",

                    publishedAt:
                        "2026-09-08T10:00:03+04:00",
                },
            }),
        )

    assert.equal(
        result.status,
        "published",
    )
})

test("publishedAt cannot predate publish attempt", () => {
    assert.throws(
        () =>
            assembleSocialContentPublishResult(
                createInput({
                    outcome: {
                        status:
                            "published",

                        providerPublicationRef:
                            "provider-post-123",

                        publishedAt:
                            "2026-09-08T10:00:00+04:00",
                    },
                }),
            ),

        /publishedAt cannot predate the publish attempt/,
    )
})

test("publishedAt cannot be later than recordedAt", () => {
    assert.throws(
        () =>
            assembleSocialContentPublishResult(
                createInput({
                    outcome: {
                        status:
                            "published",

                        providerPublicationRef:
                            "provider-post-123",

                        publishedAt:
                            "2026-09-08T10:00:04+04:00",
                    },
                }),
            ),

        /publishedAt cannot be later than recordedAt/,
    )
})

// -----------------------------------------------------------------------------
// Retryable failure
// -----------------------------------------------------------------------------

test("retryable failure explicitly preserves retryable status", () => {
    const result =
        assembleSocialContentPublishResult(
            createInput({
                outcome: {
                    status:
                        "retryableFailure",

                    errorCode:
                        "RATE_LIMIT",

                    message:
                        "  Provider rate limit reached.  ",

                    retryAfter:
                        "2026-09-08T10:05:00+04:00",
                },
            }),
        )

    assert.deepEqual(
        result,
        {
            id:
                "publish-result-1",

            attemptId:
                "publish-attempt-1",

            idempotencyKey:
                "social-publish:v1|schedule=schedule-1|draft=draft-2|version=2|account=publishing-account-1",

            contentId:
                "content-1",

            draftId:
                "draft-2",

            draftVersion:
                2,

            scheduleId:
                "schedule-1",

            scheduleRevision:
                1,

            publishingAccountId:
                "publishing-account-1",

            channel:
                "instagram",

            recordedAt:
                "2026-09-08T10:00:03+04:00",

            status:
                "retryableFailure",

            errorCode:
                "RATE_LIMIT",

            message:
                "Provider rate limit reached.",

            retryAfter:
                "2026-09-08T10:05:00+04:00",
        },
    )
})

test("retryable failure may omit retryAfter", () => {
    const result =
        assembleSocialContentPublishResult(
            createInput({
                outcome: {
                    status:
                        "retryableFailure",

                    errorCode:
                        "TEMPORARY_PROVIDER_ERROR",
                },
            }),
        )

    assert.equal(
        result.status,
        "retryableFailure",
    )

    assert.equal(
        Object.prototype.hasOwnProperty.call(
            result,
            "retryAfter",
        ),
        false,
    )
})

test("retryAfter must be later than recordedAt", () => {
    assert.throws(
        () =>
            assembleSocialContentPublishResult(
                createInput({
                    outcome: {
                        status:
                            "retryableFailure",

                        errorCode:
                            "RATE_LIMIT",

                        retryAfter:
                            "2026-09-08T10:00:03+04:00",
                    },
                }),
            ),

        /retryAfter must be later than recordedAt/,
    )
})

// -----------------------------------------------------------------------------
// Permanent failure
// -----------------------------------------------------------------------------

test("permanent failure remains permanent failure", () => {
    const result =
        assembleSocialContentPublishResult(
            createInput({
                outcome: {
                    status:
                        "permanentFailure",

                    errorCode:
                        "PERMISSION_DENIED",

                    message:
                        "  Account cannot publish.  ",
                },
            }),
        )

    assert.deepEqual(
        {
            status:
                result.status,

            errorCode:
                result.errorCode,

            message:
                result.message,
        },
        {
            status:
                "permanentFailure",

            errorCode:
                "PERMISSION_DENIED",

            message:
                "Account cannot publish.",
        },
    )
})

// -----------------------------------------------------------------------------
// Unknown outcome
// -----------------------------------------------------------------------------

test("unknown outcome remains distinct from retryable failure", () => {
    const result =
        assembleSocialContentPublishResult(
            createInput({
                outcome: {
                    status:
                        "unknownOutcome",

                    errorCode:
                        "CONNECTION_LOST_AFTER_SEND",

                    message:
                        "Response was not received.",
                },
            }),
        )

    assert.equal(
        result.status,
        "unknownOutcome",
    )

    assert.notEqual(
        result.status,
        "retryableFailure",
    )
})

test("unknown outcome preserves same idempotency key as attempt", () => {
    const attempt =
        createAttempt()

    const result =
        assembleSocialContentPublishResult({
            id:
                "publish-result-1",

            attempt,

            outcome: {
                status:
                    "unknownOutcome",

                errorCode:
                    "TIMEOUT_AFTER_REQUEST",
            },

            recordedAt:
                "2026-09-08T10:00:03+04:00",
        })

    assert.equal(
        result.idempotencyKey,
        attempt.idempotencyKey,
    )
})

// -----------------------------------------------------------------------------
// Text normalization
// -----------------------------------------------------------------------------

for (
    const status of [
        "retryableFailure",
        "permanentFailure",
        "unknownOutcome",
    ]
) {
    test(`${status} rejects blank errorCode`, () => {
        assert.throws(
            () =>
                assembleSocialContentPublishResult(
                    createInput({
                        outcome: {
                            status,

                            errorCode:
                                "   ",
                        },
                    }),
                ),

            /errorCode must not be blank/,
        )
    })
}

test("blank optional failure message is omitted", () => {
    const result =
        assembleSocialContentPublishResult(
            createInput({
                outcome: {
                    status:
                        "unknownOutcome",

                    errorCode:
                        "TIMEOUT",

                    message:
                        "   ",
                },
            }),
        )

    assert.equal(
        Object.prototype.hasOwnProperty.call(
            result,
            "message",
        ),
        false,
    )
})

// -----------------------------------------------------------------------------
// Result chronology
// -----------------------------------------------------------------------------

test("publish result cannot be recorded before attempt", () => {
    assert.throws(
        () =>
            assembleSocialContentPublishResult(
                createInput({
                    recordedAt:
                        "2026-09-08T10:00:00+04:00",
                }),
            ),

        /Publish result cannot be recorded before its attempt/,
    )
})

test("recordedAt may equal attemptedAt", () => {
    const result =
        assembleSocialContentPublishResult(
            createInput({
                outcome: {
                    status:
                        "permanentFailure",

                    errorCode:
                        "IMMEDIATE_REJECTION",
                },

                recordedAt:
                    "2026-09-08T10:00:01+04:00",
            }),
        )

    assert.equal(
        result.recordedAt,
        "2026-09-08T10:00:01+04:00",
    )
})

test("result chronology compares absolute instants across offsets", () => {
    const result =
        assembleSocialContentPublishResult(
            createInput({
                attempt:
                    createAttempt({
                        attemptedAt:
                            "2026-09-08T06:00:01Z",
                    }),

                outcome: {
                    status:
                        "published",

                    providerPublicationRef:
                        "provider-post-123",

                    publishedAt:
                        "2026-09-08T10:00:02+04:00",
                },

                recordedAt:
                    "2026-09-08T06:00:03Z",
            }),
        )

    assert.equal(
        result.status,
        "published",
    )
})

// -----------------------------------------------------------------------------
// Absolute timestamp validation
// -----------------------------------------------------------------------------

test("recordedAt must be absolute ISO date-time", () => {
    assert.throws(
        () =>
            assembleSocialContentPublishResult(
                createInput({
                    recordedAt:
                        "2026-09-08T10:00:03",
                }),
            ),

        /recordedAt must be a valid absolute ISO date-time/,
    )
})

test("attemptedAt must be absolute ISO date-time", () => {
    assert.throws(
        () =>
            assembleSocialContentPublishResult(
                createInput({
                    attempt:
                        createAttempt({
                            attemptedAt:
                                "2026-09-08T10:00:01",
                        }),
                }),
            ),

        /attemptedAt must be a valid absolute ISO date-time/,
    )
})

test("publishedAt must be absolute ISO date-time", () => {
    assert.throws(
        () =>
            assembleSocialContentPublishResult(
                createInput({
                    outcome: {
                        status:
                            "published",

                        providerPublicationRef:
                            "provider-post-123",

                        publishedAt:
                            "2026-09-08T10:00:02",
                    },
                }),
            ),

        /publishedAt must be a valid absolute ISO date-time/,
    )
})

test("retryAfter must be absolute ISO date-time", () => {
    assert.throws(
        () =>
            assembleSocialContentPublishResult(
                createInput({
                    outcome: {
                        status:
                            "retryableFailure",

                        errorCode:
                            "RATE_LIMIT",

                        retryAfter:
                            "2026-09-08T10:05:00",
                    },
                }),
            ),

        /retryAfter must be a valid absolute ISO date-time/,
    )
})