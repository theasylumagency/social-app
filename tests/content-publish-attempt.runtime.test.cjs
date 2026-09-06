const assert = require("node:assert/strict")
const test = require("node:test")

const {
    assembleSocialContentPublishAttempt,
    createSocialContentPublishIdempotencyKey,
} = require(
    "../dist/blueprints/social/index.js",
)

function createEligibility(
    overrides = {},
) {
    return {
        eligible:
            true,

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

        ...overrides,
    }
}

function createInput(
    overrides = {},

) {
    return {
        id:
            "publish-attempt-1",
        attemptNumber:
            1,
        eligibility:
            createEligibility(),

        attemptedAt:
            "2026-09-08T10:00:01+04:00",

        ...overrides,
    }
}

// -----------------------------------------------------------------------------
// Assembly
// -----------------------------------------------------------------------------

test("publish attempt is pinned to exact eligible publication intent", () => {
    const attempt =
        assembleSocialContentPublishAttempt(
            createInput(),
        )

    assert.deepEqual(
        attempt,
        {
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
        },
    )
})

// -----------------------------------------------------------------------------
// Idempotency
// -----------------------------------------------------------------------------

test("retry with another attempt ID produces same idempotency key", () => {
    const first =
        assembleSocialContentPublishAttempt(
            createInput({
                id:
                    "publish-attempt-1",
                attemptNumber:
                    1,
                attemptedAt:
                    "2026-09-08T10:00:01+04:00",
            }),
        )

    const retry =
        assembleSocialContentPublishAttempt(
            createInput({
                id:
                    "publish-attempt-2",
                attemptNumber:
                    2,
                attemptedAt:
                    "2026-09-08T10:01:00+04:00",
            }),
        )

    assert.notEqual(
        first.id,
        retry.id,
    )
    assert.notEqual(
        first.attemptNumber,
        retry.attemptNumber,
    )

    assert.equal(
        first.idempotencyKey,
        retry.idempotencyKey,
    )

})
test("publish attempt requires positive attempt number", () => {
    assert.throws(
        () =>
            assembleSocialContentPublishAttempt(
                createInput({
                    attemptNumber:
                        0,
                }),
            ),

        /Publish attempt number must be a positive integer/,
    )
})
test("reschedule revision does not create a new idempotency key", () => {
    const beforeReschedule =
        createEligibility({
            scheduleRevision:
                1,

            publishAt:
                "2026-09-08T10:00:00+04:00",
        })

    const afterReschedule =
        createEligibility({
            scheduleRevision:
                2,

            publishAt:
                "2026-09-10T15:00:00+04:00",
        })

    assert.equal(
        createSocialContentPublishIdempotencyKey(
            beforeReschedule,
        ),

        createSocialContentPublishIdempotencyKey(
            afterReschedule,
        ),
    )
})

test("different schedule produces different idempotency key", () => {
    const first =
        createSocialContentPublishIdempotencyKey(
            createEligibility({
                scheduleId:
                    "schedule-1",
            }),
        )

    const second =
        createSocialContentPublishIdempotencyKey(
            createEligibility({
                scheduleId:
                    "schedule-2",
            }),
        )

    assert.notEqual(
        first,
        second,
    )
})

test("different draft produces different idempotency key", () => {
    const first =
        createSocialContentPublishIdempotencyKey(
            createEligibility({
                draftId:
                    "draft-2",
            }),
        )

    const second =
        createSocialContentPublishIdempotencyKey(
            createEligibility({
                draftId:
                    "draft-3",
            }),
        )

    assert.notEqual(
        first,
        second,
    )
})

test("different draft version produces different idempotency key", () => {
    const first =
        createSocialContentPublishIdempotencyKey(
            createEligibility({
                draftVersion:
                    2,
            }),
        )

    const second =
        createSocialContentPublishIdempotencyKey(
            createEligibility({
                draftVersion:
                    3,
            }),
        )

    assert.notEqual(
        first,
        second,
    )
})

test("different publishing account produces different idempotency key", () => {
    const first =
        createSocialContentPublishIdempotencyKey(
            createEligibility({
                publishingAccountId:
                    "publishing-account-1",
            }),
        )

    const second =
        createSocialContentPublishIdempotencyKey(
            createEligibility({
                publishingAccountId:
                    "publishing-account-2",
            }),
        )

    assert.notEqual(
        first,
        second,
    )
})

