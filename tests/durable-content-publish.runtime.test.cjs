const assert = require("node:assert/strict")
const test = require("node:test")

const {
    runDurableSocialContentPublish,
} = require(
    "../dist/application/publishing/index.js",
)

// -----------------------------------------------------------------------------
// Fixtures
// -----------------------------------------------------------------------------

function createDraft(
    overrides = {},
) {
    return {
        id:
            "draft-2",

        contentId:
            "content-1",

        contentBriefId:
            "brief-1",

        contentExecutionSpecId:
            "execution-spec-1",

        version:
            2,

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
                    "Frame 1",

                body:
                    "Body 1.",
            },
        ],

        createdAt:
            "2026-09-06T10:00:00+04:00",

        ...overrides,
    }
}

function createExecutionSpec(
    overrides = {},
) {
    return {
        id:
            "execution-spec-1",

        contentBriefId:
            "brief-1",

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

        executionGuidance: [],

        constraints: [],

        rationale:
            "Fixture.",

        createdAt:
            "2026-09-06T09:00:00+04:00",

        ...overrides,
    }
}

function createSchedule(
    overrides = {},
) {
    return {
        id:
            "schedule-1",

        contentId:
            "content-1",

        draftId:
            "draft-2",

        draftVersion:
            2,

        contentExecutionSpecId:
            "execution-spec-1",

        channel:
            "instagram",

        authorization: {
            type:
                "directPublish",

            risk:
                "low",
        },

        publishAt:
            "2026-09-08T10:00:00+04:00",

        scheduledAt:
            "2026-09-06T12:00:00+04:00",

        ...overrides,
    }
}

function createScheduleState(
    overrides = {},
) {
    return {
        scheduleId:
            "schedule-1",

        contentId:
            "content-1",

        draftId:
            "draft-2",

        draftVersion:
            2,

        revision:
            0,

        status:
            "scheduled",

        publishAt:
            "2026-09-08T10:00:00+04:00",

        ...overrides,
    }
}

function createPublishingAccount(
    overrides = {},
) {
    return {
        id:
            "publishing-account-1",

        channel:
            "instagram",

        providerAccountRef:
            "provider-account-123",

        connected:
            true,

        ...overrides,
    }
}

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
            0,

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

function createPublishedResult(
    overrides = {},
) {
    return {
        id:
            "publish-result-existing",

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
            0,

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

        ...overrides,
    }
}

function createInput(
    overrides = {},
) {
    return {
        draft:
            createDraft(),

        contentExecutionSpec:
            createExecutionSpec(),

        schedule:
            createSchedule(),

        scheduleState:
            createScheduleState(),

        publishingAccount:
            createPublishingAccount(),

        attemptId:
            "publish-attempt-1",

        attemptNumber:
            1,

        resultId:
            "publish-result-1",

        retryPolicy: {
            maxAttempts:
                3,
        },

        recoveryPolicy: {
            unresolvedAttemptGraceMs:
                5 * 60 * 1000,
        },

        ...overrides,
    }
}

function createClock(
    values,
) {
    let index =
        0

    const calls = []

    return {
        calls,

        now() {
            const value =
                values[index]

            if (
                value ===
                undefined
            ) {
                throw new Error(
                    "Test clock exhausted",
                )
            }

            index +=
                1

            calls.push(
                value,
            )

            return value
        },
    }
}

// -----------------------------------------------------------------------------
// Eligibility short-circuit
// -----------------------------------------------------------------------------

test("notEligible never claims attempt, calls provider, or records result", async () => {
    let claimCalls =
        0

    let publishCalls =
        0

    let recordCalls =
        0

    const clock =
        createClock([
            "2026-09-08T09:59:59+04:00",
        ])

    const run =
        await runDurableSocialContentPublish(
            createInput(),

            {
                now:
                    () =>
                        clock.now(),

                store: {
                    async claimAttempt() {
                        claimCalls +=
                            1

                        return {
                            status:
                                "acquired",
                        }
                    },

                    async recordResult() {
                        recordCalls +=
                            1

                        return {
                            status:
                                "recorded",
                        }
                    },
                },

                async publish() {
                    publishCalls +=
                        1

                    throw new Error(
                        "Provider must not be called",
                    )
                },
            },
        )

    assert.equal(
        run.status,
        "notEligible",
    )

    assert.deepEqual(
        run.eligibility,
        {
            eligible:
                false,

            reason:
                "notDue",
        },
    )

    assert.equal(
        claimCalls,
        0,
    )

    assert.equal(
        publishCalls,
        0,
    )

    assert.equal(
        recordCalls,
        0,
    )

    assert.equal(
        clock.calls.length,
        1,
    )
})

