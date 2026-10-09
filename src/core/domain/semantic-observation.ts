/** Interpretation data only: no support, authority, permission or publication result. */
export const SEMANTIC_OBSERVATION_CONTRACT_VERSION = "unda-semantic-observation-v1" as const

export type Slot<T> =
  | { readonly state: "known"; readonly value: T }
  | { readonly state: "unknown"; readonly reason: "notStated" | "notSupplied" | "notEvaluated" }
  | { readonly state: "notApplicable" }
  | { readonly state: "unresolved"; readonly alternatives?: readonly T[] }

export type SourceSpan = {
  readonly sourceId: string
  readonly revisionId: string
  readonly start: number // inclusive Unicode code-point offset, not UTF-16
  readonly end: number   // exclusive Unicode code-point offset
  readonly excerpt: string
}

export type EntityRef = { readonly mention: string; readonly registryId?: string }
export type BindingRole = "subject" | "serviceOrItem" | "branchOrPlace" | "audience"
  | "comparator" | "holder" | "recipient"
export type Binding = {
  readonly bindingId: string
  readonly role: BindingRole
  readonly target: Slot<EntityRef>
}
export type Quantity = { readonly value: string; readonly unit: Slot<string> }
export type Period = {
  readonly start: Slot<string>
  readonly end: Slot<string>
  readonly timeZone: Slot<string>
  readonly endInclusive: Slot<boolean>
}
export type TemporalScope = {
  readonly relation: Slot<"past" | "current" | "future">
  readonly expressions: readonly string[]
  readonly period: Slot<Period>
  readonly relativeReferenceId?: Slot<string>
}
export type Attribution = {
  readonly mode: Slot<"firstParty" | "reported" | "quoted">
  readonly adoption: Slot<"adopted" | "notAdopted">
  readonly chain?: readonly {
    readonly mode: "reported" | "quoted"
    readonly speaker: Slot<string>
  }[]
}
export type Qualifier = {
  readonly kind: "condition" | "eligibility" | "scope" | "exception" | "measurementBasis"
  readonly text: string
}
export type InterpretationMethod = "structured" | "deterministic" | "jevCandidate"
  | "strongerModel" | "human"
export type FieldOrigin = {
  readonly field: string // dotted path with numeric array indices
  readonly method: InterpretationMethod
  readonly sourceRef?: string
}
export type InterpreterMetadata = {
  readonly provider: string
  readonly model: string
  readonly configurationRef: string
}
export type Interpretation = {
  readonly status: "resolved" | "partial" | "abstained"
  readonly unresolvedFields?: readonly string[]
  readonly abstentionReason?: "insufficientContext" | "semanticAmbiguity" | "capabilityLimit"
}
export type InterpretationProvenance = {
  readonly contractVersion: typeof SEMANTIC_OBSERVATION_CONTRACT_VERSION
  readonly method: InterpretationMethod
  readonly inputRefs?: readonly string[]
  readonly contextRefs?: readonly string[]
  readonly interpreter?: InterpreterMetadata
  readonly fieldOrigins?: readonly FieldOrigin[]
}

/** Families/reason codes are supplied by the operator blueprint, not generic core. */
export interface SemanticObservation<Claim extends { readonly type: string }, Reason extends string = never> {
  readonly observationId: string
  readonly propositionId: string
  readonly sourceSpans: readonly SourceSpan[]
  readonly normalizedProposition: Slot<string> // affirmative relation kernel; not auto-normalized
  readonly presentation: Slot<"assertion" | "question" | "hypothetical" | "example" | "instruction">
  readonly claims: readonly Claim[]
  readonly polarity: Slot<"affirmed" | "negated">
  readonly attribution: Attribution
  readonly parentPropositionId?: string
  readonly modality?: Slot<"possible" | "asserted" | "categorical">
  readonly bindings?: readonly Binding[]
  readonly time?: TemporalScope
  readonly qualifiers?: readonly Qualifier[]
  readonly reasons?: readonly { readonly code: Reason; readonly fields: readonly string[] }[]
  readonly interpretation: Interpretation
  readonly confidence?: readonly {
    readonly target: string
    readonly measure: "binaryProbability" | "selfReported"
    readonly value: number
    readonly calibrationRef?: string
  }[]
  readonly provenance: InterpretationProvenance
}

/** Immutable current text supplied by application code; no lookup or clock access. */
export type SemanticSourceRevision = {
  readonly sourceId: string
  readonly revisionId: string
  readonly text: string
}
