import type {
    ActorId,
    ContentId,
    DomainId,
    IsoDateTime,
} from "../../core/domain"

import type {
    SocialContentDraft,
    SocialContentDraftId,
} from "./content-draft"

import type {
    SocialContentDraftEvaluationAudit,
    SocialContentDraftEvaluationAuditId,
} from "./content-draft-evaluation-audit"

// -----------------------------------------------------------------------------
// Identity
// -----------------------------------------------------------------------------

export type SocialContentReviewRequestId =
    DomainId<"SocialContentReviewRequestId">

export type SocialContentReviewDecisionId =
    DomainId<"SocialContentReviewDecisionId">

// -----------------------------------------------------------------------------
// Review request
// -----------------------------------------------------------------------------

export type SocialContentReviewReason =
    | "standard"
    | "required"

export type SocialContentReviewRequest = {
    readonly id:
    SocialContentReviewRequestId

    readonly contentId:
    ContentId

    /**
     * Review is always pinned to one immutable draft.
     */
    readonly draftId:
    SocialContentDraftId

    readonly draftVersion:
    number

    readonly evaluationAuditId:
    SocialContentDraftEvaluationAuditId

    /**
     * standard
     * = policy/user chose human review even though
     *   evaluation passed.
     *
     * required
     * = evaluation pipeline ended in requiresReview.
     */
    readonly reason:
    SocialContentReviewReason

    readonly requestedAt:
    IsoDateTime
}

// -----------------------------------------------------------------------------
// Review decision
// -----------------------------------------------------------------------------

export type SocialContentReviewDecisionType =
    | "approved"
    | "changesRequested"
    | "rejected"

export type SocialContentReviewDecision = {
    readonly id:
    SocialContentReviewDecisionId

    readonly reviewRequestId:
    SocialContentReviewRequestId

    readonly contentId:
    ContentId

    readonly draftId:
    SocialContentDraftId

    readonly draftVersion:
    number

    readonly decision:
    SocialContentReviewDecisionType

    /**
     * Required for changesRequested / rejected.
     * Optional for approved.
     */
    readonly note?:
    string

    readonly decidedBy:
    ActorId

    readonly decidedAt:
    IsoDateTime
}

// -----------------------------------------------------------------------------
// Request assembly
// -----------------------------------------------------------------------------

export type AssembleSocialContentReviewRequestInput = {
    readonly id:
    SocialContentReviewRequestId

    readonly draft:
    SocialContentDraft

    readonly evaluationAudit:
    SocialContentDraftEvaluationAudit

    readonly reason:
    SocialContentReviewReason

    readonly requestedAt:
    IsoDateTime
}

function assertPositiveVersion(
    version:
        number,

    label:
        string,
): void {
    if (
        !Number.isInteger(version) ||
        version < 1
    ) {
        throw new Error(
            `${label} must be a positive integer`,
        )
    }
}

export function assembleSocialContentReviewRequest(
    input:
        AssembleSocialContentReviewRequestInput,
): SocialContentReviewRequest {
    const {
        draft,
        evaluationAudit,
    } = input

    assertPositiveVersion(
        draft.version,
        "Review draft version",
    )

    if (
        evaluationAudit.contentId !==
        draft.contentId
    ) {
        throw new Error(
            "Review draft ContentId must match evaluation audit",
        )
    }

    if (
        evaluationAudit.finalDraftId !==
        draft.id
    ) {
        throw new Error(
            "Review must target the evaluation audit final draft",
        )
    }

    if (
        evaluationAudit.finalDraftVersion !==
        draft.version
    ) {
        throw new Error(
            "Review draft version must match evaluation audit final draft version",
        )
    }

    switch (
    evaluationAudit.finalOutcome.status
    ) {
        case "blocked":
            throw new Error(
                "Blocked content cannot enter approval review",
            )

        case "pass":
            if (
                input.reason !==
                "standard"
            ) {
                throw new Error(
                    "Passed content may only create a standard review request",
                )
            }

            break

        case "requiresReview":
            if (
                input.reason !==
                "required"
            ) {
                throw new Error(
                    "requiresReview outcome must create a required review request",
                )
            }

            break
    }

    return {
        id:
            input.id,

        contentId:
            draft.contentId,

        draftId:
            draft.id,

        draftVersion:
            draft.version,

        evaluationAuditId:
            evaluationAudit.id,

        reason:
            input.reason,

        requestedAt:
            input.requestedAt,
    }
}

// -----------------------------------------------------------------------------
// Decision assembly
// -----------------------------------------------------------------------------

export type AssembleSocialContentReviewDecisionInput = {
    readonly id:
    SocialContentReviewDecisionId

    readonly request:
    SocialContentReviewRequest

    readonly decision:
    SocialContentReviewDecisionType

    readonly note?:
    string

    readonly decidedBy:
    ActorId

    readonly decidedAt:
    IsoDateTime
}

function normalizedOptionalNote(
    note:
        string | undefined,
): string | undefined {
    if (
        note ===
        undefined
    ) {
        return undefined
    }

    const trimmed =
        note.trim()

    return trimmed.length === 0
        ? undefined
        : trimmed
}

export function assembleSocialContentReviewDecision(
    input:
        AssembleSocialContentReviewDecisionInput,
): SocialContentReviewDecision {
    assertPositiveVersion(
        input.request.draftVersion,
        "Review request draft version",
    )

    const note =
        normalizedOptionalNote(
            input.note,
        )

    if (
        (
            input.decision ===
            "changesRequested" ||
            input.decision ===
            "rejected"
        ) &&
        note ===
        undefined
    ) {
        throw new Error(
            `${input.decision} review decision requires a note`,
        )
    }

    return {
        id:
            input.id,

        reviewRequestId:
            input.request.id,

        contentId:
            input.request.contentId,

        draftId:
            input.request.draftId,

        draftVersion:
            input.request.draftVersion,

        decision:
            input.decision,

        ...(note === undefined
            ? {}
            : {
                note,
            }),

        decidedBy:
            input.decidedBy,

        decidedAt:
            input.decidedAt,
    }
}