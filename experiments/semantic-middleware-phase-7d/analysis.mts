import type { HumanReference, HumanProposition } from "./review.mjs"
export const ratio = (numerator: number, denominator: number): number | null => denominator ? numerator / denominator : null
const fields = ["family", "polarity", "service", "branch", "time", "amount", "unresolved"] as const
/** This frozen evaluation has no invoked real anchors. Refuse to manufacture interpretation scores. */
export function analyzeNoCallCohort(itemIds: readonly string[], reference: HumanReference | null) {
 const items = reference?.items.filter(i => itemIds.includes(i.itemId)) ?? []
 if (reference && items.length !== itemIds.length) throw Error("INCOMPLETE_COHORT_REFERENCE")
 const propositions = items.flatMap(i => i.propositions)
 const materialItems = items.filter(i => i.propositions.length).length
 const actionCounts = Object.fromEntries(["noActionDifference", "reviewerFocusOnly", "unnecessaryReviewOrRepair", "missedNecessaryReviewOrRepair", "wrongFactEntityBinding", "potentiallyWrongPublicationHandling"].map(a => [a, propositions.filter(p => p.ifMissedAction === a).length]))
 const missedMaterialActions = propositions.filter(p => ["missedNecessaryReviewOrRepair", "wrongFactEntityBinding", "potentiallyWrongPublicationHandling"].includes(p.ifMissedAction)).length
 return {
  status: reference ? "completedBlindHumanEngineeringReference" : "pendingBlindHumanReference",
  reviewedItems: items.length, requiredReviewItems: itemIds.length,
  eligibility: { humanMaterialItems: reference ? materialItems : null, humanMaterialPropositions: reference ? propositions.length : null,
   preparedEligibleItems: 0, invokedItems: 0,
   correctlyIneligibleItems: reference ? items.filter(i => i.ineligibility === "correctlyIneligible").length : null,
   missedMaterialItems: reference ? items.filter(i => i.ineligibility === "missedMaterial").length : null,
   missedImplicitItems: reference ? items.filter(i => i.ineligibility === "missedImplicit").length : null,
   candidateOrAnchorFailureItems: reference ? items.filter(i => i.ineligibility === "candidateOrAnchorFailure").length : null,
   materialItemRecall: reference ? ratio(0, materialItems) : null,
   materialPropositionRecall: reference ? ratio(0, propositions.length) : null,
   unnecessaryInvocations: 0, unnecessaryInvocationRatePerInvocation: null,
   unnecessaryInvocationRatePerReviewedItem: reference ? ratio(0, items.length) : null },
  interpretation: { scoredObservations: 0, perField: Object.fromEntries(fields.map(f => [f, { correct: 0, evaluated: 0, accuracy: null }])),
   completeObservation: { correct: 0, evaluated: 0, accuracy: null }, reason: "No real proposition was invoked; no semantic interpretation or adaptation accuracy is demonstrated." },
  actions: { status: reference ? "humanAnalyticalSimulationOnly" : "pendingBlindHumanReference", counts: reference ? actionCounts : null,
   falseInterventionObserved: 0, falseInterventionRatePerObservation: null,
   missedMaterialActionPropositions: reference ? missedMaterialActions : null,
   missedMaterialActionRatePerHumanMaterialProposition: reference ? ratio(missedMaterialActions, propositions.length) : null,
   missedMaterialActionItems: reference ? items.filter(i => i.propositions.some(p => ["missedNecessaryReviewOrRepair", "wrongFactEntityBinding", "potentiallyWrongPublicationHandling"].includes(p.ifMissedAction))).length : null },
  usefulness: { observations: 0, usefulObservations: 0, usefulObservationRate: null, costPerUsefulObservation: null,
   unservedHumanConsumerOpportunities: reference ? propositions.filter(p => p.sufficientForConsumer && !p.consumers.includes("none")).length : null,
   reason: "Human potential usefulness of missed propositions is separate from actual observation usefulness." },
  ellipsis: { humanCases: reference ? propositions.filter(p => p.ellipsis.length).length : null, invokedCases: 0, demonstratedBindingSafety: false },
 }
}
export function missRecord(itemId: string, cohort: string, proposition: HumanProposition) {
 return { itemId, cohort, sourceId: proposition.sourceId, excerpt: proposition.excerpt, span: { start: proposition.start, end: proposition.end },
  stage: "A_candidateEligibility" as const, taxonomy: "candidateOrAnchorMiss", chargedToJev: false,
  family: proposition.families, polarity: proposition.polarity, ellipsis: proposition.ellipsis,
  action: proposition.ifMissedAction, errorCouldChangeHandling: proposition.errorCouldChangeHandling,
  potentialConsumers: proposition.consumers, sufficientForConsumer: proposition.sufficientForConsumer,
  applicationContextResolution: "noPreparedAnchor", boundedJevQuestionAsked: false, finalObservation: "notProduced", notes: proposition.notes }
}
export function recommendation(reference: HumanReference | null) {
 if (!reference) return { choice: null, status: "pendingBlindHumanReference", rationale: "A final Phase 7E recommendation requires the user's blind eligibility and action-impact review." }
 const missed = reference.items.flatMap(i => i.propositions).length
 return missed ? { choice: "C", status: "humanReferenceAvailable", rationale: "Improve candidate/anchor preparation before further Jev evaluation: material slice propositions received no bounded task. Keep the same family slice, version the new protocol and freeze a new real sample before provider calls." }
  : { choice: "A", status: "humanReferenceAvailable", rationale: "Continue shadow collection with the same slice using a larger independently verified real-content pool that includes material positives. Three correctly ineligible posts cannot establish interpretation, binding safety or operational value; admit no fields into reviewer decisions." }
}