// -----------------------------------------------------------------------------
// Durable ordering
// -----------------------------------------------------------------------------

test("attempt claim happens before provider call and result persistence", async () => {
    const events = []

    const clock =
        createClock([
            "2026-09-08T10:00:01+04:00",
            "2026-09-08T10:00:03+04:00",
        ])

    const run =
        await runDurableSocialContentPublish(
            createInput(),

            {
                now:
                    () =>
                        clock.now(),

                store: {
                    async claimAttempt() {
                        events.push(
                            "claim",
                        )

                        return {
                            status:
                                "acquired",
                        }
                    },

                    async recordResult() {
                        events.push(
                            "record",
                        )

                        return {
                            status:
                                "recorded",
                        }
                    },
                },

                async publish() {
                    events.push(
                        "publish",
                    )

                    return {
                        status:
                            "published",

                        providerPublicationRef:
                            "provider-post-123",

                        publishedAt:
                            "2026-09-08T10:00:02+04:00",
                    }
                },
            },
        )

    assert.deepEqual(
        events,
        [
            "claim",
            "publish",
            "record",
        ],
    )

    assert.equal(
        run.status,
        "attempted",
    )

    assert.deepEqual(
        run.decision,
        {
            decision:
                "done",
        },
    )
})

// -----------------------------------------------------------------------------
// Successful acquired attempt
// -----------------------------------------------------------------------------

test("acquired attempt performs exactly one provider call and records canonical result", async () => {
    let publishCalls =
        0

    let recordedResult =
        null

    const run =
        await runDurableSocialContentPublish(
            createInput(),

            {
                now: (() => {
                    const values = [
                        "2026-09-08T10:00:01+04:00",
                        "2026-09-08T10:00:03+04:00",
                    ]

                    return () =>
                        values.shift()
                })(),

                store: {
                    async claimAttempt() {
                        return {
                            status:
                                "acquired",
                        }
                    },

                    async recordResult(
                        result,
                    ) {
                        recordedResult =
                            result

                        return {
                            status:
                                "recorded",
                        }
                    },
                },

                async publish() {
                    publishCalls +=
                        1

                    return {
                        status:
                            "published",

                        providerPublicationRef:
                            " provider-post-123 ",

                        publishedAt:
                            "2026-09-08T10:00:02+04:00",
                    }
                },
            },
        )

    assert.equal(
        publishCalls,
        1,
    )

    assert.equal(
        run.status,
        "attempted",
    )

    assert.equal(
        run.result,
        recordedResult,
    )

    assert.equal(
        run.result.providerPublicationRef,
        "provider-post-123",
    )

    assert.deepEqual(
        run.decision,
        {
            decision:
                "done",
        },
    )
})

// -----------------------------------------------------------------------------
// Crash-safe resume: attempt exists, result missing
// -----------------------------------------------------------------------------
test("existing unresolved attempt inside grace window remains inProgress and never calls provider", async () => {
    let publishCalls =
        0

    let recordCalls =
        0

    const storedAttempt =
        createAttempt({
            attemptedAt:
                "2026-09-08T10:00:01+04:00",
        })

    const run =
        await runDurableSocialContentPublish(
            createInput(),

            {
                now:
                    () =>
                        "2026-09-08T10:04:00+04:00",

                store: {
                    async claimAttempt() {
                        return {
                            status:
                                "alreadyRecorded",

                            attempt:
                                storedAttempt,

                            result:
                                null,
                        }
                    },

                    async recordResult() {
                        recordCalls +=
                            1

                        return {
                            status:
                                "recorded",
                        }
                    },
                },

                async publish() {
                    publishCalls +=
                        1

                    throw new Error(
                        "Provider must not be called",
                    )
                },
            },
        )

    assert.equal(
        publishCalls,
        0,
    )

    assert.equal(
        recordCalls,
        0,
    )

    assert.deepEqual(
        run,
        {
            status:
                "inProgress",

            eligibility:
                run.eligibility,

            attempt:
                storedAttempt,

            result:
                null,

            decision:
                null,

            reconciliationNotBefore:
                "2026-09-08T06:05:01.000Z",
        },
    )
})
test("existing attempt without result requires reconciliation and never calls provider", async () => {
    let publishCalls =
        0

    let recordCalls =
        0

    const storedAttempt =
        createAttempt()

    const run =
        await runDurableSocialContentPublish(
            createInput(),

            {
                now:
                    () =>
                        "2026-09-08T10:05:02+04:00",

                store: {
                    async claimAttempt() {
                        return {
                            status:
                                "alreadyRecorded",

                            attempt:
                                storedAttempt,

                            result:
                                null,
                        }
                    },

                    async recordResult() {
                        recordCalls +=
                            1

                        return {
                            status:
                                "recorded",
                        }
                    },
                },

                async publish() {
                    publishCalls +=
                        1

                    throw new Error(
                        "Provider must not be called",
                    )
                },
            },
        )

    assert.equal(
        publishCalls,
        0,
    )

    assert.equal(
        recordCalls,
        0,
    )

    assert.deepEqual(
        run,
        {
            status:
                "reconciliationRequired",

            eligibility:
                run.eligibility,

            attempt:
                storedAttempt,

            result:
                null,

            decision: {
                decision:
                    "requiresReconciliation",
            },
        },
    )
})


