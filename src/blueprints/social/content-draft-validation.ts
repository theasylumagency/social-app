import type {
    ClaimScannerInput,
    ClaimScanResult,
    GenerationValidationContext,
    GenerationValidationResult,
    GenerationValidatorInput,
} from "../../core/domain"

import type {
    SocialContentDraft,
    SocialContentDraftId,
} from "./content-draft"

import type {
    SocialContentDraftTextProjection,
} from "./content-draft-text-projection"

import {
    projectSocialContentDraftText,
} from "./content-draft-text-projection"

// -----------------------------------------------------------------------------
// Dependencies
//
// Scanner and validator implementations live outside the blueprint.
//
// This orchestration only defines the required contract.
// -----------------------------------------------------------------------------

export type SocialContentDraftClaimScanner = (
    input: ClaimScannerInput,
) => Promise<ClaimScanResult>

export type SocialContentDraftGenerationValidator = (
    input: GenerationValidatorInput,
) => Promise<GenerationValidationResult>

export type SocialContentDraftValidationDependencies = {
    readonly scanClaims:
    SocialContentDraftClaimScanner

    readonly validateGeneration:
    SocialContentDraftGenerationValidator
}

// -----------------------------------------------------------------------------
// Input / result
// -----------------------------------------------------------------------------

export type ValidateSocialContentDraftInput = {
    readonly draft:
    SocialContentDraft

    /**
     * Compiled validation-side knowledge context.
     *
     * The Writer Context is NOT used here.
     */
    readonly validationContext:
    GenerationValidationContext
}

export type SocialContentDraftValidationRun = {
    /**
     * Identity of the immutable draft snapshot
     * that was validated.
     */
    readonly contentDraftId:
    SocialContentDraftId

    readonly version:
    number

    /**
     * Deterministic projection used by both
     * scanner and validator.
     */
    readonly projection:
    SocialContentDraftTextProjection

    readonly scan:
    ClaimScanResult

    readonly validation:
    GenerationValidationResult
}

// -----------------------------------------------------------------------------
// Orchestration
// -----------------------------------------------------------------------------

export async function validateSocialContentDraft(
    input: ValidateSocialContentDraftInput,
    dependencies: SocialContentDraftValidationDependencies,
): Promise<SocialContentDraftValidationRun> {
    const projection =
        projectSocialContentDraftText(
            input.draft,
        )

    const scan =
        await dependencies.scanClaims({
            draft:
                projection.text,
        })

    const validation =
        await dependencies.validateGeneration({
            draft:
                projection.text,

            scan,

            context:
                input.validationContext,
        })

    return {
        contentDraftId:
            input.draft.id,

        version:
            input.draft.version,

        projection,

        scan,

        validation,
    }
}