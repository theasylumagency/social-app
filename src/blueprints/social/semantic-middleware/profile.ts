import type { BindingRole, Qualifier } from "../../../core/domain/semantic-observation"
import type { Phase7aClaim, Phase7aObservation } from "./contract"

export type Phase7aField = Exclude<keyof Phase7aObservation, "parentPropositionId" | "modality" | "confidence">
export type SemanticConsumerProfile = {
  readonly id: "social-semantic-phase-7a"
  readonly families: readonly Phase7aClaim["type"][]
  readonly fields: readonly Phase7aField[]
  readonly bindingRoles: readonly BindingRole[]
  readonly qualifierKinds: readonly Qualifier["kind"][]
  readonly requiredBindings: Readonly<Record<Phase7aClaim["type"], readonly BindingRole[]>>
}

/** Request/acceptance scope only. No support, severity or publication policy. */
export const PHASE_7A_PROFILE: SemanticConsumerProfile = Object.freeze({
  id: "social-semantic-phase-7a",
  families: Object.freeze(["price", "discount", "availability"] as const),
  fields: Object.freeze([
    "observationId", "propositionId", "sourceSpans", "normalizedProposition", "presentation",
    "claims", "polarity", "attribution", "bindings", "time", "qualifiers", "reasons",
    "interpretation", "provenance",
  ] as const),
  bindingRoles: Object.freeze(["subject", "serviceOrItem", "branchOrPlace", "audience"] as const),
  qualifierKinds: Object.freeze(["condition", "eligibility", "scope", "exception"] as const),
  requiredBindings: Object.freeze({
    price: Object.freeze(["serviceOrItem"] as const),
    discount: Object.freeze(["serviceOrItem"] as const),
    availability: Object.freeze(["serviceOrItem"] as const),
  }),
})
