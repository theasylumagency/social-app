import { readFile } from "node:fs/promises"
import path from "node:path"
import { experiment, json, save, sha256 } from "./common.mjs"
import { completedReference, verifyFrozen } from "./review.mjs"
import { analyzeNoCallCohort, missRecord, recommendation } from "./analysis.mjs"
import type { SampleItem } from "./sample.mjs"
import type { ShadowTrace } from "../../src/blueprints/social/semantic-middleware/shadow"
const { manifest, sample } = await verifyFrozen()
const primary = await json("results/primary/summary.json"), smoke = await json("smoke/summary.json")
const traces = (await readFile(path.join(experiment, "results/primary/traces.jsonl"), "utf8")).trim().split(/\r?\n/).filter(Boolean).map(line => JSON.parse(line)) as { itemId: string; cohort: string; trace: ShadowTrace }[]
if (!primary.traceComplete || traces.length !== primary.requiredTextSurfaces || primary.sampleHash !== manifest.sampleHash) throw Error("INCOMPLETE_PRIMARY_RUN")
if (traces.some(r => r.trace.providerRequests || r.trace.observation || r.trace.eligibility !== "ineligible" || r.trace.notInvokedReason !== "noBoundedAnchor")) throw Error("THIS_FROZEN_ANALYSIS_REQUIRES_NO_CALL_SAMPLE")
const reference = await completedReference(), items = sample.items as SampleItem[]
const cohorts = Object.fromEntries((["A", "B"] as const).map(cohort => [cohort, { ...primary.cohorts[cohort],
 qualityMetricStatus: reference ? "humanEligibilityReviewedNoRealInterpretations" : "pendingBlindHumanReference",
 usefulObservationMetricStatus: "notDemonstratedNoRealObservations",
 humanEvaluation: analyzeNoCallCohort(items.filter(i => i.cohort === cohort).map(i => i.itemId), reference) }]))
const errors = reference?.items.flatMap(i => i.propositions.map(p => missRecord(i.itemId, items.find(s => s.itemId === i.itemId)!.cohort, p))) ?? []
const comparison = items.map(item => ({ itemId: item.itemId, cohort: item.cohort, sourceId: item.sourceId, runId: item.runId, postKey: item.postKey,
 originalSafety: { available: false, reason: "Original independent Safety result is not persisted separately; consolidated review is not Safety gold." },
 consolidatedReview: item.review ? { summary: item.review.summary, issues: item.review.issues.filter(i => i.postKey === item.postKey) } : null,
 middleware: { invoked: false, observations: 0 },
 humanPropositions: reference?.items.find(i => i.itemId === item.itemId)?.propositions ?? null,
 comparisonStatus: "originalSafetyComparisonUnavailable", categories: null }))
const refHash = reference ? sha256(await readFile(path.join(experiment, "review/reference.json"))) : null
const metrics = { sampleId: manifest.sampleId, sampleHash: manifest.sampleHash, generatedAt: new Date().toISOString(),
 evaluationStatus: reference ? "completedWithSeverelyLimitedRealContentEvidence" : "awaitingUserBlindReference",
 reference: { status: reference ? "completedBlindHumanEngineeringReferenceNotBenchmarkGold" : "pendingBlindHumanReference", reviewedItems: reference?.items.length ?? 0, requiredItems: items.length, hash: refHash },
 cohorts, errors, comparisonStatus: "originalSafetyUnavailableConsolidatedLinksOnly",
 probabilityAnalysis: { realDecisions: 0, distributions: null, wrongHighConfidence: null, selectiveBehavior: null, policy: "rawOnly", nativeAbstention: false, applicationDeadZoneUsed: false, productionThresholdSelected: false },
 repeatability: await json("results/repeatability/summary.json"), smoke,
 recommendation: recommendation(reference),
 readiness: [
  { capability: "Eligibility", status: reference && errors.length ? "not ready" : "promising but insufficient evidence", evidence: reference ? `${items.length} reviewed posts; ${errors.length} human slice propositions lacked a prepared anchor.` : "Human no-call review is pending." },
  { capability: "Interpretation", status: "promising but insufficient evidence", evidence: "No real-content family or polarity decisions; controlled smoke is protocol evidence only." },
  { capability: "Binding", status: "promising but insufficient evidence", evidence: "No real service/branch/time/amount or ellipsis binding was invoked. Phase 7B ellipsis limitation remains." },
  { capability: "Contract", status: "ready for limited shadow continuation", evidence: "4/4 controlled live observations structurally valid; identities/spans preserved. Real-content observation validity has no denominator." },
  { capability: "Operational usefulness", status: "promising but insufficient evidence", evidence: "Zero real observations; useful/total and cost/useful are undefined." },
  { capability: "Failure isolation", status: "ready for limited shadow continuation", evidence: "Exception/timeout/schema/storage fault checks preserve collection isolation; production consumers remain disabled and unchanged." },
 ],
 productionDecisionChanged: false, errorAttribution: "No-call misses belong to candidate/anchor preparation. No Jev, adaptation or projection error is inferred without invocation.",
 extraction: "Unsupported by current bounded interface; application owns source spans, literal candidates and IDs.",
 discovery: "Unsupported by current adapter; curated anchors and lexical selection tags are not proposition discovery." }
await save("results/analysis/metrics.json", metrics)
await save("results/analysis/errors.json", { status: reference ? "humanReferenceScored" : "pendingBlindHumanReference", records: errors })
await save("results/analysis/comparison.json", comparison)
await save("results/analysis/observation-scores.json", { status: "notDemonstratedNoInvokedRealAnchors", records: [], perFieldAccuracy: null, completeObservationAccuracy: null })
await save("results/analysis/ellipsis.json", { status: reference ? "humanReferenceScored" : "pendingBlindHumanReference", records: errors.filter(e => e.ellipsis.length), noJevYesAcceptedAsInheritance: true })
console.log(JSON.stringify({ status: metrics.evaluationStatus, reviewedItems: metrics.reference.reviewedItems, recommendation: metrics.recommendation.choice, humanMisses: reference ? errors.length : null }))
