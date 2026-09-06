const COMPLEXITY = new Set([
    "plain",
    "plainWithProfessionalDepth",
    "technicalWhenExplained",
    "expert",
])

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

const SALES_PRESSURE = new Set([
    "low",
    "moderate",
    "high",
])

const AUTHORITY_FIELDS = [
    "id",
    "brandId",
    "profileIds",
    "landscapeVersion",
    "generatedAt",
    "createdAt",
    "updatedAt",
    "founderStance",
    "influence",
    "weeklyStrategy",
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

function evaluateCommunicationEnvelopeProposal(
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
        output.envelope === null ||
        typeof output.envelope !== "object" ||
        Array.isArray(output.envelope)
    ) {
        return {
            passed: false,
            failures: [
                "envelope must be an object",
            ],
        }
    }

    const envelope = output.envelope

    for (const field of AUTHORITY_FIELDS) {
        if (
            Object.prototype.hasOwnProperty.call(
                envelope,
                field,
            )
        ) {
            failures.push(
                `envelope contains authority field: ${field}`,
            )
        }
    }

    if (!COMPLEXITY.has(envelope.complexity)) {
        failures.push(
            "envelope.complexity is invalid",
        )
    }

    if (
        !ASSUMED_KNOWLEDGE.has(
            envelope.assumedKnowledge,
        )
    ) {
        failures.push(
            "envelope.assumedKnowledge is invalid",
        )
    }

    if (
        !EXPLANATION_DEPTH.has(
            envelope.explanationDepth,
        )
    ) {
        failures.push(
            "envelope.explanationDepth is invalid",
        )
    }

    if (!CTA_STYLES.has(envelope.ctaStyle)) {
        failures.push(
            "envelope.ctaStyle is invalid",
        )
    }

    if (
        !SALES_PRESSURE.has(
            envelope.salesPressure,
        )
    ) {
        failures.push(
            "envelope.salesPressure is invalid",
        )
    }

    for (const field of [
        "toneRange",
        "framingRules",
        "preferredStructures",
        "terminologyRules",
        "proofStyle",
        "inclusivityRules",
        "trustMechanisms",
        "avoid",
    ]) {
        if (!isStringArray(envelope[field])) {
            failures.push(
                `envelope.${field} must be a string array`,
            )
        }
    }

    if (!isNonEmptyString(envelope.rationale)) {
        failures.push(
            "envelope.rationale must be a non-empty string",
        )
    }

    return {
        passed: failures.length === 0,
        failures,
    }
}

module.exports = {
    evaluateCommunicationEnvelopeProposal,
}