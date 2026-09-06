import type {
    IsoDateTime,
} from "../../core/domain"

import type {
    WeeklyPlan,
    WeeklyPlanId,
    WeeklyPlanState,
} from "./weekly-plan"

// -----------------------------------------------------------------------------
// Review decisions
// -----------------------------------------------------------------------------

export type WeeklyPlanReviewDecision =
    | {
        readonly type: "approved"
        readonly planId: WeeklyPlanId
        readonly planVersion: number
        readonly decidedAt: IsoDateTime
    }
    | {
        readonly type: "changesRequested"
        readonly planId: WeeklyPlanId
        readonly planVersion: number

        /**
         * User-visible instruction describing what should change.
         * This becomes input to the next planning revision.
         */
        readonly note: string

        readonly decidedAt: IsoDateTime
    }

export type WeeklyPlanReviewResult = {
    readonly plan: WeeklyPlan
    readonly decision: WeeklyPlanReviewDecision
}

// -----------------------------------------------------------------------------
// Internal transition helper
// -----------------------------------------------------------------------------

function transitionWeeklyPlanState(
    plan: WeeklyPlan,
    allowedFrom: readonly WeeklyPlanState[],
    nextState: WeeklyPlanState,
    updatedAt: IsoDateTime,
): WeeklyPlan {
    if (
        !allowedFrom.includes(
            plan.state,
        )
    ) {
        throw new Error(
            `Invalid WeeklyPlan state transition: ${plan.state} -> ${nextState}`,
        )
    }

    return {
        ...plan,

        state:
            nextState,

        updatedAt,
    }
}

function assertNonEmptyNote(
    note: string,
): void {
    if (note.trim().length === 0) {
        throw new Error(
            "WeeklyPlan change request note must be non-empty",
        )
    }
}

// -----------------------------------------------------------------------------
// Lifecycle
// -----------------------------------------------------------------------------

/**
 * draft -> awaitingReview
 *
 * The plan is ready for human review.
 */
export function submitWeeklyPlanForReview(
    plan: WeeklyPlan,
    updatedAt: IsoDateTime,
): WeeklyPlan {
    return transitionWeeklyPlanState(
        plan,
        ["draft"],
        "awaitingReview",
        updatedAt,
    )
}

/**
 * awaitingReview -> approved
 *
 * Approval does not create a new plan version.
 */
export function approveWeeklyPlan(
    plan: WeeklyPlan,
    decidedAt: IsoDateTime,
): WeeklyPlanReviewResult {
    const approved =
        transitionWeeklyPlanState(
            plan,
            ["awaitingReview"],
            "approved",
            decidedAt,
        )

    return {
        plan:
            approved,

        decision: {
            type:
                "approved",

            planId:
                plan.id,

            planVersion:
                plan.version,

            decidedAt,
        },
    }
}

/**
 * awaitingReview -> changesRequested
 *
 * The note is preserved as an explicit review decision.
 * It should later become input to revision planning.
 */
export function requestWeeklyPlanChanges(
    plan: WeeklyPlan,
    note: string,
    decidedAt: IsoDateTime,
): WeeklyPlanReviewResult {
    assertNonEmptyNote(
        note,
    )

    const changesRequested =
        transitionWeeklyPlanState(
            plan,
            ["awaitingReview"],
            "changesRequested",
            decidedAt,
        )

    return {
        plan:
            changesRequested,

        decision: {
            type:
                "changesRequested",

            planId:
                plan.id,

            planVersion:
                plan.version,

            note:
                note.trim(),

            decidedAt,
        },
    }
}

/**
 * Marks an old plan version as no longer current.
 *
 * Typical cases:
 *
 * changesRequested:
 *   a revised version has been assembled.
 *
 * approved:
 *   a newer plan version legitimately replaces
 *   the previously approved version.
 *
 * Superseding does NOT mutate version.
 * The replacement plan receives version + 1
 * during assembly.
 */
export function supersedeWeeklyPlan(
    plan: WeeklyPlan,
    updatedAt: IsoDateTime,
): WeeklyPlan {
    return transitionWeeklyPlanState(
        plan,
        [
            "changesRequested",
            "approved",
        ],
        "superseded",
        updatedAt,
    )
}