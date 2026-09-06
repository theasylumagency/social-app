import type {
    BrandId,
    IsoDate,
    IsoDateTime,
} from "../../core/domain"

import type {
    CommunicationEnvelopeId,
    ContentAudienceDirection,
    WeeklyAudienceFocus,
} from "./audience"

import type {
    WeeklyContentDirectionId,
    WeeklyExperimentDecision,
    WeeklyPlan,
    WeeklyPlanId,
    WeeklyObjective,
} from "./weekly-plan"

// -----------------------------------------------------------------------------
// Assembly input
// -----------------------------------------------------------------------------

export type WeeklyContentDirectionAssemblyInput = {
    /**
     * Temporary application-owned key used only to connect
     * semantic planning stages before canonical persistence.
     */
    readonly contentDirectionKey: string

    readonly id: WeeklyContentDirectionId
    readonly order: number

    readonly direction: string
    readonly purpose: string
    readonly rationale: string
}

export type WeeklyContentAudienceDirectionAssemblyInput = {
    readonly contentDirectionKey: string
    readonly audienceDirection: ContentAudienceDirection
}

export type AssembleWeeklyPlanInput = {
    readonly id: WeeklyPlanId
    readonly brandId: BrandId

    readonly startsOn: IsoDate
    readonly endsOn: IsoDate

    readonly version: number

    readonly communicationEnvelopeId:
    CommunicationEnvelopeId

    readonly objective: WeeklyObjective
    readonly audienceFocus: WeeklyAudienceFocus

    readonly contentDirections:
    readonly WeeklyContentDirectionAssemblyInput[]

    readonly contentAudienceDirections:
    readonly WeeklyContentAudienceDirectionAssemblyInput[]

    readonly experimentDecision:
    WeeklyExperimentDecision

    readonly createdAt: IsoDateTime
    readonly updatedAt: IsoDateTime
}

// -----------------------------------------------------------------------------
// Validation helpers
// -----------------------------------------------------------------------------

function assertNonEmptyString(
    value: string,
    field: string,
): void {
    if (value.trim().length === 0) {
        throw new Error(
            `${field} must be a non-empty string`,
        )
    }
}

function assertValidVersion(
    version: number,
): void {
    if (
        !Number.isInteger(version) ||
        version < 1
    ) {
        throw new Error(
            "WeeklyPlan version must be a positive integer",
        )
    }
}

function assertValidDateRange(
    startsOn: IsoDate,
    endsOn: IsoDate,
): void {
    /**
     * Canonical ISO YYYY-MM-DD values sort chronologically.
     */
    if (startsOn > endsOn) {
        throw new Error(
            "WeeklyPlan startsOn must not be after endsOn",
        )
    }
}

// -----------------------------------------------------------------------------
// Assembly
// -----------------------------------------------------------------------------

export function assembleWeeklyPlan(
    input: AssembleWeeklyPlanInput,
): WeeklyPlan {
    assertValidVersion(
        input.version,
    )

    assertValidDateRange(
        input.startsOn,
        input.endsOn,
    )

    if (
        input.contentDirections.length === 0
    ) {
        throw new Error(
            "WeeklyPlan must contain at least one content direction",
        )
    }

    const directionKeys =
        new Set<string>()

    const directionIds =
        new Set<WeeklyContentDirectionId>()

    const orders =
        new Set<number>()

    for (
        const direction
        of input.contentDirections
    ) {
        assertNonEmptyString(
            direction.contentDirectionKey,
            "contentDirectionKey",
        )

        assertNonEmptyString(
            direction.direction,
            "direction",
        )

        assertNonEmptyString(
            direction.purpose,
            "purpose",
        )

        assertNonEmptyString(
            direction.rationale,
            "rationale",
        )

        if (
            directionKeys.has(
                direction.contentDirectionKey,
            )
        ) {
            throw new Error(
                `Duplicate contentDirectionKey: ${direction.contentDirectionKey}`,
            )
        }

        directionKeys.add(
            direction.contentDirectionKey,
        )

        if (
            directionIds.has(
                direction.id,
            )
        ) {
            throw new Error(
                `Duplicate WeeklyContentDirectionId: ${direction.id}`,
            )
        }

        directionIds.add(
            direction.id,
        )

        if (
            !Number.isInteger(
                direction.order,
            ) ||
            direction.order < 0
        ) {
            throw new Error(
                "Content direction order must be a non-negative integer",
            )
        }

        if (
            orders.has(
                direction.order,
            )
        ) {
            throw new Error(
                `Duplicate content direction order: ${direction.order}`,
            )
        }

        orders.add(
            direction.order,
        )
    }

    const audienceDirectionByKey =
        new Map<
            string,
            ContentAudienceDirection
        >()

    for (
        const entry
        of input.contentAudienceDirections
    ) {
        assertNonEmptyString(
            entry.contentDirectionKey,
            "contentAudienceDirection.contentDirectionKey",
        )

        if (
            audienceDirectionByKey.has(
                entry.contentDirectionKey,
            )
        ) {
            throw new Error(
                `Duplicate Content Audience Direction for key: ${entry.contentDirectionKey}`,
            )
        }

        if (
            !directionKeys.has(
                entry.contentDirectionKey,
            )
        ) {
            throw new Error(
                `Content Audience Direction references unknown key: ${entry.contentDirectionKey}`,
            )
        }

        audienceDirectionByKey.set(
            entry.contentDirectionKey,
            entry.audienceDirection,
        )
    }

    if (
        audienceDirectionByKey.size !==
        input.contentDirections.length
    ) {
        const missingKeys =
            input.contentDirections
                .filter(
                    (direction) =>
                        !audienceDirectionByKey.has(
                            direction.contentDirectionKey,
                        ),
                )
                .map(
                    (direction) =>
                        direction.contentDirectionKey,
                )

        throw new Error(
            `Missing Content Audience Direction for: ${missingKeys.join(", ")}`,
        )
    }

    const contentDirections =
        [...input.contentDirections]
            .sort(
                (left, right) =>
                    left.order -
                    right.order,
            )
            .map((direction) => {
                const audienceDirection =
                    audienceDirectionByKey.get(
                        direction.contentDirectionKey,
                    )

                if (!audienceDirection) {
                    /**
                     * Already guaranteed above.
                     * Keeps the type system honest.
                     */
                    throw new Error(
                        `Missing Content Audience Direction for: ${direction.contentDirectionKey}`,
                    )
                }

                return {
                    id:
                        direction.id,

                    order:
                        direction.order,

                    direction:
                        direction.direction,

                    purpose:
                        direction.purpose,

                    rationale:
                        direction.rationale,

                    audienceDirection,
                }
            })

    return {
        id:
            input.id,

        brandId:
            input.brandId,

        startsOn:
            input.startsOn,

        endsOn:
            input.endsOn,

        version:
            input.version,

        /**
         * Every newly assembled version begins as draft.
         * Review-state transitions belong elsewhere.
         */
        state:
            "draft",

        communicationEnvelopeId:
            input.communicationEnvelopeId,

        objective:
            input.objective,

        audienceFocus:
            input.audienceFocus,

        contentDirections,

        experimentDecision:
            input.experimentDecision,

        createdAt:
            input.createdAt,

        updatedAt:
            input.updatedAt,
    }
}