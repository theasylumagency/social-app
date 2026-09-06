const assert = require("node:assert/strict")
const test = require("node:test")

const {
    resolveSocialContentPublishRetryDecision,
} = require(
    "../dist/blueprints/social/index.js",
)

function createAttempt(
    overrides = {},
) {
    return {
        id:
            "publish-attempt-1",

        attemptNumber:
            1,

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

        ...overrides,
    }
}

function createResult(
    overrides = {},
) {
    return {
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
            "TEMPORARY_PROVIDER_ERROR",

        ...overrides,
    }
}

function createInput(
    overrides = {},
) {
    return {
        attempt:
            createAttempt(),

        result:
            createResult(),

        policy: {
            maxAttempts:
                3,
        },

        ...overrides,
    }
}

// -----------------------------------------------------------------------------
// Terminal outcomes
// -----------------------------------------------------------------------------

test("published result is done", () => {
    const result =
        resolveSocialContentPublishRetryDecision(
            createInput({
                result:
                    createResult({
                        status:
                            "published",

                        providerPublicationRef:
                            "provider-post-123",

                        publishedAt:
                            "2026-09-08T10:00:02+04:00",
                    }),
            }),
        )

    assert.deepEqual(
        result,
        {
            decision:
                "done",
        },
    )
})

test("permanent failure stops retry flow", () => {
    const result =
        resolveSocialContentPublishRetryDecision(
            createInput({
                result:
                    createResult({
                        status:
                            "permanentFailure",

                        errorCode:
                            "PERMISSION_DENIED",
                    }),
            }),
        )

    assert.deepEqual(
        result,
        {
            decision:
                "stop",
        },
    )
})

test("unknown outcome requires reconciliation and never becomes automatic retry", () => {
    const result =
        resolveSocialContentPublishRetryDecision(
            createInput({
                result:
                    createResult({
                        status:
                            "unknownOutcome",

                        errorCode:
                            "CONNECTION_LOST_AFTER_SEND",
                    }),
            }),
        )

    assert.deepEqual(
        result,
        {
            decision:
                "requiresReconciliation",
        },
    )
})

// -----------------------------------------------------------------------------
// Retryable failure
// -----------------------------------------------------------------------------

test("retryable failure allows next attempt while budget remains", () => {
    const result =
        resolveSocialContentPublishRetryDecision(
            createInput(),
        )

    assert.deepEqual(
        result,
        {
            decision:
                "retryAllowed",

            nextAttemptNumber:
                2,
        },
    )
})

test("retryable failure propagates provider retryAfter", () => {
    const result =
        resolveSocialContentPublishRetryDecision(
            createInput({
                result:
                    createResult({
                        retryAfter:
                            "2026-09-08T10:05:00+04:00",
                    }),
            }),
        )

    assert.deepEqual(
        result,
        {
            decision:
                "retryAllowed",

            nextAttemptNumber:
                2,

            retryAfter:
                "2026-09-08T10:05:00+04:00",
        },
    )
})

test("second attempt may retry into third when maxAttempts is three", () => {
    const result =
        resolveSocialContentPublishRetryDecision(
            createInput({
                attempt:
                    createAttempt({
                        attemptNumber:
                            2,
                    }),
            }),
        )

    assert.deepEqual(
        result,
        {
            decision:
                "retryAllowed",

            nextAttemptNumber:
                3,
        },
    )
})

test("retryable failure is exhausted when current attempt reaches maxAttempts", () => {
    const result =
        resolveSocialContentPublishRetryDecision(
            createInput({
                attempt:
                    createAttempt({
                        attemptNumber:
                            3,
                    }),
            }),
        )

    assert.deepEqual(
        result,
        {
            decision:
                "retryExhausted",
        },
    )
})

test("attempt beyond retry budget also resolves to exhausted", () => {
    const result =
        resolveSocialContentPublishRetryDecision(
            createInput({
                attempt:
                    createAttempt({
                        attemptNumber:
                            4,
                    }),
            }),
        )

    assert.deepEqual(
        result,
        {
            decision:
                "retryExhausted",
        },
    )
})

