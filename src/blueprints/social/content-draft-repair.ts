import type {
    ConsolidatedRepairBrief,
    DraftEvaluationOutcome,
    IsoDateTime,
    WriterContext,
} from "../../core/domain"

import type {
    CommunicationEnvelope,
} from "./audience"

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
    SocialContentDraftAssemblyProposal,
} from "./content-draft-assembly"

import {
    assembleRepairedSocialContentDraft,
} from "./content-draft-repair-assembly"

import {
    assertSocialContentDraftQualityProvenance,
} from "./content-draft-quality"

// -----------------------------------------------------------------------------
// Repair outcome
// -----------------------------------------------------------------------------

export type SocialContentDraftRepairOutcome =
    Extract<
        DraftEvaluationOutcome,
        {
            readonly status:
            "repair"
        }
    >

// -----------------------------------------------------------------------------
// Curated model context
//
// Repair Writer receives only the authority it needs.
// Application IDs / persistence metadata are deliberately excluded.
// -----------------------------------------------------------------------------

export type SocialContentRepairBriefContext =
    Pick<
        ContentBrief,
        | "communicationJob"
        | "keyTakeaway"
        | "supportingPoints"
        | "audienceDirection"
        | "evidenceMode"
        | "ctaIntent"
        | "constraints"
        | "mustNotSay"
    >

export type SocialContentRepairExecutionContext =
    Pick<
        ContentExecutionSpec,
        | "channel"
        | "contentMode"
        | "format"
        | "depth"
        | "visualDependency"
        | "executionGuidance"
        | "constraints"
    >

export type SocialContentRepairEnvelopeContext =
    Pick<
        CommunicationEnvelope,
        | "complexity"
        | "assumedKnowledge"
        | "explanationDepth"
        | "toneRange"
        | "framingRules"
        | "preferredStructures"
        | "terminologyRules"
        | "proofStyle"
        | "ctaStyle"
        | "salesPressure"
        | "inclusivityRules"
        | "trustMechanisms"
        | "avoid"
    >

// -----------------------------------------------------------------------------
// Repair Writer boundary
// -----------------------------------------------------------------------------

export type SocialContentRepairWriterInput = {
    /**
     * Copy-only snapshot of the previous immutable draft.
     *
     * No draft ID, version, ContentId, timestamps,
     * or other application authority reaches the model here.
     */
    readonly previousDraft:
    SocialContentDraftAssemblyProposal

    readonly repairBrief:
    ConsolidatedRepairBrief

    readonly contentBrief:
    SocialContentRepairBriefContext

    readonly execution:
    SocialContentRepairExecutionContext

    readonly communicationEnvelope:
    SocialContentRepairEnvelopeContext

    /**
     * Same bounded generation context available
     * to the original Writer.
     */
    readonly writerContext:
    WriterContext
}

export type SocialContentRepairWriter = (
    input:
        SocialContentRepairWriterInput,
) => Promise<
    SocialContentDraftAssemblyProposal
>

// -----------------------------------------------------------------------------
// Production orchestration input
// -----------------------------------------------------------------------------

export type RepairSocialContentDraftInput = {
    readonly previousDraft:
    SocialContentDraft

    readonly evaluation:
    SocialContentDraftRepairOutcome

    readonly contentBrief:
    ContentBrief

    readonly contentExecutionSpec:
    ContentExecutionSpec

    readonly communicationEnvelope:
    CommunicationEnvelope

    readonly writerContext:
    WriterContext

    /**
     * New application-owned immutable draft identity.
     */
    readonly repairedDraftId:
    SocialContentDraftId

    readonly createdAt:
    IsoDateTime
}

// -----------------------------------------------------------------------------
// Previous-draft projection for Repair Writer
// -----------------------------------------------------------------------------

function toRepairWriterBaseline(
    draft:
        SocialContentDraft,
): SocialContentDraftAssemblyProposal {
    switch (draft.format) {
        case "staticPost":
            return {
                text:
                    draft.text,

                caption:
                    null,

                frames:
                    [],

                script:
                    null,

                onScreenText:
                    [],
            }

        case "carousel":
            return {
                text:
                    null,

                caption:
                    draft.caption ?? null,

                frames:
                    draft.frames.map(
                        (frame) => ({
                            heading:
                                frame.heading ?? null,

                            body:
                                frame.body,
                        }),
                    ),

                script:
                    null,

                onScreenText:
                    [],
            }

        case "story":
            return {
                text:
                    null,

                caption:
                    null,

                frames:
                    draft.frames.map(
                        (frame) => ({
                            heading:
                                frame.heading ?? null,

                            body:
                                frame.body,
                        }),
                    ),

                script:
                    null,

                onScreenText:
                    [],
            }

        case "reel":
            return {
                text:
                    null,

                caption:
                    draft.caption ?? null,

                frames:
                    [],

                script:
                    draft.script,

                onScreenText:
                    draft.onScreenText,
            }
    }
}

