const assert = require("node:assert/strict")
const test = require("node:test")

const {
    runSocialContentPublish,
} = require(
    "../dist/blueprints/social/index.js",
)

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

test("not-due content returns notEligible and never calls provider", async () => {
    let publishCalls =
        0

    const clock =
        createClock([
            "2026-09-08T09:59:59+04:00",
        ])

    const run =
        await runSocialContentPublish(
            createInput(),

            {
                now:
                    () =>
                        clock.now(),

                publish:
                    async () => {
                        publishCalls +=
                            1

                        return {
                            status:
                                "published",

                            providerPublicationRef:
                                "provider-post-123",

                            publishedAt:
                                "2026-09-08T10:00:00+04:00",
                        }
                    },
            },
        )

    assert.deepEqual(
        run,
        {
            status:
                "notEligible",

            eligibility: {
                eligible:
                    false,

                reason:
                    "notDue",
            },

            attempt:
                null,

            result:
                null,

            decision:
                null,
        },
    )

    assert.equal(
        publishCalls,
        0,
    )

    assert.equal(
        clock.calls.length,
        1,
    )
})

test("cancelled schedule never calls provider", async () => {
    let publishCalls =
        0

    const run =
        await runSocialContentPublish(
            createInput({
                scheduleState: {
                    scheduleId:
                        "schedule-1",

                    contentId:
                        "content-1",

                    draftId:
                        "draft-2",

                    draftVersion:
                        2,

                    revision:
                        1,

                    status:
                        "cancelled",

                    lastPublishAt:
                        "2026-09-08T10:00:00+04:00",

                    cancelledAt:
                        "2026-09-07T12:00:00+04:00",
                },
            }),

            {
                now:
                    () =>
                        "2026-09-08T10:00:00+04:00",

                publish:
                    async () => {
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
                "scheduleCancelled",
        },
    )

    assert.equal(
        publishCalls,
        0,
    )
})

// -----------------------------------------------------------------------------
// One provider call
// -----------------------------------------------------------------------------

test("eligible run performs exactly one provider call", async () => {
    let publishCalls =
        0

    const clock =
        createClock([
            "2026-09-08T10:00:01+04:00",
            "2026-09-08T10:00:03+04:00",
        ])

    const run =
        await runSocialContentPublish(
            createInput(),

            {
                now:
                    () =>
                        clock.now(),

                publish:
                    async () => {
                        publishCalls +=
                            1

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

    assert.equal(
        publishCalls,
        1,
    )

    assert.equal(
        clock.calls.length,
        2,
    )

    assert.equal(
        run.status,
        "attempted",
    )

    assert.equal(
        run.decision.decision,
        "done",
    )
})

test("provider receives canonical attempt and exact publishing context", async () => {
    let received =
        null

    const input =
        createInput()

    const run =
        await runSocialContentPublish(
            input,

            {
                now: (() => {
                    const values = [
                        "2026-09-08T10:00:01+04:00",
                        "2026-09-08T10:00:03+04:00",
                    ]

                    return () =>
                        values.shift()
                })(),

                publish:
                    async (providerInput) => {
                        received =
                            providerInput

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

    assert.equal(
        received.draft,
        input.draft,
    )

    assert.equal(
        received.contentExecutionSpec,
        input.contentExecutionSpec,
    )

    assert.equal(
        received.publishingAccount,
        input.publishingAccount,
    )

    assert.equal(
        received.attempt,
        run.attempt,
    )
})

// -----------------------------------------------------------------------------
// Canonical attempt / result lineage
// -----------------------------------------------------------------------------

test("one worker-owned instant drives both eligibility and attemptedAt", async () => {
    const run =
        await runSocialContentPublish(
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

                publish:
                    async () => ({
                        status:
                            "published",

                        providerPublicationRef:
                            "provider-post-123",

                        publishedAt:
                            "2026-09-08T10:00:02+04:00",
                    }),
            },
        )

    assert.equal(
        run.eligibility.publishAt,
        "2026-09-08T10:00:00+04:00",
    )

    assert.equal(
        run.attempt.attemptedAt,
        "2026-09-08T10:00:01+04:00",
    )

    assert.equal(
        run.result.recordedAt,
        "2026-09-08T10:00:03+04:00",
    )
})

test("publish run preserves attempt number and stable idempotency key", async () => {
    const run =
        await runSocialContentPublish(
            createInput({
                attemptNumber:
                    2,

                attemptId:
                    "publish-attempt-2",
            }),

            {
                now: (() => {
                    const values = [
                        "2026-09-08T10:00:01+04:00",
                        "2026-09-08T10:00:03+04:00",
                    ]

                    return () =>
                        values.shift()
                })(),

                publish:
                    async () => ({
                        status:
                            "retryableFailure",

                        errorCode:
                            "TEMPORARY_PROVIDER_ERROR",
                    }),
            },
        )

    assert.equal(
        run.attempt.attemptNumber,
        2,
    )

    assert.equal(
        run.attempt.idempotencyKey,
        "social-publish:v1|schedule=schedule-1|draft=draft-2|version=2|account=publishing-account-1",
    )

    assert.equal(
        run.result.idempotencyKey,
        run.attempt.idempotencyKey,
    )
})

// -----------------------------------------------------------------------------
// Published
// -----------------------------------------------------------------------------

test("published provider outcome becomes canonical published result and done decision", async () => {
    const run =
        await runSocialContentPublish(
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

                publish:
                    async () => ({
                        status:
                            "published",

                        providerPublicationRef:
                            " provider-post-123 ",

                        publishedAt:
                            "2026-09-08T10:00:02+04:00",
                    }),
            },
        )

    assert.equal(
        run.result.status,
        "published",
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
// Retryable failure
// -----------------------------------------------------------------------------

test("retryable provider failure becomes retryAllowed while budget remains", async () => {
    const run =
        await runSocialContentPublish(
            createInput({
                attemptNumber:
                    1,
            }),

            {
                now: (() => {
                    const values = [
                        "2026-09-08T10:00:01+04:00",
                        "2026-09-08T10:00:03+04:00",
                    ]

                    return () =>
                        values.shift()
                })(),

                publish:
                    async () => ({
                        status:
                            "retryableFailure",

                        errorCode:
                            "RATE_LIMIT",

                        retryAfter:
                            "2026-09-08T10:05:00+04:00",
                    }),
            },
        )

    assert.equal(
        run.result.status,
        "retryableFailure",
    )

    assert.deepEqual(
        run.decision,
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

test("retryable provider failure becomes exhausted at retry limit", async () => {
    const run =
        await runSocialContentPublish(
            createInput({
                attemptNumber:
                    3,

                retryPolicy: {
                    maxAttempts:
                        3,
                },
            }),

            {
                now: (() => {
                    const values = [
                        "2026-09-08T10:00:01+04:00",
                        "2026-09-08T10:00:03+04:00",
                    ]

                    return () =>
                        values.shift()
                })(),

                publish:
                    async () => ({
                        status:
                            "retryableFailure",

                        errorCode:
                            "TEMPORARY_PROVIDER_ERROR",
                    }),
            },
        )

    assert.deepEqual(
        run.decision,
        {
            decision:
                "retryExhausted",
        },
    )
})

// -----------------------------------------------------------------------------
// Permanent failure
// -----------------------------------------------------------------------------

test("permanent provider failure stops publication flow", async () => {
    const run =
        await runSocialContentPublish(
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

                publish:
                    async () => ({
                        status:
                            "permanentFailure",

                        errorCode:
                            "PERMISSION_DENIED",
                    }),
            },
        )

    assert.equal(
        run.result.status,
        "permanentFailure",
    )

    assert.deepEqual(
        run.decision,
        {
            decision:
                "stop",
        },
    )
})

// -----------------------------------------------------------------------------
// Unknown outcome
// -----------------------------------------------------------------------------

test("unknown provider outcome requires reconciliation and is never retried inside run", async () => {
    let publishCalls =
        0

    const run =
        await runSocialContentPublish(
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

                publish:
                    async () => {
                        publishCalls +=
                            1

                        return {
                            status:
                                "unknownOutcome",

                            errorCode:
                                "CONNECTION_LOST_AFTER_SEND",
                        }
                    },
            },
        )

    assert.equal(
        publishCalls,
        1,
    )

    assert.equal(
        run.result.status,
        "unknownOutcome",
    )

    assert.deepEqual(
        run.decision,
        {
            decision:
                "requiresReconciliation",
        },
    )
})

// -----------------------------------------------------------------------------
// Provider / orchestration failure behavior
// -----------------------------------------------------------------------------

test("unexpected provider exception propagates and does not fabricate a result", async () => {
    let publishCalls =
        0

    await assert.rejects(
        () =>
            runSocialContentPublish(
                createInput(),

                {
                    now:
                        () =>
                            "2026-09-08T10:00:01+04:00",

                    publish:
                        async () => {
                            publishCalls +=
                                1

                            throw new Error(
                                "Unexpected adapter bug",
                            )
                        },
                },
            ),

        /Unexpected adapter bug/,
    )

    assert.equal(
        publishCalls,
        1,
    )
})

test("malformed provider outcome is rejected by canonical result assembly", async () => {
    await assert.rejects(
        () =>
            runSocialContentPublish(
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

                    publish:
                        async () => ({
                            status:
                                "published",

                            providerPublicationRef:
                                "   ",

                            publishedAt:
                                "2026-09-08T10:00:02+04:00",
                        }),
                },
            ),

        /providerPublicationRef must not be blank/,
    )
})