const AUTHORITY_FIELDS = [
    "id",
    "contentBriefId",
    "weeklyPlanId",
    "weeklyContentDirectionId",
    "contentId",
    "audienceDirection",
    "createdAt",
    "updatedAt",
    "order",
    "schedule",
    "publishAt",
    "state",
]

const COPY_FIELDS = [
    "headline",
    "hook",
    "caption",
    "body",
    "script",
    "slides",
    "hashtags",
    "visualDirection",
    "format",
    "platform",
]

const VALID_EVIDENCE_MODES =
    new Set([
        "noProofNeeded",
        "evidenceSupported",
        "proofRequired",
    ])

const VALID_CTA_INTENTS =
    new Set([
        "none",
        "inform",
        "encourageReflection",
        "inviteQuestion",
        "inviteConsultation",
        "directAction",
    ])

function isNonEmptyString(value) {
    return (
        typeof value === "string" &&
        value.trim().length > 0
    )
}

function isStringArray(value) {
    return (
        Array.isArray(value) &&
        value.every(
            (item) =>
                isNonEmptyString(item),
        )
    )
}

function evaluateContentBriefProposal(
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

    const brief =
        output.contentBrief

    if (
        brief === null ||
        typeof brief !== "object" ||
        Array.isArray(brief)
    ) {
        return {
            passed: false,
            failures: [
                "contentBrief must be an object",
            ],
        }
    }

    for (const field of AUTHORITY_FIELDS) {
        if (
            Object.prototype.hasOwnProperty.call(
                brief,
                field,
            )
        ) {
            failures.push(
                `contentBrief contains authority field: ${field}`,
            )
        }
    }

    for (const field of COPY_FIELDS) {
        if (
            Object.prototype.hasOwnProperty.call(
                brief,
                field,
            )
        ) {
            failures.push(
                `contentBrief contains copy/execution field: ${field}`,
            )
        }
    }

    for (const field of [
        "communicationJob",
        "keyTakeaway",
        "rationale",
    ]) {
        if (
            !isNonEmptyString(
                brief[field],
            )
        ) {
            failures.push(
                `contentBrief.${field} must be a non-empty string`,
            )
        }
    }

    if (
        !Array.isArray(
            brief.supportingPoints,
        ) ||
        brief.supportingPoints.length < 2 ||
        brief.supportingPoints.length > 5 ||
        !brief.supportingPoints.every(
            (item) =>
                isNonEmptyString(item),
        )
    ) {
        failures.push(
            "contentBrief.supportingPoints must contain 2-5 non-empty strings",
        )
    }

    if (
        !VALID_EVIDENCE_MODES.has(
            brief.evidenceMode,
        )
    ) {
        failures.push(
            "contentBrief.evidenceMode is invalid",
        )
    }

    if (
        !Array.isArray(
            brief.evidenceKeys,
        ) ||
        !brief.evidenceKeys.every(
            (key) =>
                isNonEmptyString(key),
        )
    ) {
        failures.push(
            "contentBrief.evidenceKeys must be a string array",
        )
    }

    if (
        !VALID_CTA_INTENTS.has(
            brief.ctaIntent,
        )
    ) {
        failures.push(
            "contentBrief.ctaIntent is invalid",
        )
    }

    if (
        !Array.isArray(
            brief.constraints,
        ) ||
        !brief.constraints.every(
            (item) =>
                isNonEmptyString(item),
        )
    ) {
        failures.push(
            "contentBrief.constraints must be a string array",
        )
    }

    if (
        !Array.isArray(
            brief.mustNotSay,
        ) ||
        !brief.mustNotSay.every(
            (item) =>
                isNonEmptyString(item),
        )
    ) {
        failures.push(
            "contentBrief.mustNotSay must be a string array",
        )
    }

    const suppliedEvidenceKeys =
        new Set(
            Array.isArray(input?.evidence)
                ? input.evidence
                    .map(
                        (item) =>
                            item?.evidenceKey,
                    )
                    .filter(
                        (key) =>
                            typeof key ===
                            "string",
                    )
                : [],
        )

    for (
        const key
        of brief.evidenceKeys ?? []
    ) {
        if (
            !suppliedEvidenceKeys.has(
                key,
            )
        ) {
            failures.push(
                `contentBrief references unknown evidence key: ${key}`,
            )
        }
    }

    if (
        brief.evidenceMode ===
        "noProofNeeded" &&
        brief.evidenceKeys.length > 0
    ) {
        failures.push(
            "noProofNeeded should not reference evidence keys",
        )
    }

    return {
        passed:
            failures.length === 0,

        failures,
    }
}

module.exports = {
    evaluateContentBriefProposal,
}