test("unresolved attempt becomes reconciliationRequired exactly at grace boundary", async () => {
    let publishCalls =
        0

    const storedAttempt =
        createAttempt({
            attemptedAt:
                "2026-09-08T10:00:01+04:00",
        })

    const run =
        await runDurableSocialContentPublish(
            createInput(),

            {
                now:
                    () =>
                        "2026-09-08T10:05:01+04:00",

                store: {
                    async claimAttempt() {
                        return {
                            status:
                                "alreadyRecorded",

                            attempt:
                                storedAttempt,

                            result:
                                null,
                        }
                    },

                    async recordResult() {
                        throw new Error(
                            "Result must not be recorded",
                        )
                    },
                },

                async publish() {
                    publishCalls +=
                        1

                    throw new Error(
                        "Provider must not be called",
                    )
                },
            },
        )

    assert.equal(
        publishCalls,
        0,
    )

    assert.equal(
        run.status,
        "reconciliationRequired",
    )

    assert.deepEqual(
        run.decision,
        {
            decision:
                "requiresReconciliation",
        },
    )
})
test("unresolved attempt grace must be a positive safe integer", async () => {
    await assert.rejects(
        () =>
            runDurableSocialContentPublish(
                createInput({
                    recoveryPolicy: {
                        unresolvedAttemptGraceMs:
                            0,
                    },
                }),

                {
                    now:
                        () =>
                            "2026-09-08T10:05:00+04:00",

                    store: {
                        async claimAttempt() {
                            return {
                                status:
                                    "alreadyRecorded",

                                attempt:
                                    createAttempt(),

                                result:
                                    null,
                            }
                        },

                        async recordResult() {
                            throw new Error(
                                "Not expected",
                            )
                        },
                    },

                    async publish() {
                        throw new Error(
                            "Provider must not be called",
                        )
                    },
                },
            ),

        /Unresolved publish attempt grace must be a positive safe integer/,
    )
})
test("current run cannot predate stored unresolved attempt", async () => {
    await assert.rejects(
        () =>
            runDurableSocialContentPublish(
                createInput(),

                {
                    now:
                        () =>
                            "2026-09-08T09:59:00+04:00",

                    store: {
                        async claimAttempt() {
                            return {
                                status:
                                    "alreadyRecorded",

                                attempt:
                                    createAttempt({
                                        attemptedAt:
                                            "2026-09-08T10:00:01+04:00",
                                    }),

                                result:
                                    null,
                            }
                        },

                        async recordResult() {
                            throw new Error(
                                "Not expected",
                            )
                        },
                    },

                    async publish() {
                        throw new Error(
                            "Provider must not be called",
                        )
                    },
                },
            ),

        /Current publish run cannot predate the stored attempt/,
    )
})
// -----------------------------------------------------------------------------
// Crash-safe resume: attempt + result already exist
// -----------------------------------------------------------------------------

test("existing durable attempt and result resume without provider call", async () => {
    let publishCalls =
        0

    let recordCalls =
        0

    const storedAttempt =
        createAttempt()

    const storedResult =
        createPublishedResult()

    const run =
        await runDurableSocialContentPublish(
            createInput(),

            {
                now:
                    () =>
                        "2026-09-08T10:05:00+04:00",

                store: {
                    async claimAttempt() {
                        return {
                            status:
                                "alreadyRecorded",

                            attempt:
                                storedAttempt,

                            result:
                                storedResult,
                        }
                    },

                    async recordResult() {
                        recordCalls +=
                            1

                        return {
                            status:
                                "recorded",
                        }
                    },
                },

                async publish() {
                    publishCalls +=
                        1

                    throw new Error(
                        "Provider must not be called",
                    )
                },
            },
        )

    assert.equal(
        publishCalls,
        0,
    )

    assert.equal(
        recordCalls,
        0,
    )

    assert.equal(
        run.status,
        "resumed",
    )

    assert.equal(
        run.attempt,
        storedAttempt,
    )

    assert.equal(
        run.result,
        storedResult,
    )

    assert.deepEqual(
        run.decision,
        {
            decision:
                "done",
        },
    )
})

