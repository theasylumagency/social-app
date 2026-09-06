import type {
    ConsolidatedRepairBrief,
    ContentId,
    DomainId,
    IsoDateTime,
} from "../../core/domain"

import type {
    SocialContentDraft,
    SocialContentDraftId,
} from "./content-draft"

import type {
    SocialContentDraftEvaluationRun,
} from "./content-draft-evaluation-run"

import type {
    SocialContentDraftRepairLoopOutcome,
    SocialContentDraftRepairLoopRun,
} from "./content-draft-repair-loop"

// -----------------------------------------------------------------------------
// Identity
// -----------------------------------------------------------------------------

export type SocialContentDraftEvaluationAuditId =
    DomainId<"SocialContentDraftEvaluationAuditId">

// -----------------------------------------------------------------------------
// Canonical audit record
// -----------------------------------------------------------------------------

export type SocialContentDraftEvaluationAudit = {
    readonly id:
    SocialContentDraftEvaluationAuditId

    /**
     * Stable content identity across draft revisions.
     */
    readonly contentId:
    ContentId

    readonly initialDraftId:
    SocialContentDraftId

    readonly initialDraftVersion:
    number

    readonly initialEvaluation:
    SocialContentDraftEvaluationRun

    /**
     * 0 = no automatic repair was attempted.
     * 1 = exactly one automatic repair was attempted.
     *
     * Values above 1 are impossible by design.
     */
    readonly automaticRepairAttempts:
    0 | 1

    /**
     * Present only when initial evaluation requested repair.
     */
    readonly repairBrief:
    ConsolidatedRepairBrief | null

    readonly repairedDraftId:
    SocialContentDraftId | null

    readonly repairedDraftVersion:
    number | null

    /**
     * Evaluation of repaired Draft v2.
     *
     * Null when no repair occurred.
     */
    readonly finalEvaluation:
    SocialContentDraftEvaluationRun | null

    /**
     * Draft that continues downstream.
     */
    readonly finalDraftId:
    SocialContentDraftId

    readonly finalDraftVersion:
    number

    /**
     * Never "repair".
     */
    readonly finalOutcome:
    SocialContentDraftRepairLoopOutcome

    readonly createdAt:
    IsoDateTime
}

// -----------------------------------------------------------------------------
// Assembly input
// -----------------------------------------------------------------------------

export type AssembleSocialContentDraftEvaluationAuditInput = {
    readonly id:
    SocialContentDraftEvaluationAuditId

    readonly initialDraft:
    SocialContentDraft

    readonly run:
    SocialContentDraftRepairLoopRun

    readonly createdAt:
    IsoDateTime
}

// -----------------------------------------------------------------------------
// Invariants
// -----------------------------------------------------------------------------

function assertEvaluationMatchesDraft(
    evaluation:
        SocialContentDraftEvaluationRun,

    draft:
        SocialContentDraft,

    label:
        string,
): void {
    if (
        evaluation.contentDraftId !==
        draft.id
    ) {
        throw new Error(
            `${label} evaluation draft ID does not match draft`,
        )
    }

    if (
        evaluation.version !==
        draft.version
    ) {
        throw new Error(
            `${label} evaluation version does not match draft`,
        )
    }
}

function assertSameContentLineage(
    initialDraft:
        SocialContentDraft,

    draft:
        SocialContentDraft,
): void {
    if (
        draft.contentId !==
        initialDraft.contentId
    ) {
        throw new Error(
            "Evaluation audit draft must preserve ContentId",
        )
    }

    if (
        draft.contentBriefId !==
        initialDraft.contentBriefId
    ) {
        throw new Error(
            "Evaluation audit draft must preserve Content Brief provenance",
        )
    }

    if (
        draft.contentExecutionSpecId !==
        initialDraft.contentExecutionSpecId
    ) {
        throw new Error(
            "Evaluation audit draft must preserve Content Execution Spec provenance",
        )
    }

    if (
        draft.format !==
        initialDraft.format
    ) {
        throw new Error(
            "Evaluation audit draft must preserve format",
        )
    }

    if (
        draft.locale !==
        initialDraft.locale
    ) {
        throw new Error(
            "Evaluation audit draft must preserve locale",
        )
    }
}

function expectedFinalStatusAfterRepair(
    evaluation:
        SocialContentDraftEvaluationRun,
): SocialContentDraftRepairLoopOutcome["status"] {
    switch (
    evaluation.outcome.status
    ) {
        case "pass":
            return "pass"

        case "blocked":
            return "blocked"

        case "requiresReview":
            return "requiresReview"

        case "repair":
            /**
             * Automatic repair budget is exhausted.
             */
            return "requiresReview"
    }
}

