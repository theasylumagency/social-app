const ASSUMED_KNOWLEDGE = new Set([
    "none",
    "basic",
    "informed",
    "expert",
])

const EXPLANATION_DEPTH = new Set([
    "light",
    "balanced",
    "deep",
])

const CTA_STYLES = new Set([
    "informational",
    "lowPressure",
    "consultative",
    "directWhenJustified",
])

const AUTHORITY_FIELDS = [
    "id",
    "brandId",
    "landscapeVersion",
    "influence",
    "founderStance",
    "lifecycle",
    "generatedAt",
    "createdAt",
    "updatedAt",
    "communicationEnvelope",
    "weeklyStrategy",
]

function isNonEmptyString(value) {
    return typeof value === "string" && value.trim().length > 0
}

function isStringArray(value) {
    return (
        Array.isArray(value) &&
        value.every((item) => isNonEmptyString(item))
    )
}

function evaluateCommunicationProfileProposal(output, input) {
    const failures = []

    if (
        output === null ||
        typeof output !== "object" ||
        Array.isArray(output)
    ) {
        return {
            passed: false,
            failures: ["output must be an object"],
        }
    }

    if (!Array.isArray(output.profiles)) {
        return {
            passed: false,
            failures: ["profiles must be an array"],
        }
    }

    const expectedKeys = new Set(
        (input.audiences ?? []).map(
            (audience) => audience.audienceKey,
        ),
    )

    const seenKeys = new Set()

    output.profiles.forEach((profile, index) => {
        const prefix = `profile[${index}]`

        if (
            profile === null ||
            typeof profile !== "object" ||
            Array.isArray(profile)
        ) {
            failures.push(`${prefix} must be an object`)
            return
        }

        for (const field of AUTHORITY_FIELDS) {
            if (
                Object.prototype.hasOwnProperty.call(
                    profile,
                    field,
                )
            ) {
                failures.push(
                    `${prefix} contains authority field: ${field}`,
                )
            }
        }

        if (!isNonEmptyString(profile.audienceKey)) {
            failures.push(
                `${prefix}.audienceKey must be a non-empty string`,
            )
        } else {
            if (!expectedKeys.has(profile.audienceKey)) {
                failures.push(
                    `${prefix} references unknown audienceKey: ${profile.audienceKey}`,
                )
            }

            if (seenKeys.has(profile.audienceKey)) {
                failures.push(
                    `${prefix} duplicates audienceKey: ${profile.audienceKey}`,
                )
            }

            seenKeys.add(profile.audienceKey)
        }

        if (!isNonEmptyString(profile.communicationGoal)) {
            failures.push(
                `${prefix}.communicationGoal must be a non-empty string`,
            )
        }

        for (const field of [
            "toneAdjustments",
            "preferredFraming",
            "usefulContentAngles",
            "trustMechanisms",
            "avoid",
        ]) {
            if (!isStringArray(profile[field])) {
                failures.push(
                    `${prefix}.${field} must be a string array`,
                )
            }
        }

        if (
            !ASSUMED_KNOWLEDGE.has(
                profile.assumedKnowledge,
            )
        ) {
            failures.push(
                `${prefix}.assumedKnowledge is invalid`,
            )
        }

        if (
            !EXPLANATION_DEPTH.has(
                profile.explanationDepth,
            )
        ) {
            failures.push(
                `${prefix}.explanationDepth is invalid`,
            )
        }

        if (!CTA_STYLES.has(profile.ctaStyle)) {
            failures.push(
                `${prefix}.ctaStyle is invalid`,
            )
        }

        if (!isNonEmptyString(profile.rationale)) {
            failures.push(
                `${prefix}.rationale must be a non-empty string`,
            )
        }
    })

    for (const expectedKey of expectedKeys) {
        if (!seenKeys.has(expectedKey)) {
            failures.push(
                `missing profile for audienceKey: ${expectedKey}`,
            )
        }
    }

    if (output.profiles.length !== expectedKeys.size) {
        failures.push(
            `expected exactly ${expectedKeys.size} profiles`,
        )
    }

    return {
        passed: failures.length === 0,
        failures,
    }
}

module.exports = {
    evaluateCommunicationProfileProposal,
}