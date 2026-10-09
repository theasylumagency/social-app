import type { Attribution, BindingRole, EntityRef, SemanticSourceRevision, Slot, SourceSpan, TemporalScope } from "../../../core/domain/semantic-observation"
import type { Phase7aClaim, Phase7aObservation, SemanticContractIssue, RegistryResolution } from "./contract"

export type ShadowFamily = Phase7aClaim["type"]
export type ShadowPolicy = { readonly mode: "rawOnly" }
  | { readonly mode: "experimentalDeadZone"; readonly low: number; readonly high: number; readonly experimentRef: string }
export type ShadowConfiguration = {
  readonly provider: "jev"; readonly model: string; readonly configurationRef: string
  readonly executionMode: "fixture" | "provider"
  readonly protocolVersion: "unda-semantic-shadow-jev-bounded-v1"
  readonly timeoutMs: number; readonly budgetMs: number; readonly maxTasks: number; readonly policy: ShadowPolicy
}
export type ShadowBindingCandidate = {
  readonly candidateId: string; readonly value: EntityRef
  readonly grounding: "explicitMention" | "applicationEstablished" | "elliptical" | "ambiguous"
  readonly contextRef?: string
}
export type ShadowBindingSet = {
  readonly bindingId: string; readonly role: Extract<BindingRole, "serviceOrItem" | "branchOrPlace">
  readonly candidates: readonly ShadowBindingCandidate[]
  readonly capabilityLimit?: "ellipticalBinding" | "ambiguousBinding"
}
/** Constructed by a trusted application caller; never accepted from provider output. */
export type BoundedSemanticTask = {
  readonly observationId: string; readonly propositionId: string
  readonly source: SemanticSourceRevision; readonly spans: readonly SourceSpan[]
  readonly anchorMethod: "structured" | "deterministic" | "human"
  readonly anchorRule: string; readonly contextRefs: readonly string[]
  readonly families: readonly ShadowFamily[]
  readonly normalizedProposition: Phase7aObservation["normalizedProposition"]
  readonly presentation: Phase7aObservation["presentation"]; readonly attribution: Attribution
  readonly claimCandidates: readonly Phase7aClaim[]
  readonly bindings: readonly ShadowBindingSet[]
  readonly time?: TemporalScope
  readonly timeCandidates?: readonly { readonly candidateId: string; readonly value: "past" | "current" | "future" }[]
  readonly amountCandidates?: readonly { readonly candidateId: string; readonly claim: Extract<Phase7aClaim, { type: "price" | "discount" }> }[]
  readonly registryResolutions?: readonly RegistryResolution[]
  readonly qualifiers?: Phase7aObservation["qualifiers"]
}
export type ShadowTarget =
  | { readonly key: string; readonly kind: "family"; readonly family: ShadowFamily }
  | { readonly key: string; readonly kind: "polarity"; readonly value: "affirmed" | "negated" }
  | { readonly key: string; readonly kind: "binding"; readonly bindingId: string; readonly candidateId: string }
  | { readonly key: string; readonly kind: "time"; readonly candidateId: string }
  | { readonly key: string; readonly kind: "amount"; readonly candidateId: string }
/** Provider-neutral middleware port; no HTTP, Noul or Jev response types. */
export type SemanticDecisionRequest = {
  readonly fullText: string; readonly anchorText: string; readonly targets: readonly ShadowTarget[]
  readonly bindingCandidates: readonly { readonly bindingId: string; readonly candidateId: string; readonly role: string; readonly mention: string }[]
  readonly timeCandidates: BoundedSemanticTask["timeCandidates"]
  readonly amountCandidates: BoundedSemanticTask["amountCandidates"]
}
export type SemanticDecisionResult = {
  readonly provider: "jev"; readonly model: string
  readonly probabilities: Readonly<Record<string, number>>
  readonly inputTokens: number | null; readonly outputTokens: number | null
}
export interface ShadowInterpreter {
  interpret(request: SemanticDecisionRequest, signal: AbortSignal): Promise<SemanticDecisionResult>
}
export type ShadowDecision = ShadowTarget & {
  readonly probabilityYes: number | null
  readonly derived: "yes" | "no" | "applicationDeadZone" | "notDerived" | "technicalMissing"
}
/** Opaque envelope: even validated shadow data is not a checked consumer/policy input. */
export type ShadowObservationRecord = {
  readonly purpose: "shadowEvaluationOnly"
  readonly observation: Phase7aObservation
}
export type ShadowLinkage = {
  readonly workflowRunId: string; readonly reviewRunId: string; readonly postKey: string
  readonly channel: string; readonly surface: string; readonly committedStep: string
  readonly safetyReviewer: { readonly promptVersion: string; readonly outcome: unknown }
  readonly consolidatedReviewer: { readonly outcome: unknown }
}
export type ShadowTrace = {
  readonly traceVersion: "unda-semantic-shadow-trace-v1"; readonly purpose: "evaluationOnly"
  readonly runId: string; readonly timestamp: string; readonly linkage: ShadowLinkage
  readonly source: SemanticSourceRevision
  readonly eligibility: "eligible" | "ineligible"
  readonly invocation: "returned" | "notInvoked" | "technicalFailure" | "timeout"
  readonly notInvokedReason?: "disabled" | "noBoundedAnchor" | "invalidTask" | "taskLimit" | "budgetExhausted"
  readonly anchor?: { readonly propositionId: string; readonly spans: readonly SourceSpan[]; readonly method: BoundedSemanticTask["anchorMethod"]; readonly rule: string }
  readonly applicationTask?: Omit<BoundedSemanticTask, "source">
  readonly requestedTargets: readonly ShadowTarget[]
  readonly candidates: { readonly bindings: readonly ShadowBindingSet[]; readonly time: BoundedSemanticTask["timeCandidates"]; readonly amount: BoundedSemanticTask["amountCandidates"] }
  readonly decisions: readonly ShadowDecision[]
  readonly observation?: ShadowObservationRecord
  readonly unresolvedFields: readonly string[]
  readonly contractValidation: { readonly status: "notChecked" | "structurallyValid" | "structurallyInvalid"; readonly issues: readonly SemanticContractIssue[] }
  readonly knownCapabilityLimits: readonly { readonly code: "ellipticalBinding" | "ambiguousBinding"; readonly bindingId: string }[]
  readonly technicalErrors: readonly { readonly code: "providerException" | "http" | "providerSchema" | "timeout" | "invalidTask"; readonly httpStatus?: number }[]
  readonly latencyMs: number | null; readonly providerRequests: number; readonly semanticDecisions: number
  readonly tokens: { readonly input: number | null; readonly output: number | null }
  readonly costUsd: number | null
  readonly costEstimateRates: { readonly inputUsdPerMillion: number | null; readonly outputUsdPerMillion: number | null }
  readonly configuration: ShadowConfiguration; readonly actualModel: string | null
}
export interface ShadowTraceSink { append(trace: ShadowTrace, signal: AbortSignal): Promise<void> }
export const unknownSlot = (): Slot<never> => ({ state: "unknown", reason: "notSupplied" })