test("publishAt does not affect idempotency key", () => {
    const first =
        createSocialContentPublishIdempotencyKey(
            createEligibility({
                publishAt:
                    "2026-09-08T10:00:00+04:00",
            }),
        )

    const second =
        createSocialContentPublishIdempotencyKey(
            createEligibility({
                publishAt:
                    "2026-09-20T18:00:00+04:00",
            }),
        )

    assert.equal(
        first,
        second,
    )
})

// -----------------------------------------------------------------------------
// Eligibility runtime guard
// -----------------------------------------------------------------------------

test("publish attempt rejects ineligible runtime input", () => {
    assert.throws(
        () =>
            assembleSocialContentPublishAttempt(
                createInput({
                    eligibility: {
                        eligible:
                            false,

                        reason:
                            "notDue",
                    },
                }),
            ),

        /Publish attempt requires eligible content/,
    )
})

// -----------------------------------------------------------------------------
// Version / revision
// -----------------------------------------------------------------------------

test("publish attempt requires positive draft version", () => {
    assert.throws(
        () =>
            assembleSocialContentPublishAttempt(
                createInput({
                    eligibility:
                        createEligibility({
                            draftVersion:
                                0,
                        }),
                }),
            ),

        /Publish attempt draft version must be a positive integer/,
    )
})

test("publish attempt requires non-negative schedule revision", () => {
    assert.throws(
        () =>
            assembleSocialContentPublishAttempt(
                createInput({
                    eligibility:
                        createEligibility({
                            scheduleRevision:
                                -1,
                        }),
                }),
            ),

        /Publish attempt schedule revision must be a non-negative integer/,
    )
})

// -----------------------------------------------------------------------------
// Time
// -----------------------------------------------------------------------------

test("publish attempt may occur exactly at publishAt", () => {
    const attempt =
        assembleSocialContentPublishAttempt(
            createInput({
                attemptedAt:
                    "2026-09-08T10:00:00+04:00",
            }),
        )

    assert.equal(
        attempt.attemptedAt,
        "2026-09-08T10:00:00+04:00",
    )
})

test("publish attempt cannot occur before publishAt", () => {
    assert.throws(
        () =>
            assembleSocialContentPublishAttempt(
                createInput({
                    attemptedAt:
                        "2026-09-08T09:59:59+04:00",
                }),
            ),

        /Publish attempt cannot occur before publishAt/,
    )
})

test("publish attempt compares absolute instants across offsets", () => {
    const attempt =
        assembleSocialContentPublishAttempt(
            createInput({
                eligibility:
                    createEligibility({
                        publishAt:
                            "2026-09-08T06:00:00Z",
                    }),

                attemptedAt:
                    "2026-09-08T10:00:01+04:00",
            }),
        )

    assert.equal(
        attempt.publishAt,
        "2026-09-08T06:00:00Z",
    )
})

test("publish attempt requires absolute publishAt", () => {
    assert.throws(
        () =>
            assembleSocialContentPublishAttempt(
                createInput({
                    eligibility:
                        createEligibility({
                            publishAt:
                                "2026-09-08T10:00:00",
                        }),
                }),
            ),

        /publishAt must be a valid absolute ISO date-time/,
    )
})

test("publish attempt requires absolute attemptedAt", () => {
    assert.throws(
        () =>
            assembleSocialContentPublishAttempt(
                createInput({
                    attemptedAt:
                        "2026-09-08T10:00:01",
                }),
            ),

        /attemptedAt must be a valid absolute ISO date-time/,
    )
})

// -----------------------------------------------------------------------------
// Canonical key escaping
// -----------------------------------------------------------------------------

test("idempotency key safely escapes identity components", () => {
    const key =
        createSocialContentPublishIdempotencyKey(
            createEligibility({
                scheduleId:
                    "schedule|1",

                draftId:
                    "draft=2",

                publishingAccountId:
                    "account/1",
            }),
        )

    assert.equal(
        key,
        "social-publish:v1|schedule=schedule%7C1|draft=draft%3D2|version=2|account=account%2F1",
    )
})