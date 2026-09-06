import type {
    ContentId,
} from "../../core/domain"

import type {
    SocialContentDraft,
    SocialContentDraftId,
} from "./content-draft"

import type {
    SocialContentDraftEvaluationAudit,
} from "./content-draft-evaluation-audit"

import type {
    ContentExecutionSpec,
} from "./content-execution-spec"

import type {
    SocialContentReviewDecision,
    SocialContentReviewRequest,
} from "./content-review"

import type {
    SocialContentModeRisk,
} from "./operations"

import {
    SOCIAL_CONTENT_MODE_POLICIES,
} from "./operations"

// -----------------------------------------------------------------------------
// Approval policy
// -----------------------------------------------------------------------------

export type SocialContentApprovalPolicy =
    | {
        readonly mode:
        "reviewRequired"
    }
    | {
        /**
         * L3-style autonomous publishing.
         *
         * Risk ceiling remains explicit rather than implicit.
         */
        readonly mode:
        "directPublish"

        readonly maxRisk:
        SocialContentModeRisk
    }

// -----------------------------------------------------------------------------
// Eligibility
// -----------------------------------------------------------------------------

export type SocialContentSchedulingAuthorization =
    | {
        readonly type:
        "humanApproved"

        readonly reviewRequestId:
        SocialContentReviewRequest["id"]

        readonly reviewDecisionId:
        SocialContentReviewDecision["id"]
    }
    | {
        readonly type:
        "directPublish"

        readonly risk:
        SocialContentModeRisk
    }

export type SocialContentSchedulingEligibility =
    | {
        readonly eligible:
        true

        readonly contentId:
        ContentId

        readonly draftId:
        SocialContentDraftId

        readonly draftVersion:
        number

        readonly authorization:
        SocialContentSchedulingAuthorization
    }
    | {
        readonly eligible:
        false

        readonly reason:
        | "blocked"
        | "humanReviewRequired"
        | "awaitingReviewDecision"
        | "changesRequested"
        | "rejected"
        | "directPublishRiskExceeded"
    }

// -----------------------------------------------------------------------------
// Input
// -----------------------------------------------------------------------------

export type ResolveSocialContentSchedulingEligibilityInput = {
    readonly draft:
    SocialContentDraft

    readonly evaluationAudit:
    SocialContentDraftEvaluationAudit

    readonly contentExecutionSpec:
    ContentExecutionSpec

    readonly approvalPolicy:
    SocialContentApprovalPolicy

    /**
     * Optional because direct-publish flow may never
     * create a human review request.
     */
    readonly reviewRequest?:
    SocialContentReviewRequest

    readonly reviewDecision?:
    SocialContentReviewDecision
}

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

const RISK_ORDER = {
    low:
        1,

    moderate:
        2,

    high:
        3,
} as const

function riskAllowsDirectPublish(
    actual:
        SocialContentModeRisk,

    maximum:
        SocialContentModeRisk,
): boolean {
    return (
        RISK_ORDER[actual] <=
        RISK_ORDER[maximum]
    )
}

function resolveContentModeRisk(
    executionSpec:
        ContentExecutionSpec,
): SocialContentModeRisk {
    const policy =
        SOCIAL_CONTENT_MODE_POLICIES.find(
            (candidate) =>
                candidate.mode ===
                executionSpec.contentMode,
        )

    if (!policy) {
        throw new Error(
            "Content execution mode has no Social Content Mode Policy",
        )
    }

    return policy.risk
}

