const AUTHORITY_FIELDS = [
    "id",
    "brandId",
    "generatedAt",
    "createdAt",
    "updatedAt",
    "weeklyAudienceFocus",
    "contentDirections",
    "experiment",
    "schedule",
    "posts",
]

const ACTIVITY_PHRASES = [
    "publish",
    "posting",
    "post more",
    "increase posting",
    "create reels",
    "more reels",
    "more posts",
    "post consistently",
]

function isNonEmptyString(value) {
    return (
        typeof value === "string" &&
        value.trim().length > 0
    )
}

function isStringArray(value) {
    return (
        Array.isArray(value) &&
        value.every((item) =>
            isNonEmptyString(item),
        )
    )
}

function evaluateWeeklyObjectiveProposal(
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
        output.weeklyObjective === null ||
        typeof output.weeklyObjective !== "object" ||
        Array.isArray(output.weeklyObjective)
    ) {
        return {
            passed: false,
            failures: [
                "weeklyObjective must be an object",
            ],
        }
    }

    const weeklyObjective =
        output.weeklyObjective

    for (const field of AUTHORITY_FIELDS) {
        if (
            Object.prototype.hasOwnProperty.call(
                weeklyObjective,
                field,
            )
        ) {
            failures.push(
                `weeklyObjective contains authority field: ${field}`,
            )
        }
    }

    if (
        !isNonEmptyString(
            weeklyObjective.objective,
        )
    ) {
        failures.push(
            "weeklyObjective.objective must be a non-empty string",
        )
    } else {
        const normalized =
            weeklyObjective.objective
                .toLowerCase()

        for (const phrase of ACTIVITY_PHRASES) {
            if (normalized.includes(phrase)) {
                failures.push(
                    `weekly objective appears activity-based: ${phrase}`,
                )
            }
        }
    }

    if (
        !isNonEmptyString(
            weeklyObjective.rationale,
        )
    ) {
        failures.push(
            "weeklyObjective.rationale must be a non-empty string",
        )
    }

    if (
        !isStringArray(
            weeklyObjective.deliberateOmissions,
        )
    ) {
        failures.push(
            "weeklyObjective.deliberateOmissions must be a string array",
        )
    }

    return {
        passed:
            failures.length === 0,

        failures,
    }
}

module.exports = {
    evaluateWeeklyObjectiveProposal,
}