// src/blueprints/social/audience-resolution.ts

import type {
    AudienceInfluence,
    AudienceLandscape,
    FounderAudienceStanceValue,
    ResolveAudienceLandscapeInput,
} from "./audience"

function influenceForOperatorAudience(
    lifecycle: "active" | "challenged" | "retired",
    founderStance: FounderAudienceStanceValue | null,
): AudienceInfluence {
    if (lifecycle === "retired") {
        return "none"
    }

    if (founderStance === "disagree") {
        return "limited"
    }

    if (founderStance === "agree") {
        return "strong"
    }

    return "standard"
}

export function resolveAudienceLandscape(
    input: ResolveAudienceLandscapeInput,
    generatedAt: AudienceLandscape["generatedAt"],
): AudienceLandscape {
    const stanceByHypothesis = new Map(
        input.founderStances.map((item) => [
            item.audienceHypothesisId,
            item.stance,
        ]),
    )

    const operatorEntries = input.hypotheses.map((audience) => {
        const founderStance =
            stanceByHypothesis.get(audience.id) ?? null

        return {
            source: "operator" as const,
            audience,
            founderStance,
            influence: influenceForOperatorAudience(
                audience.lifecycle,
                founderStance,
            ),
        }
    })

    const founderEntries = input.founderProvidedAudiences.map(
        (audience) => ({
            source: "founder" as const,
            audience,
            influence: "strong" as const,
        }),
    )

    return {
        brandId: input.brandId,
        version: (input.previousVersion ?? 0) + 1,
        entries: [...operatorEntries, ...founderEntries],
        generatedAt,
    }
}