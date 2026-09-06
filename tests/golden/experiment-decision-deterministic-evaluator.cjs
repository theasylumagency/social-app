const AUTHORITY_FIELDS = [
    "id",
    "experimentId",
    "brandId",
    "weekId",
    "generatedAt",
    "createdAt",
    "updatedAt",
    "postIds",
    "schedule",
    "publishAt",
    "finalLearning",
    "acceptedLearning",
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

function evaluateExperimentDecisionProposal(
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

    const decision =
        output.experimentDecision

    if (
        decision === null ||
        typeof decision !== "object" ||
        Array.isArray(decision)
    ) {
        return {
            passed: false,
            failures: [
                "experimentDecision must be an object",
            ],
        }
    }

    for (const field of AUTHORITY_FIELDS) {
        if (
            Object.prototype.hasOwnProperty.call(
                decision,
                field,
            )
        ) {
            failures.push(
                `experimentDecision contains authority field: ${field}`,
            )
        }
    }

    if (
        decision.decision === "noExperiment"
    ) {
        const experiment =
            decision.experiment

        if (
            experiment === null ||
            typeof experiment !== "object" ||
            Array.isArray(experiment)
        ) {
            failures.push(
                "noExperiment decision must include the structured experiment object",
            )

            return {
                passed:
                    failures.length === 0,

                failures,
            }
        }

        for (const field of [
            "hypothesis",
            "variable",
            "comparison",
            "learningSignal",
        ]) {
            if (experiment[field] !== null) {
                failures.push(
                    `noExperiment requires experiment.${field} to be null`,
                )
            }
        }

        if (
            !Array.isArray(experiment.guardrails) ||
            experiment.guardrails.length !== 0
        ) {
            failures.push(
                "noExperiment requires experiment.guardrails to be an empty array",
            )
        }

        return {
            passed:
                failures.length === 0,

            failures,
        }
    }

    if (
        decision.decision === "experiment"
    ) {
        const experiment =
            decision.experiment

        if (
            experiment === null ||
            typeof experiment !== "object" ||
            Array.isArray(experiment)
        ) {
            failures.push(
                "experiment decision must include an experiment object",
            )

            return {
                passed:
                    failures.length === 0,

                failures,
            }
        }

        for (const field of AUTHORITY_FIELDS) {
            if (
                Object.prototype.hasOwnProperty.call(
                    experiment,
                    field,
                )
            ) {
                failures.push(
                    `experiment contains authority field: ${field}`,
                )
            }
        }

        for (const field of [
            "hypothesis",
            "variable",
            "comparison",
            "learningSignal",
        ]) {
            if (
                !isNonEmptyString(
                    experiment[field],
                )
            ) {
                failures.push(
                    `experiment.${field} must be a non-empty string`,
                )
            }
        }

        if (
            !isStringArray(
                experiment.guardrails,
            )
        ) {
            failures.push(
                "experiment.guardrails must be a string array",
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
    evaluateExperimentDecisionProposal,
}