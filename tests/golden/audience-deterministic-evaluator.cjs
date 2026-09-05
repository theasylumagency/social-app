const ALLOWED_STAGES = new Set([
    "unaware",
    "problemAware",
    "solutionAware",
    "providerComparison",
    "decisionReady",
    "existingCustomer",
    "returningCustomer",
])

const ALLOWED_CONFIDENCE = new Set([
    "tentative",
    "reasonable",
    "strong",
])

function isNonEmptyString(value) {
    return typeof value === "string" && value.trim().length > 0
}

function isStringArray(value) {
    return (
        Array.isArray(value) &&
        value.every((item) => isNonEmptyString(item))
    )
}

function evaluateAudienceProposal(output, input) {
    const failures = []

    if (
        output === null ||
        typeof output !== "object" ||
        !Array.isArray(output.segments)
    ) {
        return {
            passed: false,
            failures: ["segments must be an array"],
        }
    }

    if (
        output.segments.length < 1 ||
        output.segments.length > 5
    ) {
        failures.push("segment count must be between 1 and 5")
    }

    const knownOffers = new Set(
        input.offers.map((offer) => offer.name),
    )

    const knownEvidence = new Set(
        input.evidenceSummary.map(
            (evidence) => evidence.evidenceKey,
        ),
    )

    for (const [index, segment] of output.segments.entries()) {
        const prefix = `segment[${index}]`

        if (!isNonEmptyString(segment.name)) {
            failures.push(`${prefix}.name is required`)
        }

        if (!isNonEmptyString(segment.buyingSituation)) {
            failures.push(
                `${prefix}.buyingSituation is required`,
            )
        }

        if (!isNonEmptyString(segment.currentNeed)) {
            failures.push(`${prefix}.currentNeed is required`)
        }

        if (!isStringArray(segment.relevantOffers)) {
            failures.push(
                `${prefix}.relevantOffers must be a string array`,
            )
        } else {
            for (const offer of segment.relevantOffers) {
                if (!knownOffers.has(offer)) {
                    failures.push(
                        `${prefix} references unknown offer: ${offer}`,
                    )
                }
            }
        }

        if (!isStringArray(segment.mainQuestions)) {
            failures.push(
                `${prefix}.mainQuestions must be a string array`,
            )
        }

        if (!isStringArray(segment.likelyBarriers)) {
            failures.push(
                `${prefix}.likelyBarriers must be a string array`,
            )
        }

        if (!ALLOWED_STAGES.has(segment.decisionStage)) {
            failures.push(
                `${prefix}.decisionStage is invalid`,
            )
        }

        if (!Array.isArray(segment.evidenceKeys)) {
            failures.push(
                `${prefix}.evidenceKeys must be an array`,
            )
        } else {
            // Every supplied evidence key must exist in the input.
            for (const key of segment.evidenceKeys) {
                if (!knownEvidence.has(key)) {
                    failures.push(
                        `${prefix} references unknown evidence: ${key}`,
                    )
                }
            }

            // A hypothesis without direct evidence is allowed only as an
            // explicitly tentative working hypothesis.
            if (segment.evidenceKeys.length === 0) {
                if (segment.confidenceBand !== "tentative") {
                    failures.push(
                        `${prefix} without evidence must use tentative confidence`,
                    )
                }

                if (
                    !isStringArray(segment.assumptions) ||
                    segment.assumptions.length === 0
                ) {
                    failures.push(
                        `${prefix} without evidence must state its assumptions`,
                    )
                }
            }
        }
        if (!isNonEmptyString(segment.rationale)) {
            failures.push(`${prefix}.rationale is required`)
        }

        if (!isStringArray(segment.assumptions)) {
            failures.push(
                `${prefix}.assumptions must be a string array`,
            )
        }

        if (
            !ALLOWED_CONFIDENCE.has(
                segment.confidenceBand,
            )
        ) {
            failures.push(
                `${prefix}.confidenceBand is invalid`,
            )
        }

        const forbiddenAuthorityFields = [
            "id",
            "brandId",
            "lifecycle",
            "founderStance",
            "influence",
            "createdAt",
            "updatedAt",
        ]

        for (const field of forbiddenAuthorityFields) {
            if (field in segment) {
                failures.push(
                    `${prefix} must not contain authority field: ${field}`,
                )
            }
        }
    }

    return {
        passed: failures.length === 0,
        failures,
    }
}

module.exports = {
    evaluateAudienceProposal,
}