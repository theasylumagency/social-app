const BIASES = new Set([
    "balanced",
    "moreExplanatory",
    "moreDecisionOriented",
    "moreTrustFocused",
    "morePractical",
])

const AUTHORITY_FIELDS = [
    "id",
    "brandId",
    "contentDirectionId",
    "primaryAudience",
    "secondaryAudiences",
    "landscapeVersion",
    "profileIds",
    "envelopeId",
    "generatedAt",
    "createdAt",
    "updatedAt",
    "founderStance",
    "influence",
    "lifecycle",
    "weeklyObjective",
    "weeklyAudienceFocus",
    "contentDirection",
    "post",
    "channel",
    "schedule",
]

function isNonEmptyString(value) {
    return (
        typeof value === "string" &&
        value.trim().length > 0
    )
}

function evaluateContentAudienceDirectionProposal(
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

    const inputDirections =
        Array.isArray(input.contentDirections)
            ? input.contentDirections
            : []

    const requestedDirectionKeys = new Set(
        inputDirections.map(
            (direction) =>
                direction.contentDirectionKey,
        ),
    )

    const weeklyFocus =
        input.weeklyAudienceFocus ?? {}

    const allowedAudienceKeys = new Set([
        weeklyFocus.primaryAudienceKey,

        ...(
            Array.isArray(
                weeklyFocus.secondaryAudienceKeys,
            )
                ? weeklyFocus.secondaryAudienceKeys
                : []
        ),
    ])

    const seenDirectionKeys = new Set()

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
                    `direction contains authority field: ${field}`,
                )
            }
        }

        // ---------------------------------------------------------------------
        // Content direction key
        // ---------------------------------------------------------------------

        if (
            !isNonEmptyString(
                direction.contentDirectionKey,
            )
        ) {
            failures.push(
                "contentDirectionKey must be a non-empty string",
            )
        } else {
            const key =
                direction.contentDirectionKey

            if (
                !requestedDirectionKeys.has(key)
            ) {
                failures.push(
                    `unknown contentDirectionKey: ${key}`,
                )
            }

            if (
                seenDirectionKeys.has(key)
            ) {
                failures.push(
                    `duplicate contentDirectionKey: ${key}`,
                )
            }

            seenDirectionKeys.add(key)
        }

        // ---------------------------------------------------------------------
        // Primary audience
        // ---------------------------------------------------------------------

        if (
            !isNonEmptyString(
                direction.primaryAudienceKey,
            )
        ) {
            failures.push(
                "primaryAudienceKey must be a non-empty string",
            )
        } else if (
            !allowedAudienceKeys.has(
                direction.primaryAudienceKey,
            )
        ) {
            failures.push(
                `primary audience is outside Weekly Audience Focus: ${direction.primaryAudienceKey}`,
            )
        }

        // ---------------------------------------------------------------------
        // Secondary audience
        // ---------------------------------------------------------------------

        if (
            !Array.isArray(
                direction.secondaryAudienceKeys,
            )
        ) {
            failures.push(
                "secondaryAudienceKeys must be an array",
            )
        } else {
            if (
                direction.secondaryAudienceKeys.length >
                1
            ) {
                failures.push(
                    "direction may contain at most one secondary audience",
                )
            }

            for (
                const secondaryKey
                of direction.secondaryAudienceKeys
            ) {
                if (
                    !isNonEmptyString(
                        secondaryKey,
                    )
                ) {
                    failures.push(
                        "secondary audienceKey must be a non-empty string",
                    )

                    continue
                }

                if (
                    secondaryKey ===
                    direction.primaryAudienceKey
                ) {
                    failures.push(
                        "primary audience cannot also be secondary",
                    )
                }

                if (
                    !allowedAudienceKeys.has(
                        secondaryKey,
                    )
                ) {
                    failures.push(
                        `secondary audience is outside Weekly Audience Focus: ${secondaryKey}`,
                    )
                }
            }
        }

        // ---------------------------------------------------------------------
        // Bias
        // ---------------------------------------------------------------------

        if (!BIASES.has(direction.bias)) {
            failures.push(
                `invalid content audience bias: ${direction.bias}`,
            )
        }
    }

    // -------------------------------------------------------------------------
    // Completeness
    // -------------------------------------------------------------------------

    for (const key of requestedDirectionKeys) {
        if (!seenDirectionKeys.has(key)) {
            failures.push(
                `missing contentDirectionKey: ${key}`,
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
    evaluateContentAudienceDirectionProposal,
}