// -----------------------------------------------------------------------------
// Existing retryable result
// -----------------------------------------------------------------------------

test("resumed retryable result resolves retry decision without new provider call", async () => {
    let publishCalls =
        0

    const storedAttempt =
        createAttempt()

    const storedResult = {
        ...createPublishedResult(),

        status:
            "retryableFailure",

        errorCode:
            "RATE_LIMIT",

        retryAfter:
            "2026-09-08T10:10:00+04:00",
    }

    delete storedResult.providerPublicationRef
    delete storedResult.publishedAt

    const run =
        await runDurableSocialContentPublish(
            createInput(),

            {
                now:
                    () =>
                        "2026-09-08T10:05:00+04:00",

                store: {
                    async claimAttempt() {
                        return {
                            status:
                                "alreadyRecorded",

                            attempt:
                                storedAttempt,

                            result:
                                storedResult,
                        }
                    },

                    async recordResult() {
                        throw new Error(
                            "Result must not be recorded again",
                        )
                    },
                },

                async publish() {
                    publishCalls +=
                        1

                    throw new Error(
                        "Provider must not be called",
                    )
                },
            },
        )

    assert.equal(
        publishCalls,
        0,
    )

    assert.deepEqual(
        run.decision,
        {
            decision:
                "retryAllowed",

            nextAttemptNumber:
                2,

            retryAfter:
                "2026-09-08T10:10:00+04:00",
        },
    )
})

// -----------------------------------------------------------------------------
// Canonical stored attempt
// -----------------------------------------------------------------------------

test("stored attempt remains canonical even when current worker proposed a different attempt ID", async () => {
    let publishCalls =
        0

    const storedAttempt =
        createAttempt({
            id:
                "publish-attempt-original",

            attemptedAt:
                "2026-09-08T10:00:01+04:00",
        })

    const run =
        await runDurableSocialContentPublish(
            createInput({
                attemptId:
                    "publish-attempt-new-worker",
            }),

            {
                now:
                    () =>
                        "2026-09-08T10:05:00+04:00",

                store: {
                    async claimAttempt() {
                        return {
                            status:
                                "alreadyRecorded",

                            attempt:
                                storedAttempt,

                            result:
                                null,
                        }
                    },

                    async recordResult() {
                        throw new Error(
                            "Result must not be recorded",
                        )
                    },
                },

                async publish() {
                    publishCalls +=
                        1

                    throw new Error(
                        "Provider must not be called",
                    )
                },
            },
        )

    assert.equal(
        publishCalls,
        0,
    )

    assert.equal(
        run.attempt.id,
        "publish-attempt-original",
    )

    assert.equal(
        run.status,
        "reconciliationRequired",
    )
})

// -----------------------------------------------------------------------------
// Claim identity protection
// -----------------------------------------------------------------------------

test("stored attempt must preserve claimed idempotency identity", async () => {
    await assert.rejects(
        () =>
            runDurableSocialContentPublish(
                createInput(),

                {
                    now:
                        () =>
                            "2026-09-08T10:05:00+04:00",

                    store: {
                        async claimAttempt() {
                            return {
                                status:
                                    "alreadyRecorded",

                                attempt:
                                    createAttempt({
                                        idempotencyKey:
                                            "different-key",
                                    }),

                                result:
                                    null,
                            }
                        },

                        async recordResult() {
                            throw new Error(
                                "Not expected",
                            )
                        },
                    },

                    async publish() {
                        throw new Error(
                            "Provider must not be called",
                        )
                    },
                },
            ),

        /Stored publish attempt must match claimed idempotency identity/,
    )
})

test("stored attempt number must preserve claimed idempotency identity", async () => {
    await assert.rejects(
        () =>
            runDurableSocialContentPublish(
                createInput(),

                {
                    now:
                        () =>
                            "2026-09-08T10:05:00+04:00",

                    store: {
                        async claimAttempt() {
                            return {
                                status:
                                    "alreadyRecorded",

                                attempt:
                                    createAttempt({
                                        attemptNumber:
                                            2,
                                    }),

                                result:
                                    null,
                            }
                        },

                        async recordResult() {
                            throw new Error(
                                "Not expected",
                            )
                        },
                    },

                    async publish() {
                        throw new Error(
                            "Provider must not be called",
                        )
                    },
                },
            ),

        /Stored publish attempt must match claimed idempotency identity/,
    )
})