// -----------------------------------------------------------------------------
// Policy validation
// -----------------------------------------------------------------------------

test("retry policy requires positive maxAttempts", () => {
    assert.throws(
        () =>
            resolveSocialContentPublishRetryDecision(
                createInput({
                    policy: {
                        maxAttempts:
                            0,
                    },
                }),
            ),

        /Publish retry maxAttempts must be a positive integer/,
    )
})

test("retry policy rejects non-integer maxAttempts", () => {
    assert.throws(
        () =>
            resolveSocialContentPublishRetryDecision(
                createInput({
                    policy: {
                        maxAttempts:
                            2.5,
                    },
                }),
            ),

        /Publish retry maxAttempts must be a positive integer/,
    )
})

test("attempt number must be positive integer", () => {
    assert.throws(
        () =>
            resolveSocialContentPublishRetryDecision(
                createInput({
                    attempt:
                        createAttempt({
                            attemptNumber:
                                0,
                        }),
                }),
            ),

        /Publish attempt number must be a positive integer/,
    )
})

// -----------------------------------------------------------------------------
// Provenance
// -----------------------------------------------------------------------------

test("publish result must belong to supplied attempt", () => {
    assert.throws(
        () =>
            resolveSocialContentPublishRetryDecision(
                createInput({
                    result:
                        createResult({
                            attemptId:
                                "publish-attempt-999",
                        }),
                }),
            ),

        /Publish result must belong to the supplied attempt/,
    )
})

test("publish result must preserve idempotency key", () => {
    assert.throws(
        () =>
            resolveSocialContentPublishRetryDecision(
                createInput({
                    result:
                        createResult({
                            idempotencyKey:
                                "different-key",
                        }),
                }),
            ),

        /Publish result must preserve attempt idempotency key/,
    )
})

test("publish result must preserve ContentId lineage", () => {
    assert.throws(
        () =>
            resolveSocialContentPublishRetryDecision(
                createInput({
                    result:
                        createResult({
                            contentId:
                                "content-999",
                        }),
                }),
            ),

        /Publish result must preserve attempt publication lineage/,
    )
})

test("publish result must preserve draft lineage", () => {
    assert.throws(
        () =>
            resolveSocialContentPublishRetryDecision(
                createInput({
                    result:
                        createResult({
                            draftId:
                                "draft-999",
                        }),
                }),
            ),

        /Publish result must preserve attempt publication lineage/,
    )
})

test("publish result must preserve draft version", () => {
    assert.throws(
        () =>
            resolveSocialContentPublishRetryDecision(
                createInput({
                    result:
                        createResult({
                            draftVersion:
                                3,
                        }),
                }),
            ),

        /Publish result must preserve attempt publication lineage/,
    )
})

test("publish result must preserve schedule lineage", () => {
    assert.throws(
        () =>
            resolveSocialContentPublishRetryDecision(
                createInput({
                    result:
                        createResult({
                            scheduleId:
                                "schedule-999",
                        }),
                }),
            ),

        /Publish result must preserve attempt publication lineage/,
    )
})

test("publish result must preserve schedule revision", () => {
    assert.throws(
        () =>
            resolveSocialContentPublishRetryDecision(
                createInput({
                    result:
                        createResult({
                            scheduleRevision:
                                2,
                        }),
                }),
            ),

        /Publish result must preserve attempt publication lineage/,
    )
})

test("publish result must preserve publishing account", () => {
    assert.throws(
        () =>
            resolveSocialContentPublishRetryDecision(
                createInput({
                    result:
                        createResult({
                            publishingAccountId:
                                "publishing-account-999",
                        }),
                }),
            ),

        /Publish result must preserve attempt publication lineage/,
    )
})

test("publish result must preserve channel", () => {
    assert.throws(
        () =>
            resolveSocialContentPublishRetryDecision(
                createInput({
                    result:
                        createResult({
                            channel:
                                "facebook",
                        }),
                }),
            ),

        /Publish result must preserve attempt publication lineage/,
    )
})