// -----------------------------------------------------------------------------
// Curated authority
// -----------------------------------------------------------------------------

function buildRepairBriefContext(
    contentBrief:
        ContentBrief,
): SocialContentRepairBriefContext {
    return {
        communicationJob:
            contentBrief.communicationJob,

        keyTakeaway:
            contentBrief.keyTakeaway,

        supportingPoints:
            contentBrief.supportingPoints,

        audienceDirection:
            contentBrief.audienceDirection,

        evidenceMode:
            contentBrief.evidenceMode,

        ctaIntent:
            contentBrief.ctaIntent,

        constraints:
            contentBrief.constraints,

        mustNotSay:
            contentBrief.mustNotSay,
    }
}

function buildRepairExecutionContext(
    contentExecutionSpec:
        ContentExecutionSpec,
): SocialContentRepairExecutionContext {
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

        constraints:
            contentExecutionSpec.constraints,
    }
}

function buildRepairEnvelopeContext(
    envelope:
        CommunicationEnvelope,
): SocialContentRepairEnvelopeContext {
    return {
        complexity:
            envelope.complexity,

        assumedKnowledge:
            envelope.assumedKnowledge,

        explanationDepth:
            envelope.explanationDepth,

        toneRange:
            envelope.toneRange,

        framingRules:
            envelope.framingRules,

        preferredStructures:
            envelope.preferredStructures,

        terminologyRules:
            envelope.terminologyRules,

        proofStyle:
            envelope.proofStyle,

        ctaStyle:
            envelope.ctaStyle,

        salesPressure:
            envelope.salesPressure,

        inclusivityRules:
            envelope.inclusivityRules,

        trustMechanisms:
            envelope.trustMechanisms,

        avoid:
            envelope.avoid,
    }
}

// -----------------------------------------------------------------------------
// Production Repair Writer orchestration
// -----------------------------------------------------------------------------
function getStructuredFrameCount(
    draft:
        SocialContentDraft,
): number | null {
    switch (draft.format) {
        case "carousel":
        case "story":
            return draft.frames.length

        case "staticPost":
        case "reel":
            return null
    }
}

function assertDeterministicRepairPreservation(
    previousDraft:
        SocialContentDraft,

    repairedDraft:
        SocialContentDraft,

    repairBrief:
        ConsolidatedRepairBrief,
): void {
    if (
        !repairBrief.preserve.includes(
            "structure",
        )
    ) {
        return
    }

    const previousFrameCount =
        getStructuredFrameCount(
            previousDraft,
        )

    const repairedFrameCount =
        getStructuredFrameCount(
            repairedDraft,
        )

    if (
        previousFrameCount !== null &&
        repairedFrameCount !== null &&
        previousFrameCount !==
        repairedFrameCount
    ) {
        throw new Error(
            "Repair must preserve frame count when structure preservation is required",
        )
    }
}
export async function repairSocialContentDraft(
    input:
        RepairSocialContentDraftInput,

    repairWriter:
        SocialContentRepairWriter,
): Promise<SocialContentDraft> {
    if (
        input.evaluation.status !==
        "repair"
    ) {
        throw new Error(
            "Content draft repair requires a repair evaluation outcome",
        )
    }

    /**
     * Reject mismatched draft / brief / execution provenance
     * before the model runs.
     */
    assertSocialContentDraftQualityProvenance({
        draft:
            input.previousDraft,

        contentBrief:
            input.contentBrief,

        contentExecutionSpec:
            input.contentExecutionSpec,
    })

    const proposal =
        await repairWriter({
            previousDraft:
                toRepairWriterBaseline(
                    input.previousDraft,
                ),

            repairBrief:
                input.evaluation.brief,

            contentBrief:
                buildRepairBriefContext(
                    input.contentBrief,
                ),

            execution:
                buildRepairExecutionContext(
                    input.contentExecutionSpec,
                ),

            communicationEnvelope:
                buildRepairEnvelopeContext(
                    input.communicationEnvelope,
                ),

            writerContext:
                input.writerContext,
        })

    /**
     * Model owns revised copy only.
     *
     * Application restores:
     * - ContentId
     * - Brief / Execution provenance
     * - format
     * - locale
     * - version + 1
     * - new immutable draft ID
     * - createdAt
     */
    const repairedDraft =
        assembleRepairedSocialContentDraft({
            id:
                input.repairedDraftId,

            previousDraft:
                input.previousDraft,

            proposal,

            createdAt:
                input.createdAt,
        })

    assertDeterministicRepairPreservation(
        input.previousDraft,
        repairedDraft,
        input.evaluation.brief,
    )

    return repairedDraft
}