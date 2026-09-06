const AUTHORITY_FIELDS = [
    "id",
    "contentExecutionSpecId",
    "contentBriefId",
    "contentId",
    "createdAt",
    "updatedAt",
    "schedule",
    "publishAt",
    "state",
    "accountId",
]

const COPY_FIELDS = [
    "headline",
    "hook",
    "caption",
    "body",
    "script",
    "narration",
    "slides",
    "frames",
    "hashtags",
    "ctaCopy",
]

const VALID_DEPTHS =
    new Set([
        "compact",
        "standard",
        "deep",
    ])

const VALID_VISUAL_DEPENDENCIES =
    new Set([
        "none",
        "supporting",
        "essential",
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

function evaluateContentExecutionSpecProposal(
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

    const specs =
        output.executionSpecs

    if (
        !Array.isArray(specs) ||
        specs.length < 1 ||
        specs.length > 2
    ) {
        return {
            passed: false,
            failures: [
                "executionSpecs must contain 1-2 specs",
            ],
        }
    }

    const eligibleChannels =
        new Set(
            input?.eligibleChannels ?? [],
        )

    const eligibleContentModes =
        new Set(
            input?.eligibleContentModes ?? [],
        )

    const policyByChannel =
        new Map(
            (input?.channelPolicies ?? [])
                .map(
                    (policy) => [
                        policy.channel,
                        policy,
                    ],
                ),
        )

    const seenChannels =
        new Set()

    for (const spec of specs) {
        if (
            spec === null ||
            typeof spec !== "object" ||
            Array.isArray(spec)
        ) {
            failures.push(
                "each execution spec must be an object",
            )

            continue
        }

        for (
            const field
            of AUTHORITY_FIELDS
        ) {
            if (
                Object.prototype.hasOwnProperty.call(
                    spec,
                    field,
                )
            ) {
                failures.push(
                    `execution spec contains authority field: ${field}`,
                )
            }
        }

        for (
            const field
            of COPY_FIELDS
        ) {
            if (
                Object.prototype.hasOwnProperty.call(
                    spec,
                    field,
                )
            ) {
                failures.push(
                    `execution spec contains copy field: ${field}`,
                )
            }
        }

        if (
            !eligibleChannels.has(
                spec.channel,
            )
        ) {
            failures.push(
                `execution spec uses ineligible channel: ${spec.channel}`,
            )
        }

        if (
            seenChannels.has(
                spec.channel,
            )
        ) {
            failures.push(
                `duplicate execution channel: ${spec.channel}`,
            )
        }

        seenChannels.add(
            spec.channel,
        )

        if (
            !eligibleContentModes.has(
                spec.contentMode,
            )
        ) {
            failures.push(
                `execution spec uses ineligible content mode: ${spec.contentMode}`,
            )
        }

        const policy =
            policyByChannel.get(
                spec.channel,
            )

        if (policy) {
            if (
                !policy.supportedFormats.includes(
                    spec.format,
                )
            ) {
                failures.push(
                    `unsupported format ${spec.format} for channel ${spec.channel}`,
                )
            }

            if (
                !policy.supportedModes.includes(
                    spec.contentMode,
                )
            ) {
                failures.push(
                    `unsupported content mode ${spec.contentMode} for channel ${spec.channel}`,
                )
            }
        }

        if (
            !VALID_DEPTHS.has(
                spec.depth,
            )
        ) {
            failures.push(
                `invalid execution depth: ${spec.depth}`,
            )
        }

        if (
            !VALID_VISUAL_DEPENDENCIES.has(
                spec.visualDependency,
            )
        ) {
            failures.push(
                `invalid visual dependency: ${spec.visualDependency}`,
            )
        }

        if (
            !isStringArray(
                spec.executionGuidance,
            )
        ) {
            failures.push(
                "executionGuidance must be a string array",
            )
        }

        if (
            !isStringArray(
                spec.constraints,
            )
        ) {
            failures.push(
                "constraints must be a string array",
            )
        }

        if (
            !isNonEmptyString(
                spec.rationale,
            )
        ) {
            failures.push(
                "rationale must be a non-empty string",
            )
        }

        if (
            spec.contentMode ===
            "social.proofLed" &&
            input?.capabilities
                ?.eligibleProof !== true
        ) {
            failures.push(
                "proofLed mode requires eligibleProof capability",
            )
        }

        if (
            spec.contentMode ===
            "social.directOffer" &&
            input?.capabilities
                ?.publicOfferFacts !== true
        ) {
            failures.push(
                "directOffer mode requires publicOfferFacts capability",
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
    evaluateContentExecutionSpecProposal,
}