// -----------------------------------------------------------------------------
// Canonical assembly
// -----------------------------------------------------------------------------

export function assembleSocialContentDraftEvaluationAudit(
    input:
        AssembleSocialContentDraftEvaluationAuditInput,
): SocialContentDraftEvaluationAudit {
    const {
        initialDraft,
        run,
    } = input

    assertEvaluationMatchesDraft(
        run.initialEvaluation,
        initialDraft,
        "Initial",
    )

    // -------------------------------------------------------------------------
    // No repair branch
    // -------------------------------------------------------------------------

    if (
        run.repairedDraft ===
        null
    ) {
        if (
            run.initialEvaluation.outcome.status ===
            "repair"
        ) {
            throw new Error(
                "Repair evaluation must produce a repaired draft",
            )
        }

        if (
            run.finalEvaluation !==
            null
        ) {
            throw new Error(
                "Final evaluation must be null when no repair occurred",
            )
        }

        if (
            run.finalDraft.id !==
            initialDraft.id ||
            run.finalDraft.version !==
            initialDraft.version
        ) {
            throw new Error(
                "Final draft must remain the initial draft when no repair occurred",
            )
        }

        assertSameContentLineage(
            initialDraft,
            run.finalDraft,
        )

        if (
            run.outcome.status !==
            run.initialEvaluation.outcome.status
        ) {
            throw new Error(
                "Final outcome must match initial terminal outcome when no repair occurred",
            )
        }

        return {
            id:
                input.id,

            contentId:
                initialDraft.contentId,

            initialDraftId:
                initialDraft.id,

            initialDraftVersion:
                initialDraft.version,

            initialEvaluation:
                run.initialEvaluation,

            automaticRepairAttempts:
                0,

            repairBrief:
                null,

            repairedDraftId:
                null,

            repairedDraftVersion:
                null,

            finalEvaluation:
                null,

            finalDraftId:
                initialDraft.id,

            finalDraftVersion:
                initialDraft.version,

            finalOutcome:
                run.outcome,

            createdAt:
                input.createdAt,
        }
    }

    // -------------------------------------------------------------------------
    // Repair branch
    // -------------------------------------------------------------------------

    if (
        run.initialEvaluation.outcome.status !==
        "repair"
    ) {
        throw new Error(
            "Repaired draft requires an initial repair evaluation outcome",
        )
    }

    if (
        run.finalEvaluation ===
        null
    ) {
        throw new Error(
            "Repaired draft requires a final evaluation",
        )
    }

    const repairedDraft =
        run.repairedDraft

    assertSameContentLineage(
        initialDraft,
        repairedDraft,
    )

    if (
        repairedDraft.id ===
        initialDraft.id
    ) {
        throw new Error(
            "Repaired draft must have a new draft ID",
        )
    }

    if (
        repairedDraft.version !==
        initialDraft.version + 1
    ) {
        throw new Error(
            "Repaired draft version must increment exactly once",
        )
    }

    if (
        run.finalDraft.id !==
        repairedDraft.id ||
        run.finalDraft.version !==
        repairedDraft.version
    ) {
        throw new Error(
            "Final draft must be the repaired draft after automatic repair",
        )
    }

    assertSameContentLineage(
        initialDraft,
        run.finalDraft,
    )

    assertEvaluationMatchesDraft(
        run.finalEvaluation,
        repairedDraft,
        "Final",
    )

    const expectedFinalStatus =
        expectedFinalStatusAfterRepair(
            run.finalEvaluation,
        )

    if (
        run.outcome.status !==
        expectedFinalStatus
    ) {
        throw new Error(
            "Final outcome does not respect automatic repair budget",
        )
    }

    return {
        id:
            input.id,

        contentId:
            initialDraft.contentId,

        initialDraftId:
            initialDraft.id,

        initialDraftVersion:
            initialDraft.version,

        initialEvaluation:
            run.initialEvaluation,

        automaticRepairAttempts:
            1,

        repairBrief:
            run.initialEvaluation.outcome.brief,

        repairedDraftId:
            repairedDraft.id,

        repairedDraftVersion:
            repairedDraft.version,

        finalEvaluation:
            run.finalEvaluation,

        finalDraftId:
            repairedDraft.id,

        finalDraftVersion:
            repairedDraft.version,

        finalOutcome:
            run.outcome,

        createdAt:
            input.createdAt,
    }
}