const assert = require("node:assert/strict")
const test = require("node:test")

const {
    assembleSocialContentPublishReconciliation,
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

function createUnknownResult(
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
            "unknownOutcome",

        errorCode:
            "CONNECTION_LOST_AFTER_SEND",

        ...overrides,
    }
}

function createInput(
    overrides = {},
) {
    return {
        id:
            "reconciliation-1",

        attempt:
            createAttempt(),

        unknownResult:
            createUnknownResult(),

        outcome: {
            status:
                "publicationFound",

            providerPublicationRef:
                "provider-post-123",

            publishedAt:
                "2026-09-08T10:00:02+04:00",
        },

        checkedAt:
            "2026-09-08T10:05:00+04:00",

        ...overrides,
    }
}

// -----------------------------------------------------------------------------
// publicationFound
// -----------------------------------------------------------------------------

test("publicationFound creates canonical reconciliation with exact lineage", () => {
    const result =
        assembleSocialContentPublishReconciliation(
            createInput(),
        )

    assert.deepEqual(
        result,
        {
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
                "publicationFound",

            providerPublicationRef:
                "provider-post-123",

            publishedAt:
                "2026-09-08T10:00:02+04:00",
        },
    )
})

test("publicationFound trims provider publication reference", () => {
    const result =
        assembleSocialContentPublishReconciliation(
            createInput({
                outcome: {
                    status:
                        "publicationFound",

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

test("publicationFound rejects blank provider publication reference", () => {
    assert.throws(
        () =>
            assembleSocialContentPublishReconciliation(
                createInput({
                    outcome: {
                        status:
                            "publicationFound",

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

test("reconciled publishedAt cannot predate publish attempt", () => {
    assert.throws(
        () =>
            assembleSocialContentPublishReconciliation(
                createInput({
                    outcome: {
                        status:
                            "publicationFound",

                        providerPublicationRef:
                            "provider-post-123",

                        publishedAt:
                            "2026-09-08T10:00:00+04:00",
                    },
                }),
            ),

        /Reconciled publishedAt cannot predate the publish attempt/,
    )
})

test("reconciled publishedAt cannot be later than checkedAt", () => {
    assert.throws(
        () =>
            assembleSocialContentPublishReconciliation(
                createInput({
                    outcome: {
                        status:
                            "publicationFound",

                        providerPublicationRef:
                            "provider-post-123",

                        publishedAt:
                            "2026-09-08T10:06:00+04:00",
                    },
                }),
            ),

        /Reconciled publishedAt cannot be later than checkedAt/,
    )
})

// -----------------------------------------------------------------------------
// confirmedAbsent
// -----------------------------------------------------------------------------

test("confirmedAbsent remains a distinct positive reconciliation outcome", () => {
    const result =
        assembleSocialContentPublishReconciliation(
            createInput({
                outcome: {
                    status:
                        "confirmedAbsent",
                },
            }),
        )

    assert.deepEqual(
        {
            status:
                result.status,

            attemptId:
                result.attemptId,

            unknownResultId:
                result.unknownResultId,
        },
        {
            status:
                "confirmedAbsent",

            attemptId:
                "publish-attempt-1",

            unknownResultId:
                "publish-result-1",
        },
    )
})

// -----------------------------------------------------------------------------
// inconclusive
// -----------------------------------------------------------------------------

test("inconclusive remains distinct from confirmedAbsent", () => {
    const result =
        assembleSocialContentPublishReconciliation(
            createInput({
                outcome: {
                    status:
                        "inconclusive",

                    reasonCode:
                        "PROVIDER_LOOKUP_UNAVAILABLE",

                    message:
                        "Could not establish publication state.",
                },
            }),
        )

    assert.equal(
        result.status,
        "inconclusive",
    )

    assert.notEqual(
        result.status,
        "confirmedAbsent",
    )
})

test("inconclusive trims reasonCode and message", () => {
    const result =
        assembleSocialContentPublishReconciliation(
            createInput({
                outcome: {
                    status:
                        "inconclusive",

                    reasonCode:
                        "  LOOKUP_TIMEOUT  ",

                    message:
                        "  Provider lookup timed out.  ",
                },
            }),
        )

    assert.equal(
        result.reasonCode,
        "LOOKUP_TIMEOUT",
    )

    assert.equal(
        result.message,
        "Provider lookup timed out.",
    )
})

test("inconclusive rejects blank reasonCode", () => {
    assert.throws(
        () =>
            assembleSocialContentPublishReconciliation(
                createInput({
                    outcome: {
                        status:
                            "inconclusive",

                        reasonCode:
                            "   ",
                    },
                }),
            ),

        /reasonCode must not be blank/,
    )
})

test("blank inconclusive message is omitted", () => {
    const result =
        assembleSocialContentPublishReconciliation(
            createInput({
                outcome: {
                    status:
                        "inconclusive",

                    reasonCode:
                        "LOOKUP_TIMEOUT",

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
// Reconciliation requires unknown outcome
// -----------------------------------------------------------------------------

test("reconciliation rejects published result", () => {
    assert.throws(
        () =>
            assembleSocialContentPublishReconciliation(
                createInput({
                    unknownResult:
                        createUnknownResult({
                            status:
                                "published",

                            providerPublicationRef:
                                "provider-post-123",

                            publishedAt:
                                "2026-09-08T10:00:02+04:00",
                        }),
                }),
            ),

        /Publish reconciliation requires an unknownOutcome result/,
    )
})

test("reconciliation rejects retryable failure result", () => {
    assert.throws(
        () =>
            assembleSocialContentPublishReconciliation(
                createInput({
                    unknownResult:
                        createUnknownResult({
                            status:
                                "retryableFailure",

                            errorCode:
                                "RATE_LIMIT",
                        }),
                }),
            ),

        /Publish reconciliation requires an unknownOutcome result/,
    )
})

test("reconciliation rejects permanent failure result", () => {
    assert.throws(
        () =>
            assembleSocialContentPublishReconciliation(
                createInput({
                    unknownResult:
                        createUnknownResult({
                            status:
                                "permanentFailure",

                            errorCode:
                                "PERMISSION_DENIED",
                        }),
                }),
            ),

        /Publish reconciliation requires an unknownOutcome result/,
    )
})

// -----------------------------------------------------------------------------
// Provenance
// -----------------------------------------------------------------------------

test("unknown result must belong to supplied attempt", () => {
    assert.throws(
        () =>
            assembleSocialContentPublishReconciliation(
                createInput({
                    unknownResult:
                        createUnknownResult({
                            attemptId:
                                "publish-attempt-999",
                        }),
                }),
            ),

        /Unknown publish result must belong to the supplied attempt/,
    )
})

test("unknown result must preserve idempotency key", () => {
    assert.throws(
        () =>
            assembleSocialContentPublishReconciliation(
                createInput({
                    unknownResult:
                        createUnknownResult({
                            idempotencyKey:
                                "different-key",
                        }),
                }),
            ),

        /Unknown publish result must preserve attempt idempotency key/,
    )
})

test("unknown result must preserve ContentId lineage", () => {
    assert.throws(
        () =>
            assembleSocialContentPublishReconciliation(
                createInput({
                    unknownResult:
                        createUnknownResult({
                            contentId:
                                "content-999",
                        }),
                }),
            ),

        /Unknown publish result must preserve attempt publication lineage/,
    )
})

test("unknown result must preserve draft lineage", () => {
    assert.throws(
        () =>
            assembleSocialContentPublishReconciliation(
                createInput({
                    unknownResult:
                        createUnknownResult({
                            draftId:
                                "draft-999",
                        }),
                }),
            ),

        /Unknown publish result must preserve attempt publication lineage/,
    )
})

test("unknown result must preserve draft version", () => {
    assert.throws(
        () =>
            assembleSocialContentPublishReconciliation(
                createInput({
                    unknownResult:
                        createUnknownResult({
                            draftVersion:
                                3,
                        }),
                }),
            ),

        /Unknown publish result must preserve attempt publication lineage/,
    )
})

test("unknown result must preserve schedule lineage", () => {
    assert.throws(
        () =>
            assembleSocialContentPublishReconciliation(
                createInput({
                    unknownResult:
                        createUnknownResult({
                            scheduleId:
                                "schedule-999",
                        }),
                }),
            ),

        /Unknown publish result must preserve attempt publication lineage/,
    )
})

test("unknown result must preserve schedule revision", () => {
    assert.throws(
        () =>
            assembleSocialContentPublishReconciliation(
                createInput({
                    unknownResult:
                        createUnknownResult({
                            scheduleRevision:
                                2,
                        }),
                }),
            ),

        /Unknown publish result must preserve attempt publication lineage/,
    )
})

test("unknown result must preserve publishing account", () => {
    assert.throws(
        () =>
            assembleSocialContentPublishReconciliation(
                createInput({
                    unknownResult:
                        createUnknownResult({
                            publishingAccountId:
                                "publishing-account-999",
                        }),
                }),
            ),

        /Unknown publish result must preserve attempt publication lineage/,
    )
})

test("unknown result must preserve channel", () => {
    assert.throws(
        () =>
            assembleSocialContentPublishReconciliation(
                createInput({
                    unknownResult:
                        createUnknownResult({
                            channel:
                                "facebook",
                        }),
                }),
            ),

        /Unknown publish result must preserve attempt publication lineage/,
    )
})

// -----------------------------------------------------------------------------
// Chronology
// -----------------------------------------------------------------------------

test("reconciliation cannot predate unknown result", () => {
    assert.throws(
        () =>
            assembleSocialContentPublishReconciliation(
                createInput({
                    checkedAt:
                        "2026-09-08T10:00:02+04:00",
                }),
            ),

        /Publish reconciliation cannot predate the unknown result/,
    )
})

test("checkedAt may equal unknown result recordedAt", () => {
    const result =
        assembleSocialContentPublishReconciliation(
            createInput({
                outcome: {
                    status:
                        "confirmedAbsent",
                },

                checkedAt:
                    "2026-09-08T10:00:03+04:00",
            }),
        )

    assert.equal(
        result.checkedAt,
        "2026-09-08T10:00:03+04:00",
    )
})

test("reconciliation chronology compares absolute instants across offsets", () => {
    const result =
        assembleSocialContentPublishReconciliation(
            createInput({
                attempt:
                    createAttempt({
                        attemptedAt:
                            "2026-09-08T06:00:01Z",
                    }),

                unknownResult:
                    createUnknownResult({
                        recordedAt:
                            "2026-09-08T06:00:03Z",
                    }),

                outcome: {
                    status:
                        "publicationFound",

                    providerPublicationRef:
                        "provider-post-123",

                    publishedAt:
                        "2026-09-08T10:00:02+04:00",
                },

                checkedAt:
                    "2026-09-08T10:05:00+04:00",
            }),
        )

    assert.equal(
        result.status,
        "publicationFound",
    )
})

// -----------------------------------------------------------------------------
// Absolute timestamps
// -----------------------------------------------------------------------------

test("checkedAt must be absolute ISO date-time", () => {
    assert.throws(
        () =>
            assembleSocialContentPublishReconciliation(
                createInput({
                    checkedAt:
                        "2026-09-08T10:05:00",
                }),
            ),

        /checkedAt must be a valid absolute ISO date-time/,
    )
})

test("unknown result recordedAt must be absolute ISO date-time", () => {
    assert.throws(
        () =>
            assembleSocialContentPublishReconciliation(
                createInput({
                    unknownResult:
                        createUnknownResult({
                            recordedAt:
                                "2026-09-08T10:00:03",
                        }),
                }),
            ),

        /unknown result recordedAt must be a valid absolute ISO date-time/,
    )
})

test("reconciled publishedAt must be absolute ISO date-time", () => {
    assert.throws(
        () =>
            assembleSocialContentPublishReconciliation(
                createInput({
                    outcome: {
                        status:
                            "publicationFound",

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