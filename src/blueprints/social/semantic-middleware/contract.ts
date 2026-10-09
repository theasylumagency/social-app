import type {
  FieldOrigin, InterpretationMethod, InterpreterMetadata, Quantity, SemanticObservation,
  SemanticSourceRevision, Slot, SourceSpan,
} from "../../../core/domain/semantic-observation"

export type PriceClaim = {
  readonly type: "price"
  readonly amount: Slot<string>
  readonly currency: Slot<string>
  readonly basis: Slot<"exact" | "starting" | "range">
  readonly upperAmount?: Slot<string>
}
export type DiscountClaim = { readonly type: "discount"; readonly reduction: Slot<Quantity> }
export type AvailabilityClaim = { readonly type: "availability"; readonly resource: Slot<string> }
export type Phase7aClaim = PriceClaim | DiscountClaim | AvailabilityClaim
export type Phase7aObservation = SemanticObservation<Phase7aClaim, "unclearScope">

/** Supplied by application identity resolution; not interpreter-declared ownership. */
export type RegistryResolution = {
  readonly bindingId: string
  readonly mention: string
  readonly registryId: string
  readonly method: "structured" | "deterministic"
  readonly sourceRef: string
}

/** Trusted caller data, separate from the untrusted observation being checked. */
export type SemanticContractContext = {
  readonly observationId: string
  readonly anchor: {
    readonly propositionId: string
    readonly sourceSpans: readonly SourceSpan[]
  }
  readonly sources: readonly SemanticSourceRevision[]
  readonly bindingIds: readonly string[]
  readonly registryResolutions?: readonly RegistryResolution[]
  readonly provenance: {
    readonly method: InterpretationMethod
    readonly refs: readonly string[]
    readonly interpreter?: InterpreterMetadata
    readonly fieldOrigins?: readonly FieldOrigin[]
  }
}

declare const structurallyChecked: unique symbol
/** A structural check is NOT proof of semantic correctness, support or permission. */
export type StructurallyCheckedObservation = Phase7aObservation & {
  readonly [structurallyChecked]: true
}
export type SemanticContractIssue = {
  readonly path: string
  readonly code: "shape" | "fieldNotRequested" | "identity" | "span"
    | "reference" | "numeric" | "range" | "profile" | "provenance" | "interpretation"
}
export type SemanticContractCheck =
  | { readonly status: "structurallyValid"; readonly observation: StructurallyCheckedObservation }
  | { readonly status: "structurallyInvalid"; readonly issues: readonly SemanticContractIssue[] }
