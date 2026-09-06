import type {
    EditorialQualityContext,
    EditorialQualityResult,
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
    SocialContentDraftTextProjection,
} from "./content-draft-text-projection"

import {
    projectSocialContentDraftText,
} from "./content-draft-text-projection"

// -----------------------------------------------------------------------------
// Curated reviewer context
//
// The Quality Reviewer does NOT receive:
// - WriterContext
// - ValidationContext
// - proof/fact authority
// - full Brand Brain
//
// Its responsibility is editorial quality, not claim support.
// -----------------------------------------------------------------------------

export type SocialEditorialTaskContext = {
    readonly communicationJob:
    string

    readonly keyTakeaway:
    string

    readonly supportingPoints:
    readonly string[]

    readonly ctaIntent:
    ContentBrief["ctaIntent"]
}

export type SocialEditorialExecutionContext = {
    readonly channel:
    ContentExecutionSpec["channel"]

    readonly contentMode:
    ContentExecutionSpec["contentMode"]

    readonly format:
    ContentExecutionSpec["format"]

    readonly depth:
    ContentExecutionSpec["depth"]

    readonly visualDependency:
    ContentExecutionSpec["visualDependency"]

    readonly executionGuidance:
    readonly string[]
}

export type SocialContentDraftEditorialQualityReviewerInput = {
    /**
     * Public copy plus structural provenance.
     *
     * No application IDs are exposed to the reviewer.
     */
    readonly projection:
    SocialContentDraftTextProjection

    /**
     * Minimal approved communication task.
     */
    readonly task:
    SocialEditorialTaskContext

    /**
     * Minimal approved execution shape.
     */
    readonly execution:
    SocialEditorialExecutionContext

    /**
     * Generic editorial context:
     * voice, audience, positioning, references,
     * recent-content fingerprints, etc.
     */
    readonly context:
    EditorialQualityContext
}

export type SocialContentDraftEditorialQualityReviewer = (
    input: SocialContentDraftEditorialQualityReviewerInput,
) => Promise<EditorialQualityResult>

// -----------------------------------------------------------------------------
// Orchestration input / result
// -----------------------------------------------------------------------------

export type EvaluateSocialContentDraftQualityInput = {
    readonly draft:
    SocialContentDraft

    readonly contentBrief:
    ContentBrief

    readonly contentExecutionSpec:
    ContentExecutionSpec

    readonly qualityContext:
    EditorialQualityContext
}

export type SocialContentDraftQualityRun = {
    readonly contentDraftId:
    SocialContentDraftId

    readonly version:
    number

    readonly projection:
    SocialContentDraftTextProjection

    readonly quality:
    EditorialQualityResult
}

// -----------------------------------------------------------------------------
// Provenance validation
// -----------------------------------------------------------------------------

export type SocialContentDraftQualityProvenanceInput = {
    readonly draft:
    SocialContentDraft

    readonly contentBrief:
    ContentBrief

    readonly contentExecutionSpec:
    ContentExecutionSpec
}

export function assertSocialContentDraftQualityProvenance(
    input: SocialContentDraftQualityProvenanceInput,
): void {
    const {
        draft,
        contentBrief,
        contentExecutionSpec,
    } = input

    if (
        draft.contentBriefId !==
        contentBrief.id
    ) {
        throw new Error(
            "Content draft does not belong to the supplied Content Brief",
        )
    }

    if (
        draft.contentExecutionSpecId !==
        contentExecutionSpec.id
    ) {
        throw new Error(
            "Content draft does not belong to the supplied Content Execution Spec",
        )
    }

    if (
        contentExecutionSpec.contentBriefId !==
        contentBrief.id
    ) {
        throw new Error(
            "Content Execution Spec does not belong to the supplied Content Brief",
        )
    }

    if (
        draft.format !==
        contentExecutionSpec.format
    ) {
        throw new Error(
            "Content draft format does not match the supplied Content Execution Spec",
        )
    }

    if (
        contentBrief.contentId !==
        undefined &&
        contentBrief.contentId !==
        draft.contentId
    ) {
        throw new Error(
            "Content draft does not match the Content Brief content identity",
        )
    }
}

// -----------------------------------------------------------------------------
// Curated context builders
// -----------------------------------------------------------------------------

function buildTaskContext(
    contentBrief: ContentBrief,
): SocialEditorialTaskContext {
    return {
        communicationJob:
            contentBrief.communicationJob,

        keyTakeaway:
            contentBrief.keyTakeaway,

        supportingPoints:
            contentBrief.supportingPoints,

        ctaIntent:
            contentBrief.ctaIntent,
    }
}

function buildExecutionContext(
    contentExecutionSpec: ContentExecutionSpec,
): SocialEditorialExecutionContext {
    return {
        channel:
            contentExecutionSpec.channel,

        contentMode:
            contentExecutionSpec.contentMode,

        format:
            contentExecutionSpec.format,

        depth:
            contentExecutionSpec.depth,

        visualDependency:
            contentExecutionSpec.visualDependency,

        executionGuidance:
            contentExecutionSpec.executionGuidance,
    }
}

// -----------------------------------------------------------------------------
// Orchestration
// -----------------------------------------------------------------------------

export async function evaluateSocialContentDraftQuality(
    input: EvaluateSocialContentDraftQualityInput,
    reviewEditorialQuality:
        SocialContentDraftEditorialQualityReviewer,
): Promise<SocialContentDraftQualityRun> {
    assertSocialContentDraftQualityProvenance(
        input,
    )

    const projection =
        projectSocialContentDraftText(
            input.draft,
        )

    const quality =
        await reviewEditorialQuality({
            projection,

            task:
                buildTaskContext(
                    input.contentBrief,
                ),

            execution:
                buildExecutionContext(
                    input.contentExecutionSpec,
                ),

            context:
                input.qualityContext,
        })

    return {
        contentDraftId:
            input.draft.id,

        version:
            input.draft.version,

        projection,

        quality,
    }
}