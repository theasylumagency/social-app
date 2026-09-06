const AUTHORITY_FIELDS = [
    "id",
    "contentDirectionKey",
    "brandId",
    "weekId",
    "generatedAt",
    "createdAt",
    "updatedAt",
    "primaryAudienceKey",
    "secondaryAudienceKeys",
    "audience",
    "channel",
    "format",
    "contentMode",
    "cta",
    "schedule",
    "publishAt",
    "experiment",
    "post",
    "caption",
    "hook",
]

const EXECUTION_PHRASES = [
    "instagram",
    "facebook",
    "carousel",
    "reel",
    "story",
    "slide",
    "caption",
    "post on",
    "publish on",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
]

function isNonEmptyString(value) {
    return (
        typeof value === "string" &&
        value.trim().length > 0
    )
}

function normalize(value) {
    return value
        .toLowerCase()
        .trim()
        .replace(/\s+/g, " ")
}

function evaluateContentDirectionProposal(
    output,
    input,
) {
    const failures = []

    if (
        output === null ||
        typeof output !== "object" ||
        Array.isArray(output)
    ) {
        return {
            passed: false,
            failures: [
                "output must be an object",
            ],
        }
    }

    if (!Array.isArray(output.directions)) {
        return {
            passed: false,
            failures: [
                "directions must be an array",
            ],
        }
    }

    if (
        output.directions.length < 3 ||
        output.directions.length > 5
    ) {
        failures.push(
            "directions must contain between 3 and 5 items",
        )
    }

    const seenDirections = new Set()

    for (const direction of output.directions) {
        if (
            direction === null ||
            typeof direction !== "object" ||
            Array.isArray(direction)
        ) {
            failures.push(
                "each direction must be an object",
            )

            continue
        }

        for (const field of AUTHORITY_FIELDS) {
            if (
                Object.prototype.hasOwnProperty.call(
                    direction,
                    field,
                )
            ) {
                failures.push(
                    `direction contains authority or execution field: ${field}`,
                )
            }
        }

        if (
            !isNonEmptyString(
                direction.direction,
            )
        ) {
            failures.push(
                "direction.direction must be a non-empty string",
            )
        } else {
            const normalizedDirection =
                normalize(
                    direction.direction,
                )

            if (
                seenDirections.has(
                    normalizedDirection,
                )
            ) {
                failures.push(
                    `duplicate direction: ${direction.direction}`,
                )
            }

            seenDirections.add(
                normalizedDirection,
            )

            for (
                const phrase
                of EXECUTION_PHRASES
            ) {
                if (
                    normalizedDirection.includes(
                        phrase,
                    )
                ) {
                    failures.push(
                        `direction appears execution-specific: ${phrase}`,
                    )
                }
            }
        }

        if (
            !isNonEmptyString(
                direction.purpose,
            )
        ) {
            failures.push(
                "direction.purpose must be a non-empty string",
            )
        }

        if (
            !isNonEmptyString(
                direction.rationale,
            )
        ) {
            failures.push(
                "direction.rationale must be a non-empty string",
            )
        }
    }

    return {
        passed:
            failures.length === 0,

        failures,
    }
}

module.exports = {
    evaluateContentDirectionProposal,
}