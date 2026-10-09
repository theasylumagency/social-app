import type { Attribution, Binding, Interpretation, Qualifier, Slot, SourceSpan, TemporalScope } from "../../../core/domain/semantic-observation"
import type { AvailabilityClaim, Phase7aClaim, Phase7aObservation, StructurallyCheckedObservation } from "./contract"

export type SafetyReviewProjection = {
  readonly observationId: string
  readonly propositionId: string
  readonly sourceSpans: readonly SourceSpan[]
  readonly normalizedProposition: Phase7aObservation["normalizedProposition"]
  readonly presentation: Phase7aObservation["presentation"]
  readonly claims: readonly Phase7aClaim[]
  readonly polarity: Phase7aObservation["polarity"]
  readonly attribution: Attribution
  readonly bindings?: readonly Binding[]
  readonly time?: TemporalScope
  readonly qualifiers?: readonly Qualifier[]
  readonly reasons?: Phase7aObservation["reasons"]
  readonly interpretation: Pick<Interpretation, "status" | "unresolvedFields">
}
export type AvailabilityState = Slot<"available" | "unavailable">
export type FactMatchPayload = Exclude<Phase7aClaim, AvailabilityClaim>
  | (AvailabilityClaim & { readonly availabilityState: AvailabilityState })
export type FactMatchProjection = {
  readonly propositionId: string
  readonly claim: FactMatchPayload
  readonly polarity: Phase7aObservation["polarity"]
  readonly bindings?: readonly Binding[]
  readonly time?: TemporalScope
  readonly qualifiers?: readonly Qualifier[]
  readonly trace: { readonly observationId: string; readonly sourceSpans: readonly SourceSpan[] }
}

function availabilityState(polarity: Phase7aObservation["polarity"]): AvailabilityState {
  switch (polarity.state) {
    case "known": return { state: "known", value: polarity.value === "affirmed" ? "available" : "unavailable" }
    case "unknown": return { state: "unknown", reason: polarity.reason }
    case "notApplicable": return { state: "notApplicable" }
    case "unresolved": return {
      state: "unresolved",
      ...(polarity.alternatives ? { alternatives: polarity.alternatives.map(p => p === "affirmed" ? "available" as const : "unavailable" as const) } : {}),
    }
  }
}

/** Detached whitelist DTO. Not connected to any prompt or runtime consumer. */
export function projectSemanticSafetyReview(observation: StructurallyCheckedObservation): SafetyReviewProjection {
  return structuredClone({
    observationId: observation.observationId,
    propositionId: observation.propositionId,
    sourceSpans: observation.sourceSpans,
    normalizedProposition: observation.normalizedProposition,
    presentation: observation.presentation,
    claims: observation.claims,
    polarity: observation.polarity,
    attribution: observation.attribution,
    ...(observation.bindings !== undefined ? { bindings: observation.bindings } : {}),
    ...(observation.time !== undefined ? { time: observation.time } : {}),
    ...(observation.qualifiers !== undefined ? { qualifiers: observation.qualifiers } : {}),
    ...(observation.reasons !== undefined ? { reasons: observation.reasons } : {}),
    interpretation: {
      status: observation.interpretation.status,
      ...(observation.interpretation.unresolvedFields !== undefined ? { unresolvedFields: observation.interpretation.unresolvedFields } : {}),
    },
  })
}

/** One matching task per emitted family. An empty array is not a safety result. */
export function projectSemanticFactMatches(observation: StructurallyCheckedObservation): readonly FactMatchProjection[] {
  return observation.claims.map(claim => structuredClone({
    propositionId: observation.propositionId,
    claim: claim.type === "availability" ? { ...claim, availabilityState: availabilityState(observation.polarity) } : claim,
    polarity: observation.polarity,
    ...(observation.bindings !== undefined ? { bindings: observation.bindings } : {}),
    ...(observation.time !== undefined ? { time: observation.time } : {}),
    ...(observation.qualifiers !== undefined ? { qualifiers: observation.qualifiers } : {}),
    trace: { observationId: observation.observationId, sourceSpans: observation.sourceSpans },
  }))
}
