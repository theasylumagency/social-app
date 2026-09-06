import type {
    ConsolidatedRepairBrief,
    DraftEvaluationOutcome,
    EditorialQualityResult,
    GenerationValidationResult,
    RepairInstruction,
    RepairPreservationRequirement,
} from "../../core/domain"

// -----------------------------------------------------------------------------
// Input
// -----------------------------------------------------------------------------

export type ReduceSocialContentDraftEvaluationInput = {
    readonly validation:
    GenerationValidationResult

    readonly quality:
    EditorialQualityResult
}

// -----------------------------------------------------------------------------
// Repair instruction helpers
// -----------------------------------------------------------------------------

function normalizeInstructions(
    source: RepairInstruction["source"],
    instructions: readonly string[] | undefined,
): readonly RepairInstruction[] {
    if (instructions === undefined) {
        return []
    }

    const seen =
        new Set<string>()

    const result:
        RepairInstruction[] =
        []

    for (const rawInstruction of instructions) {
        const instruction =
            rawInstruction.trim()

        if (instruction.length === 0) {
            continue
        }

        const dedupeKey =
            `${source}:${instruction}`

        if (seen.has(dedupeKey)) {
            continue
        }

        seen.add(
            dedupeKey,
        )

        result.push({
            source,
            instruction,
        })
    }

    return result
}

// -----------------------------------------------------------------------------
// Preservation logic
// -----------------------------------------------------------------------------

function hasWeakQualityDimension(
    quality: EditorialQualityResult,
    dimension:
        | "brandFidelity"
        | "specificity"
        | "structure",
): boolean {
    return quality.dimensions.some(
        (item) =>
            item.dimension === dimension &&
            item.rating === "weak",
    )
}

function buildPreservationRequirements(
    validation: GenerationValidationResult,
    quality: EditorialQualityResult,
): readonly RepairPreservationRequirement[] {
    const preserve:
        RepairPreservationRequirement[] =
        [
            "taskIntent",
        ]

    /**
     * Preserve tone unless the quality reviewer explicitly
     * identified brand-fidelity failure.
     */
    if (
        !hasWeakQualityDimension(
            quality,
            "brandFidelity",
        )
    ) {
        preserve.push(
            "tone",
        )
    }

    /**
     * Preserve structure unless structure itself
     * needs repair.
     */
    if (
        !hasWeakQualityDimension(
            quality,
            "structure",
        )
    ) {
        preserve.push(
            "structure",
        )
    }

    /**
     * Safety/evidence repair may legitimately need to reduce
     * or remove specificity.
     *
     * Therefore specificity is preserved only when safety
     * validation already passes and quality does not identify
     * specificity as weak.
     */
    if (
        validation.status === "pass" &&
        !hasWeakQualityDimension(
            quality,
            "specificity",
        )
    ) {
        preserve.push(
            "specificity",
        )
    }

    return preserve
}

// -----------------------------------------------------------------------------
// Repair brief
// -----------------------------------------------------------------------------

function buildRepairBrief(
    validation: GenerationValidationResult,
    quality: EditorialQualityResult,
): ConsolidatedRepairBrief | null {
    const safetyInstructions =
        validation.status === "repairable"
            ? normalizeInstructions(
                "safety",
                validation.repairInstructions,
            )
            : []

    const qualityInstructions =
        quality.status === "revise"
            ? normalizeInstructions(
                "quality",
                quality.repairInstructions,
            )
            : []

    const instructions = [
        ...safetyInstructions,
        ...qualityInstructions,
    ]

    if (instructions.length === 0) {
        return null
    }

    return {
        instructions,

        preserve:
            buildPreservationRequirements(
                validation,
                quality,
            ),
    }
}

// -----------------------------------------------------------------------------
// Reducer
// -----------------------------------------------------------------------------

export function reduceSocialContentDraftEvaluation(
    input: ReduceSocialContentDraftEvaluationInput,
): DraftEvaluationOutcome {
    const {
        validation,
        quality,
    } = input

    // -------------------------------------------------------------------------
    // 1. Hard safety/evidence stop always wins.
    // -------------------------------------------------------------------------

    if (
        validation.status ===
        "blocked"
    ) {
        return {
            status:
                "blocked",
        }
    }

    // -------------------------------------------------------------------------
    // 2. Human review requirement also outranks editorial repair.
    // -------------------------------------------------------------------------

    if (
        validation.status ===
        "requiresReview"
    ) {
        return {
            status:
                "requiresReview",
        }
    }

    // -------------------------------------------------------------------------
    // 3. Any repairable safety issue or editorial revision creates
    //    one consolidated repair brief.
    // -------------------------------------------------------------------------

    const needsRepair =
        validation.status ===
        "repairable" ||
        quality.status ===
        "revise"

    if (needsRepair) {
        const brief =
            buildRepairBrief(
                validation,
                quality,
            )

        /**
         * A component says the draft needs repair,
         * but supplied no actionable repair instruction.
         *
         * Do not guess what to fix.
         */
        if (brief === null) {
            return {
                status:
                    "requiresReview",
            }
        }

        return {
            status:
                "repair",

            brief,
        }
    }

    // -------------------------------------------------------------------------
    // 4. Both independent gates passed.
    // -------------------------------------------------------------------------

    return {
        status:
            "pass",
    }
}