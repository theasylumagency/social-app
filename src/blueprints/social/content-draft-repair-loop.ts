import type {
    DraftEvaluationOutcome,
    EditorialQualityContext,
    GenerationValidationContext,
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
    SocialContentDraftEvaluationDependencies,
    SocialContentDraftEvaluationRun,
} from "./content-draft-evaluation-run"

import {
    evaluateSocialContentDraft,
} from "./content-draft-evaluation-run"

import type {
    SocialContentRepairWriter,
} from "./content-draft-repair"

import {
    repairSocialContentDraft,
} from "./content-draft-repair"

// -----------------------------------------------------------------------------
// Final loop outcome
//
// Automatic repair is exhausted after one attempt,
// therefore "repair" is intentionally impossible here.
// -----------------------------------------------------------------------------

export type SocialContentDraftRepairLoopOutcome =
    Exclude<
        DraftEvaluationOutcome,
        {
            readonly status:
            "repair"
        }
    >

// -----------------------------------------------------------------------------
// Dependencies
// -----------------------------------------------------------------------------

export type SocialContentDraftRepairLoopDependencies =
    SocialContentDraftEvaluationDependencies & {
        readonly repairWriter:
        SocialContentRepairWriter
    }

// -----------------------------------------------------------------------------
// Input
// -----------------------------------------------------------------------------

export type RunSocialContentDraftRepairLoopInput = {
    readonly draft:
    SocialContentDraft

    readonly contentBrief:
    ContentBrief

    readonly contentExecutionSpec:
    ContentExecutionSpec

    readonly communicationEnvelope:
    CommunicationEnvelope

    readonly writerContext:
    WriterContext

    readonly validationContext:
    GenerationValidationContext

    readonly qualityContext:
    EditorialQualityContext

    /**
     * Used only if the initial evaluation requests repair.
     *
     * Application owns the new immutable identity.
     */
    readonly repairedDraftId:
    SocialContentDraftId

    readonly repairedDraftCreatedAt:
    IsoDateTime
}

// -----------------------------------------------------------------------------
// Run result
// -----------------------------------------------------------------------------

export type SocialContentDraftRepairLoopRun = {
    /**
     * Evaluation of the original draft.
     */
    readonly initialEvaluation:
    SocialContentDraftEvaluationRun

    /**
     * Null when no automatic repair was needed or allowed.
     */
    readonly repairedDraft:
    SocialContentDraft | null

    /**
     * Evaluation of repaired Draft v2.
     *
     * Null when repair was never attempted.
     */
    readonly finalEvaluation:
    SocialContentDraftEvaluationRun | null

    /**
     * Draft that should continue downstream.
     *
     * Original draft if no repair occurred.
     * Repaired draft if one repair occurred.
     */
    readonly finalDraft:
    SocialContentDraft

    /**
     * Final deterministic decision.
     *
     * Never "repair".
     */
    readonly outcome:
    SocialContentDraftRepairLoopOutcome
}

// -----------------------------------------------------------------------------
// One-attempt budget
// -----------------------------------------------------------------------------

function resolveOutcomeAfterRepairBudgetExhausted(
    outcome:
        DraftEvaluationOutcome,
): SocialContentDraftRepairLoopOutcome {
    switch (outcome.status) {
        case "pass":
            return {
                status:
                    "pass",
            }

        case "blocked":
            return {
                status:
                    "blocked",
            }

        case "requiresReview":
            return {
                status:
                    "requiresReview",
            }

        case "repair":
            /**
             * A second automatic repair is forbidden.
             *
             * The remaining issue now requires human review.
             */
            return {
                status:
                    "requiresReview",
            }
    }
}

// -----------------------------------------------------------------------------
// Orchestration
// -----------------------------------------------------------------------------

export async function runSocialContentDraftRepairLoop(
    input:
        RunSocialContentDraftRepairLoopInput,

    dependencies:
        SocialContentDraftRepairLoopDependencies,
): Promise<SocialContentDraftRepairLoopRun> {
    const evaluationDependencies = {
        scanClaims:
            dependencies.scanClaims,

        validateGeneration:
            dependencies.validateGeneration,

        reviewEditorialQuality:
            dependencies.reviewEditorialQuality,
    }

    const initialEvaluation =
        await evaluateSocialContentDraft(
            {
                draft:
                    input.draft,

                contentBrief:
                    input.contentBrief,

                contentExecutionSpec:
                    input.contentExecutionSpec,

                validationContext:
                    input.validationContext,

                qualityContext:
                    input.qualityContext,
            },

            evaluationDependencies,
        )

    switch (
    initialEvaluation.outcome.status
    ) {
        case "pass":
            return {
                initialEvaluation,

                repairedDraft:
                    null,

                finalEvaluation:
                    null,

                finalDraft:
                    input.draft,

                outcome: {
                    status:
                        "pass",
                },
            }

        case "blocked":
            return {
                initialEvaluation,

                repairedDraft:
                    null,

                finalEvaluation:
                    null,

                finalDraft:
                    input.draft,

                outcome: {
                    status:
                        "blocked",
                },
            }

        case "requiresReview":
            return {
                initialEvaluation,

                repairedDraft:
                    null,

                finalEvaluation:
                    null,

                finalDraft:
                    input.draft,

                outcome: {
                    status:
                        "requiresReview",
                },
            }

        case "repair": {
            const repairedDraft =
                await repairSocialContentDraft(
                    {
                        previousDraft:
                            input.draft,

                        evaluation:
                            initialEvaluation.outcome,

                        contentBrief:
                            input.contentBrief,

                        contentExecutionSpec:
                            input.contentExecutionSpec,

                        communicationEnvelope:
                            input.communicationEnvelope,

                        writerContext:
                            input.writerContext,

                        repairedDraftId:
                            input.repairedDraftId,

                        createdAt:
                            input.repairedDraftCreatedAt,
                    },

                    dependencies.repairWriter,
                )

            /**
             * Repaired Draft v2 always goes through
             * the complete evaluation pipeline again.
             *
             * This reruns:
             * - projection,
             * - claim scan,
             * - generation validation,
             * - editorial quality when applicable,
             * - deterministic reduction.
             */
            const finalEvaluation =
                await evaluateSocialContentDraft(
                    {
                        draft:
                            repairedDraft,

                        contentBrief:
                            input.contentBrief,

                        contentExecutionSpec:
                            input.contentExecutionSpec,

                        validationContext:
                            input.validationContext,

                        qualityContext:
                            input.qualityContext,
                    },

                    evaluationDependencies,
                )

            return {
                initialEvaluation,

                repairedDraft,

                finalEvaluation,

                finalDraft:
                    repairedDraft,

                outcome:
                    resolveOutcomeAfterRepairBudgetExhausted(
                        finalEvaluation.outcome,
                    ),
            }
        }
    }
}