const {
    evaluateContentWriterProposal,
} = require(
    "./content-writer-deterministic-evaluator.cjs",
)

const ALLOWED_REPAIR_SOURCES =
    new Set([
        "safety",
        "quality",
    ])

const ALLOWED_PRESERVATION_REQUIREMENTS =
    new Set([
        "tone",
        "taskIntent",
        "specificity",
        "structure",
    ])

function isNonEmptyString(
    value,
) {
    return (
        typeof value === "string" &&
        value.trim().length > 0
    )
}

function validateRepairBrief(
    repairBrief,
    failures,
) {
    if (
        repairBrief === null ||
        typeof repairBrief !== "object" ||
        Array.isArray(repairBrief)
    ) {
        failures.push(
            "repairBrief must be an object",
        )

        return
    }

    if (
        !Array.isArray(
            repairBrief.instructions,
        ) ||
        repairBrief.instructions.length === 0
    ) {
        failures.push(
            "repairBrief.instructions must contain at least one instruction",
        )
    } else {
        for (
            const instruction
            of repairBrief.instructions
        ) {
            if (
                instruction === null ||
                typeof instruction !== "object" ||
                Array.isArray(instruction)
            ) {
                failures.push(
                    "each repair instruction must be an object",
                )

                continue
            }

            if (
                !ALLOWED_REPAIR_SOURCES.has(
                    instruction.source,
                )
            ) {
                failures.push(
                    `unsupported repair instruction source: ${instruction.source}`,
                )
            }

            if (
                !isNonEmptyString(
                    instruction.instruction,
                )
            ) {
                failures.push(
                    "repair instruction must be a non-empty string",
                )
            }
        }
    }

    if (
        !Array.isArray(
            repairBrief.preserve,
        )
    ) {
        failures.push(
            "repairBrief.preserve must be an array",
        )

        return
    }

    const seen =
        new Set()

    for (
        const requirement
        of repairBrief.preserve
    ) {
        if (
            !ALLOWED_PRESERVATION_REQUIREMENTS.has(
                requirement,
            )
        ) {
            failures.push(
                `unsupported preservation requirement: ${requirement}`,
            )

            continue
        }

        if (
            seen.has(
                requirement,
            )
        ) {
            failures.push(
                `duplicate preservation requirement: ${requirement}`,
            )

            continue
        }

        seen.add(
            requirement,
        )
    }
}

function validateRepairLineage(
    input,
    failures,
) {
    const previousDraft =
        input?.previousDraft

    if (
        previousDraft === null ||
        typeof previousDraft !== "object" ||
        Array.isArray(previousDraft)
    ) {
        failures.push(
            "previousDraft must be an object",
        )

        return
    }

    const executionFormat =
        input?.contentExecutionSpec
            ?.format

    if (
        previousDraft.format !==
        executionFormat
    ) {
        failures.push(
            "previousDraft format must match Content Execution Spec format",
        )
    }

    if (
        !Number.isInteger(
            previousDraft.version,
        ) ||
        previousDraft.version < 1
    ) {
        failures.push(
            "previousDraft version must be a positive integer",
        )
    }
}

function validatePreservedStructure(
    output,
    input,
    failures,
) {
    const preserve =
        input?.repairBrief
            ?.preserve

    if (
        !Array.isArray(preserve) ||
        !preserve.includes(
            "structure",
        )
    ) {
        return
    }

    const format =
        input?.contentExecutionSpec
            ?.format

    if (
        format !== "carousel" &&
        format !== "story"
    ) {
        return
    }

    const previousFrames =
        input?.previousDraft
            ?.frames

    const repairedFrames =
        output?.draft
            ?.frames

    if (
        !Array.isArray(previousFrames) ||
        !Array.isArray(repairedFrames)
    ) {
        return
    }

    if (
        repairedFrames.length !==
        previousFrames.length
    ) {
        failures.push(
            "repair must preserve frame count when structure preservation is required",
        )
    }
}

function evaluateContentRepairProposal(
    output,
    input,
) {
    const failures = []

    /**
     * Repair output must first satisfy
     * the exact same transport rules
     * as ordinary Writer output.
     */
    const writerEvaluation =
        evaluateContentWriterProposal(
            output,
            input,
        )

    failures.push(
        ...writerEvaluation.failures,
    )

    validateRepairBrief(
        input?.repairBrief,
        failures,
    )

    validateRepairLineage(
        input,
        failures,
    )

    validatePreservedStructure(
        output,
        input,
        failures,
    )

    return {
        passed:
            failures.length === 0,

        failures,
    }
}

module.exports = {
    evaluateContentRepairProposal,
}