import type {
    DraftEvaluationOutcome,
    EditorialQualityContext,
    GenerationValidationContext,
} from "../../core/domain"

import type {
    ContentBrief,
} from "./content-brief"

import type {
    ContentExecutionSpec,
} from "./content-execution-spec"

import type {
    SocialContentDraft,
    SocialContentDraftId,
} from "./content-draft"

import type {
    SocialContentDraftClaimScanner,
    SocialContentDraftGenerationValidator,
    SocialContentDraftValidationRun,
} from "./content-draft-validation"

import {
    validateSocialContentDraft,
} from "./content-draft-validation"

import type {
    SocialContentDraftEditorialQualityReviewer,
    SocialContentDraftQualityRun,
} from "./content-draft-quality"

import {
    assertSocialContentDraftQualityProvenance,
    evaluateSocialContentDraftQuality,
} from "./content-draft-quality"

import {
    reduceSocialContentDraftEvaluation,
} from "./content-draft-evaluation"

// -----------------------------------------------------------------------------
// Dependencies
// -----------------------------------------------------------------------------

export type SocialContentDraftEvaluationDependencies = {
    readonly scanClaims:
    SocialContentDraftClaimScanner

    readonly validateGeneration:
    SocialContentDraftGenerationValidator

    readonly reviewEditorialQuality:
    SocialContentDraftEditorialQualityReviewer
}

// -----------------------------------------------------------------------------
// Input
// -----------------------------------------------------------------------------

export type EvaluateSocialContentDraftInput = {
    readonly draft:
    SocialContentDraft

    readonly contentBrief:
    ContentBrief

    readonly contentExecutionSpec:
    ContentExecutionSpec

    readonly validationContext:
    GenerationValidationContext

    readonly qualityContext:
    EditorialQualityContext
}

// -----------------------------------------------------------------------------
// Result
// -----------------------------------------------------------------------------

export type SocialContentDraftEvaluationRun = {
    readonly contentDraftId:
    SocialContentDraftId

    readonly version:
    number

    readonly validation:
    SocialContentDraftValidationRun

    /**
     * Null only when safety/evidence validation produced
     * a terminal outcome before editorial review was useful.
     */
    readonly quality:
    SocialContentDraftQualityRun | null

    readonly outcome:
    DraftEvaluationOutcome
}

// -----------------------------------------------------------------------------
// Orchestration
// -----------------------------------------------------------------------------

export async function evaluateSocialContentDraft(
    input: EvaluateSocialContentDraftInput,
    dependencies: SocialContentDraftEvaluationDependencies,
): Promise<SocialContentDraftEvaluationRun> {
    /**
     * Structural provenance is checked before any external /
     * model-backed evaluator runs.
     */
    assertSocialContentDraftQualityProvenance({
        draft:
            input.draft,

        contentBrief:
            input.contentBrief,

        contentExecutionSpec:
            input.contentExecutionSpec,
    })

    // -------------------------------------------------------------------------
    // 1. Safety / evidence validation
    // -------------------------------------------------------------------------

    const validation =
        await validateSocialContentDraft(
            {
                draft:
                    input.draft,

                validationContext:
                    input.validationContext,
            },

            {
                scanClaims:
                    dependencies.scanClaims,

                validateGeneration:
                    dependencies.validateGeneration,
            },
        )

    // -------------------------------------------------------------------------
    // 2. Terminal safety outcomes short-circuit editorial review.
    //
    // Quality cannot overturn either outcome, so running another evaluator
    // would add cost and noise without changing the decision.
    // -------------------------------------------------------------------------

    if (
        validation.validation.status ===
        "blocked"
    ) {
        return {
            contentDraftId:
                input.draft.id,

            version:
                input.draft.version,

            validation,

            quality:
                null,

            outcome: {
                status:
                    "blocked",
            },
        }
    }

    if (
        validation.validation.status ===
        "requiresReview"
    ) {
        return {
            contentDraftId:
                input.draft.id,

            version:
                input.draft.version,

            validation,

            quality:
                null,

            outcome: {
                status:
                    "requiresReview",
            },
        }
    }

    // -------------------------------------------------------------------------
    // 3. Editorial quality
    //
    // At this point validation is either:
    // - pass
    // - repairable
    //
    // Quality is useful in both cases because repair instructions may need
    // consolidation.
    // -------------------------------------------------------------------------

    const quality =
        await evaluateSocialContentDraftQuality(
            {
                draft:
                    input.draft,

                contentBrief:
                    input.contentBrief,

                contentExecutionSpec:
                    input.contentExecutionSpec,

                qualityContext:
                    input.qualityContext,
            },

            dependencies.reviewEditorialQuality,
        )

    // -------------------------------------------------------------------------
    // 4. Deterministic reduction
    // -------------------------------------------------------------------------

    const outcome =
        reduceSocialContentDraftEvaluation({
            validation:
                validation.validation,

            quality:
                quality.quality,
        })

    return {
        contentDraftId:
            input.draft.id,

        version:
            input.draft.version,

        validation,

        quality,

        outcome,
    }
}