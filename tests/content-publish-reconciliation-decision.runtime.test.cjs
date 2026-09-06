const assert = require("node:assert/strict")
const test = require("node:test")

const {
    resolveSocialContentPublishReconciliationDecision,
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

function createReconciliation(
    overrides = {},
) {
    return {
        id:
            "reconciliation-1",

        unknownResultId:
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

        checkedAt:
            "2026-09-08T10:05:00+04:00",

        status:
            "confirmedAbsent",

        ...overrides,
    }
}

function createInput(
    overrides = {},
) {
    return {
        attempt:
            createAttempt(),

        reconciliation:
            createReconciliation(),

        policy: {
            maxAttempts:
                3,
        },

        ...overrides,
    }
}

// -----------------------------------------------------------------------------
// publicationFound
// -----------------------------------------------------------------------------

test("publicationFound completes publication flow", () => {
    const decision =
        resolveSocialContentPublishReconciliationDecision(
            createInput({
                reconciliation:
                    createReconciliation({
                        status:
                            "publicationFound",

                        providerPublicationRef:
                            "provider-post-123",

                        publishedAt:
                            "2026-09-08T10:00:02+04:00",
                    }),
            }),
        )

    assert.deepEqual(
        decision,
        {
            decision:
                "done",
        },
    )
})

// -----------------------------------------------------------------------------
// confirmedAbsent
// -----------------------------------------------------------------------------

test("confirmedAbsent allows retry while budget remains", () => {
    const decision =
        resolveSocialContentPublishReconciliationDecision(
            createInput(),
        )

    assert.deepEqual(
        decision,
        {
            decision:
                "retryAllowed",

            nextAttemptNumber:
                2,
        },
    )
})

test("confirmedAbsent on second attempt may retry into third", () => {
    const decision =
        resolveSocialContentPublishReconciliationDecision(
            createInput({
                attempt:
                    createAttempt({
                        attemptNumber:
                            2,
                    }),
            }),
        )

    assert.deepEqual(
        decision,
        {
            decision:
                "retryAllowed",

            nextAttemptNumber:
                3,
        },
    )
})

test("confirmedAbsent exhausts retry budget at maxAttempts", () => {
    const decision =
        resolveSocialContentPublishReconciliationDecision(
            createInput({
                attempt:
                    createAttempt({
                        attemptNumber:
                            3,
                    }),
            }),
        )

    assert.deepEqual(
        decision,
        {
            decision:
                "retryExhausted",
        },
    )
})

test("attempt beyond maxAttempts remains exhausted", () => {
    const decision =
        resolveSocialContentPublishReconciliationDecision(
            createInput({
                attempt:
                    createAttempt({
                        attemptNumber:
                            4,
                    }),
            }),
        )

    assert.deepEqual(
        decision,
        {
            decision:
                "retryExhausted",
        },
    )
})

// -----------------------------------------------------------------------------
// inconclusive
// -----------------------------------------------------------------------------

test("inconclusive reconciliation requires review and never retries automatically", () => {
    const decision =
        resolveSocialContentPublishReconciliationDecision(
            createInput({
                reconciliation:
                    createReconciliation({
                        status:
                            "inconclusive",

                        reasonCode:
                            "PROVIDER_LOOKUP_UNAVAILABLE",
                    }),
            }),
        )

    assert.deepEqual(
        decision,
        {
            decision:
                "requiresReview",
        },
    )
})

// -----------------------------------------------------------------------------
// Attempt validation
// -----------------------------------------------------------------------------

test("attempt number must be a positive integer", () => {
    assert.throws(
        () =>
            resolveSocialContentPublishReconciliationDecision(
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

test("attempt number rejects non-integer values", () => {
    assert.throws(
        () =>
            resolveSocialContentPublishReconciliationDecision(
                createInput({
                    attempt:
                        createAttempt({
                            attemptNumber:
                                1.5,
                        }),
                }),
            ),

        /Publish attempt number must be a positive integer/,
    )
})

// -----------------------------------------------------------------------------
// Policy validation
// -----------------------------------------------------------------------------

test("retry policy requires positive maxAttempts", () => {
    assert.throws(
        () =>
            resolveSocialContentPublishReconciliationDecision(
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
            resolveSocialContentPublishReconciliationDecision(
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

// -----------------------------------------------------------------------------
// Provenance
// -----------------------------------------------------------------------------

test("reconciliation must belong to supplied attempt", () => {
    assert.throws(
        () =>
            resolveSocialContentPublishReconciliationDecision(
                createInput({
                    reconciliation:
                        createReconciliation({
                            attemptId:
                                "publish-attempt-999",
                        }),
                }),
            ),

        /Publish reconciliation must belong to the supplied attempt/,
    )
})

test("reconciliation must preserve idempotency key", () => {
    assert.throws(
        () =>
            resolveSocialContentPublishReconciliationDecision(
                createInput({
                    reconciliation:
                        createReconciliation({
                            idempotencyKey:
                                "different-key",
                        }),
                }),
            ),

        /Publish reconciliation must preserve attempt idempotency key/,
    )
})

test("reconciliation must preserve ContentId lineage", () => {
    assert.throws(
        () =>
            resolveSocialContentPublishReconciliationDecision(
                createInput({
                    reconciliation:
                        createReconciliation({
                            contentId:
                                "content-999",
                        }),
                }),
            ),

        /Publish reconciliation must preserve attempt publication lineage/,
    )
})

test("reconciliation must preserve draft lineage", () => {
    assert.throws(
        () =>
            resolveSocialContentPublishReconciliationDecision(
                createInput({
                    reconciliation:
                        createReconciliation({
                            draftId:
                                "draft-999",
                        }),
                }),
            ),

        /Publish reconciliation must preserve attempt publication lineage/,
    )
})

test("reconciliation must preserve draft version", () => {
    assert.throws(
        () =>
            resolveSocialContentPublishReconciliationDecision(
                createInput({
                    reconciliation:
                        createReconciliation({
                            draftVersion:
                                3,
                        }),
                }),
            ),

        /Publish reconciliation must preserve attempt publication lineage/,
    )
})

test("reconciliation must preserve schedule lineage", () => {
    assert.throws(
        () =>
            resolveSocialContentPublishReconciliationDecision(
                createInput({
                    reconciliation:
                        createReconciliation({
                            scheduleId:
                                "schedule-999",
                        }),
                }),
            ),

        /Publish reconciliation must preserve attempt publication lineage/,
    )
})

test("reconciliation must preserve schedule revision", () => {
    assert.throws(
        () =>
            resolveSocialContentPublishReconciliationDecision(
                createInput({
                    reconciliation:
                        createReconciliation({
                            scheduleRevision:
                                2,
                        }),
                }),
            ),

        /Publish reconciliation must preserve attempt publication lineage/,
    )
})

test("reconciliation must preserve publishing account", () => {
    assert.throws(
        () =>
            resolveSocialContentPublishReconciliationDecision(
                createInput({
                    reconciliation:
                        createReconciliation({
                            publishingAccountId:
                                "publishing-account-999",
                        }),
                }),
            ),

        /Publish reconciliation must preserve attempt publication lineage/,
    )
})

test("reconciliation must preserve channel", () => {
    assert.throws(
        () =>
            resolveSocialContentPublishReconciliationDecision(
                createInput({
                    reconciliation:
                        createReconciliation({
                            channel:
                                "facebook",
                        }),
                }),
            ),

        /Publish reconciliation must preserve attempt publication lineage/,
    )
})