test("stored attempt must preserve publication intent lineage", async () => {
    await assert.rejects(
        () =>
            runDurableSocialContentPublish(
                createInput(),

                {
                    now:
                        () =>
                            "2026-09-08T10:05:00+04:00",

                    store: {
                        async claimAttempt() {
                            return {
                                status:
                                    "alreadyRecorded",

                                attempt:
                                    createAttempt({
                                        draftId:
                                            "draft-999",
                                    }),

                                result:
                                    null,
                            }
                        },

                        async recordResult() {
                            throw new Error(
                                "Not expected",
                            )
                        },
                    },

                    async publish() {
                        throw new Error(
                            "Provider must not be called",
                        )
                    },
                },
            ),

        /Stored publish attempt must preserve publication intent lineage/,
    )
})

// -----------------------------------------------------------------------------
// Idempotent result persistence
// -----------------------------------------------------------------------------

test("already-recorded result becomes canonical after provider call", async () => {
    const canonicalResult =
        createPublishedResult({
            id:
                "publish-result-canonical",

            attemptId:
                "publish-attempt-1",
        })

    const run =
        await runDurableSocialContentPublish(
            createInput(),

            {
                now: (() => {
                    const values = [
                        "2026-09-08T10:00:01+04:00",
                        "2026-09-08T10:00:04+04:00",
                    ]

                    return () =>
                        values.shift()
                })(),

                store: {
                    async claimAttempt() {
                        return {
                            status:
                                "acquired",
                        }
                    },

                    async recordResult() {
                        return {
                            status:
                                "alreadyRecorded",

                            result:
                                canonicalResult,
                        }
                    },
                },

                async publish() {
                    return {
                        status:
                            "published",

                        providerPublicationRef:
                            "provider-post-new-response",

                        publishedAt:
                            "2026-09-08T10:00:02+04:00",
                    }
                },
            },
        )

    assert.equal(
        run.status,
        "attempted",
    )

    assert.equal(
        run.result,
        canonicalResult,
    )

    assert.equal(
        run.result.id,
        "publish-result-canonical",
    )

    assert.equal(
        run.result.providerPublicationRef,
        "provider-post-123",
    )
})

// -----------------------------------------------------------------------------
// Crash between claim and result persistence
// -----------------------------------------------------------------------------

test("provider exception after durable claim propagates and result is not fabricated", async () => {
    const events = []

    await assert.rejects(
        () =>
            runDurableSocialContentPublish(
                createInput(),

                {
                    now:
                        () =>
                            "2026-09-08T10:00:01+04:00",

                    store: {
                        async claimAttempt() {
                            events.push(
                                "claim",
                            )

                            return {
                                status:
                                    "acquired",
                            }
                        },

                        async recordResult() {
                            events.push(
                                "record",
                            )

                            return {
                                status:
                                    "recorded",
                            }
                        },
                    },

                    async publish() {
                        events.push(
                            "publish",
                        )

                        throw new Error(
                            "Connection lost",
                        )
                    },
                },
            ),

        /Connection lost/,
    )

    assert.deepEqual(
        events,
        [
            "claim",
            "publish",
        ],
    )
})

// -----------------------------------------------------------------------------
// Canonical result lineage protection
// -----------------------------------------------------------------------------

test("stored canonical result must belong to canonical attempt", async () => {
    const canonicalResult =
        createPublishedResult({
            attemptId:
                "publish-attempt-999",
        })

    await assert.rejects(
        () =>
            runDurableSocialContentPublish(
                createInput(),

                {
                    now: (() => {
                        const values = [
                            "2026-09-08T10:00:01+04:00",
                            "2026-09-08T10:00:04+04:00",
                        ]

                        return () =>
                            values.shift()
                    })(),

                    store: {
                        async claimAttempt() {
                            return {
                                status:
                                    "acquired",
                            }
                        },

                        async recordResult() {
                            return {
                                status:
                                    "alreadyRecorded",

                                result:
                                    canonicalResult,
                            }
                        },
                    },

                    async publish() {
                        return {
                            status:
                                "published",

                            providerPublicationRef:
                                "provider-post-123",

                            publishedAt:
                                "2026-09-08T10:00:02+04:00",
                        }
                    },
                },
            ),

        /Publish result must belong to the supplied attempt/,
    )
})