function assertSchedulingProvenance(
    input:
        ResolveSocialContentSchedulingEligibilityInput,
): void {
    const {
        draft,
        evaluationAudit,
        contentExecutionSpec,
        reviewRequest,
        reviewDecision,
    } = input

    if (
        evaluationAudit.contentId !==
        draft.contentId
    ) {
        throw new Error(
            "Scheduling draft ContentId must match evaluation audit",
        )
    }

    if (
        evaluationAudit.finalDraftId !==
        draft.id ||
        evaluationAudit.finalDraftVersion !==
        draft.version
    ) {
        throw new Error(
            "Scheduling eligibility must target the evaluation audit final draft",
        )
    }

    if (
        draft.contentExecutionSpecId !==
        contentExecutionSpec.id
    ) {
        throw new Error(
            "Scheduling draft must match Content Execution Spec",
        )
    }

    if (
        contentExecutionSpec.contentBriefId !==
        draft.contentBriefId
    ) {
        throw new Error(
            "Scheduling Content Execution Spec must match draft Content Brief provenance",
        )
    }

    if (
        contentExecutionSpec.format !==
        draft.format
    ) {
        throw new Error(
            "Scheduling Content Execution Spec format must match draft format",
        )
    }

    if (reviewRequest) {
        if (
            reviewRequest.contentId !==
            draft.contentId ||
            reviewRequest.draftId !==
            draft.id ||
            reviewRequest.draftVersion !==
            draft.version
        ) {
            throw new Error(
                "Review request must target the scheduling draft",
            )
        }

        if (
            reviewRequest.evaluationAuditId !==
            evaluationAudit.id
        ) {
            throw new Error(
                "Review request must belong to the scheduling evaluation audit",
            )
        }
    }

    if (reviewDecision) {
        if (!reviewRequest) {
            throw new Error(
                "Review decision requires its review request",
            )
        }

        if (
            reviewDecision.reviewRequestId !==
            reviewRequest.id
        ) {
            throw new Error(
                "Review decision must belong to the supplied review request",
            )
        }

        if (
            reviewDecision.contentId !==
            draft.contentId ||
            reviewDecision.draftId !==
            draft.id ||
            reviewDecision.draftVersion !==
            draft.version
        ) {
            throw new Error(
                "Review decision must target the scheduling draft",
            )
        }
    }
}

// -----------------------------------------------------------------------------
// Resolution
// -----------------------------------------------------------------------------

export function resolveSocialContentSchedulingEligibility(
    input:
        ResolveSocialContentSchedulingEligibilityInput,
): SocialContentSchedulingEligibility {
    assertSchedulingProvenance(
        input,
    )

    const {
        draft,
        evaluationAudit,
        approvalPolicy,
        reviewRequest,
        reviewDecision,
    } = input

    // -------------------------------------------------------------------------
    // Safety/evaluation authority always wins.
    // -------------------------------------------------------------------------

    if (
        evaluationAudit.finalOutcome.status ===
        "blocked"
    ) {
        return {
            eligible:
                false,

            reason:
                "blocked",
        }
    }

    // -------------------------------------------------------------------------
    // Explicit human review path.
    //
    // Once a review request exists, direct-publish policy may NOT bypass it.
    // -------------------------------------------------------------------------

    if (reviewRequest) {
        if (!reviewDecision) {
            return {
                eligible:
                    false,

                reason:
                    "awaitingReviewDecision",
            }
        }

        switch (
        reviewDecision.decision
        ) {
            case "approved":
                return {
                    eligible:
                        true,

                    contentId:
                        draft.contentId,

                    draftId:
                        draft.id,

                    draftVersion:
                        draft.version,

                    authorization: {
                        type:
                            "humanApproved",

                        reviewRequestId:
                            reviewRequest.id,

                        reviewDecisionId:
                            reviewDecision.id,
                    },
                }

            case "changesRequested":
                return {
                    eligible:
                        false,

                    reason:
                        "changesRequested",
                }

            case "rejected":
                return {
                    eligible:
                        false,

                    reason:
                        "rejected",
                }
        }
    }

    // -------------------------------------------------------------------------
    // requiresReview can NEVER be bypassed by direct publishing.
    // -------------------------------------------------------------------------

    if (
        evaluationAudit.finalOutcome.status ===
        "requiresReview"
    ) {
        return {
            eligible:
                false,

            reason:
                "humanReviewRequired",
        }
    }

    // From here finalOutcome is necessarily pass.

    // -------------------------------------------------------------------------
    // Policy requires human approval.
    // -------------------------------------------------------------------------

    if (
        approvalPolicy.mode ===
        "reviewRequired"
    ) {
        return {
            eligible:
                false,

            reason:
                "humanReviewRequired",
        }
    }

    // -------------------------------------------------------------------------
    // Direct publish
    // -------------------------------------------------------------------------

    const risk =
        resolveContentModeRisk(
            input.contentExecutionSpec,
        )

    if (
        !riskAllowsDirectPublish(
            risk,
            approvalPolicy.maxRisk,
        )
    ) {
        return {
            eligible:
                false,

            reason:
                "directPublishRiskExceeded",
        }
    }

    return {
        eligible:
            true,

        contentId:
            draft.contentId,

        draftId:
            draft.id,

        draftVersion:
            draft.version,

        authorization: {
            type:
                "directPublish",

            risk,
        },
    }
}