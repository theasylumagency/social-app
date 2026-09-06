const AUTHORITY_FIELDS = [
    "id",
    "brandId",
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
    "weeklyPlan",
    "contentDirections",
]

function isNonEmptyString(value) {
    return (
        typeof value === "string" &&
        value.trim().length > 0
    )
}

function evaluateWeeklyAudienceFocusProposal(
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

    if (
        output.focus === null ||
        typeof output.focus !== "object" ||
        Array.isArray(output.focus)
    ) {
        return {
            passed: false,
            failures: [
                "focus must be an object",
            ],
        }
    }

    const focus = output.focus

    for (const field of AUTHORITY_FIELDS) {
        if (
            Object.prototype.hasOwnProperty.call(
                focus,
                field,
            )
        ) {
            failures.push(
                `focus contains authority field: ${field}`,
            )
        }
    }

    const audiences =
        Array.isArray(input.audiences)
            ? input.audiences
            : []

    const audienceByKey = new Map(
        audiences.map((audience) => [
            audience.audienceKey,
            audience,
        ]),
    )

    // -------------------------------------------------------------------------
    // Primary
    // -------------------------------------------------------------------------

    if (
        !isNonEmptyString(
            focus.primaryAudienceKey,
        )
    ) {
        failures.push(
            "focus.primaryAudienceKey must be a non-empty string",
        )
    } else {
        const primary =
            audienceByKey.get(
                focus.primaryAudienceKey,
            )

        if (!primary) {
            failures.push(
                `unknown primary audienceKey: ${focus.primaryAudienceKey}`,
            )
        } else if (
            primary.influence === "none"
        ) {
            failures.push(
                `primary audienceKey has none influence: ${focus.primaryAudienceKey}`,
            )
        }
    }

    // -------------------------------------------------------------------------
    // Secondary
    // -------------------------------------------------------------------------

    if (
        !Array.isArray(
            focus.secondaryAudienceKeys,
        )
    ) {
        failures.push(
            "focus.secondaryAudienceKeys must be an array",
        )
    } else {
        if (
            focus.secondaryAudienceKeys.length > 1
        ) {
            failures.push(
                "focus may contain at most one secondary audience",
            )
        }

        for (
            const secondaryKey
            of focus.secondaryAudienceKeys
        ) {
            if (!isNonEmptyString(secondaryKey)) {
                failures.push(
                    "secondary audienceKey must be a non-empty string",
                )

                continue
            }

            if (
                secondaryKey ===
                focus.primaryAudienceKey
            ) {
                failures.push(
                    "primary audience cannot also be secondary",
                )
            }

            const secondary =
                audienceByKey.get(
                    secondaryKey,
                )

            if (!secondary) {
                failures.push(
                    `unknown secondary audienceKey: ${secondaryKey}`,
                )
            } else if (
                secondary.influence === "none"
            ) {
                failures.push(
                    `secondary audienceKey has none influence: ${secondaryKey}`,
                )
            }
        }
    }

    // -------------------------------------------------------------------------
    // Rationale
    // -------------------------------------------------------------------------

    if (
        !isNonEmptyString(
            focus.rationale,
        )
    ) {
        failures.push(
            "focus.rationale must be a non-empty string",
        )
    }

    return {
        passed:
            failures.length === 0,

        failures,
    }
}

module.exports = {
    evaluateWeeklyAudienceFocusProposal,
}