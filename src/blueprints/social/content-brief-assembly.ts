import type {
    ContentId,
    EvidenceId,
    IsoDateTime,
} from "../../core/domain"

import type {
    ContentAudienceDirection,
} from "./audience"

import type {
    ContentBrief,
    ContentBriefCtaIntent,
    ContentBriefEvidenceMode,
    ContentBriefId,
} from "./content-brief"

import type {
    WeeklyContentDirectionId,
    WeeklyPlanId,
} from "./weekly-plan"

// -----------------------------------------------------------------------------
// Model-owned semantic proposal
// -----------------------------------------------------------------------------

export type ContentBriefAssemblyProposal = {
    readonly communicationJob: string
    readonly keyTakeaway: string
    readonly supportingPoints: readonly string[]

    readonly evidenceMode:
    ContentBriefEvidenceMode

    /**
     * Temporary semantic references selected by the model.
     * These must disappear during assembly.
     */
    readonly evidenceKeys:
    readonly string[]

    readonly ctaIntent:
    ContentBriefCtaIntent

    readonly constraints:
    readonly string[]

    readonly mustNotSay:
    readonly string[]

    readonly rationale:
    string
}

// -----------------------------------------------------------------------------
// Evidence resolution
// -----------------------------------------------------------------------------

export type ContentBriefEvidenceReference = {
    /**
     * Temporary key exposed to the semantic model.
     */
    readonly evidenceKey:
    string

    /**
     * Canonical persistent identity owned by the application.
     */
    readonly evidenceId:
    EvidenceId
}

// -----------------------------------------------------------------------------
// Assembly input
// -----------------------------------------------------------------------------

export type AssembleContentBriefInput = {
    readonly id:
    ContentBriefId

    readonly weeklyPlanId:
    WeeklyPlanId

    readonly weeklyContentDirectionId:
    WeeklyContentDirectionId

    readonly contentId?:
    ContentId

    /**
     * Planner-owned audience decision.
     * Model cannot modify it.
     */
    readonly audienceDirection:
    ContentAudienceDirection

    readonly proposal:
    ContentBriefAssemblyProposal

    /**
     * Only evidence exposed to this generation step
     * should appear here.
     */
    readonly evidenceReferences:
    readonly ContentBriefEvidenceReference[]

    readonly createdAt:
    IsoDateTime
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

function assertStringArray(
    values: readonly string[],
    field: string,
): void {
    for (const value of values) {
        assertNonEmptyString(
            value,
            field,
        )
    }
}

function assertSupportingPoints(
    values: readonly string[],
): void {
    if (
        values.length < 2 ||
        values.length > 5
    ) {
        throw new Error(
            "ContentBrief supportingPoints must contain 2-5 items",
        )
    }

    assertStringArray(
        values,
        "supportingPoints",
    )
}

// -----------------------------------------------------------------------------
// Evidence resolution
// -----------------------------------------------------------------------------

function resolveEvidenceIds(
    evidenceKeys: readonly string[],
    evidenceReferences:
        readonly ContentBriefEvidenceReference[],
): readonly EvidenceId[] {
    const byKey =
        new Map<string, EvidenceId>()

    for (
        const reference
        of evidenceReferences
    ) {
        assertNonEmptyString(
            reference.evidenceKey,
            "evidenceReference.evidenceKey",
        )

        if (
            byKey.has(
                reference.evidenceKey,
            )
        ) {
            throw new Error(
                `Duplicate evidence reference key: ${reference.evidenceKey}`,
            )
        }

        byKey.set(
            reference.evidenceKey,
            reference.evidenceId,
        )
    }

    const seenKeys =
        new Set<string>()

    const seenIds =
        new Set<EvidenceId>()

    const resolved:
        EvidenceId[] = []

    for (const key of evidenceKeys) {
        assertNonEmptyString(
            key,
            "evidenceKey",
        )

        if (seenKeys.has(key)) {
            throw new Error(
                `Duplicate evidence key selected by Content Brief: ${key}`,
            )
        }

        seenKeys.add(key)

        const evidenceId =
            byKey.get(key)

        if (!evidenceId) {
            throw new Error(
                `Unknown Content Brief evidence key: ${key}`,
            )
        }

        if (seenIds.has(evidenceId)) {
            throw new Error(
                `Multiple evidence keys resolve to the same EvidenceId: ${evidenceId}`,
            )
        }

        seenIds.add(evidenceId)
        resolved.push(evidenceId)
    }

    return resolved
}

// -----------------------------------------------------------------------------
// Assembly
// -----------------------------------------------------------------------------

export function assembleContentBrief(
    input: AssembleContentBriefInput,
): ContentBrief {
    const proposal =
        input.proposal

    assertNonEmptyString(
        proposal.communicationJob,
        "communicationJob",
    )

    assertNonEmptyString(
        proposal.keyTakeaway,
        "keyTakeaway",
    )

    assertSupportingPoints(
        proposal.supportingPoints,
    )

    assertStringArray(
        proposal.constraints,
        "constraints",
    )

    assertStringArray(
        proposal.mustNotSay,
        "mustNotSay",
    )

    assertNonEmptyString(
        proposal.rationale,
        "rationale",
    )

    const evidenceIds =
        resolveEvidenceIds(
            proposal.evidenceKeys,
            input.evidenceReferences,
        )

    if (
        proposal.evidenceMode ===
        "noProofNeeded" &&
        evidenceIds.length > 0
    ) {
        throw new Error(
            "ContentBrief with noProofNeeded must not contain evidence",
        )
    }

    if (
        (
            proposal.evidenceMode ===
            "evidenceSupported" ||
            proposal.evidenceMode ===
            "proofRequired"
        ) &&
        evidenceIds.length === 0
    ) {
        throw new Error(
            `${proposal.evidenceMode} ContentBrief must contain evidence`,
        )
    }

    return {
        id:
            input.id,

        weeklyPlanId:
            input.weeklyPlanId,

        weeklyContentDirectionId:
            input.weeklyContentDirectionId,

        ...(input.contentId !== undefined
            ? {
                contentId:
                    input.contentId,
            }
            : {}),

        communicationJob:
            proposal.communicationJob,

        keyTakeaway:
            proposal.keyTakeaway,

        supportingPoints:
            proposal.supportingPoints,

        audienceDirection:
            input.audienceDirection,

        evidenceMode:
            proposal.evidenceMode,

        evidenceIds,

        ctaIntent:
            proposal.ctaIntent,

        constraints:
            proposal.constraints,

        mustNotSay:
            proposal.mustNotSay,

        rationale:
            proposal.rationale,

        createdAt:
            input.createdAt,
    }
}