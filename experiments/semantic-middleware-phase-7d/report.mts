import { writeFile } from "node:fs/promises"
import path from "node:path"
import { experiment, json } from "./common.mjs"
const m = await json("results/analysis/metrics.json")
const reviewed = m.reference.reviewedItems === m.reference.requiredItems
const fmt = (n: number | null) => n === null ? "N/A" : String(n)
const cohortRows = (["A", "B"] as const).map(c => { const v = m.cohorts[c], p = v.providerMetrics; return `| ${c} | ${v.contentItems} | ${v.textSurfaces} | ${v.eligibleItems} | ${v.noCallItems} | ${p.providerRequests} | ${p.semanticDecisions} | $${v.totalCostUsd} |` }).join("\n")
const referenceRows = (["A", "B"] as const).map(c => { const h = m.cohorts[c].humanEvaluation, e = h.eligibility; return `| ${c} | ${h.reviewedItems}/${h.requiredReviewItems} | ${fmt(e.humanMaterialPropositions)} | ${fmt(e.correctlyIneligibleItems)} | ${fmt(e.materialItemRecall)} | ${fmt(e.unnecessaryInvocationRatePerInvocation)} |` }).join("\n")
const readiness = m.readiness.map((r: { capability: string; status: string; evidence: string }) => `| ${r.capability} | ${r.status} | ${r.evidence} |`).join("\n")
const report = `# Phase 7D — real-content shadow evaluation

Status: **${reviewed ? "Executed and blindly reviewed, with severely limited real-content evidence" : "Execution and tooling complete; user blind review pending"}**. Generated ${m.generatedAt}.

The live integration gate passed. The configured local source supplied only three verified real posts, and the unchanged Phase 7C grammar prepared no bounded anchors in their 21 text surfaces. There are zero real Jev interpretations to score. ${reviewed ? "The following eligibility/action findings come only from the user's completed blind reference." : "Eligibility correctness, material misses and action usefulness remain unknown until the user submits the blind queue. This is not a completed human evaluation."}

## Frozen sample and source limits

- Identity: \`${m.sampleId}\`, version 1.
- SHA-256: \`${m.sampleHash}\`.
- Cohort A: 2 naturally produced current complete Georgian posts; first chronological verified saved copies, ordered by run creation time and internal source ID, without semantic filtering. Target was 50.
- Cohort B: 1 additional real historical repair draft; first disjoint chronological verified copy matching the frozen lexical signal/negation/time/branch/contrast rules. Target was 25. Lexical tags do not establish semantic eligibility.
- Six stored current/repair copies were available. Three lacked matching non-mock writer receipts with nonzero input usage and were excluded as unverified. Archived plan/reviewer evaluations were excluded as unverified complete writer output. No synthetic quota filling, benchmark fixtures or new generated content entered the real sample.
- All three selected sources belong to one September 8 workflow run. They are not an independent population sample and cannot support prevalence/generalization claims. The small targeted cohort does not demonstrate eligible real cases.
- Database access used read-only transactions; source revisions, exact text hashes, writer receipts, selection and protocol code hashes are frozen. No model output or human label influenced selection.

## 1. Live integration smoke

Four controlled Phase 7A anchors were used only for the integration gate, separate from the real cohorts: exact price, denied discount, no slots, and an elliptical second branch clause. Authentication, native batched keyed Noul parsing, raw probability serialization, unchanged application IDs/spans and 4/4 structurally valid observations passed. Synthetic exception, timeout, malformed-response and storage-failure checks passed; they are failure-isolation evidence, not real semantic accuracy or an observed live timeout rate.

Smoke usage: 4 requests, 24 semantic decisions (6/request), 6,035 input and 468 output tokens. Mean/p50/p95 request latency: 441.615 / 308.998 / 726.058 ms. Observed live failures, timeouts and invalid responses: 0/4. Estimated cost: **$0.00025347**, using the published pinned-model input rate; this is not an invoice. [Official model rates](https://docs.typesafe.ai/models), checked October 6, 2026. No baseline provider was called.

## 2–6. Primary cohorts and blind eligibility review

| Cohort | Complete posts | Text surfaces | Eligible posts | No-call posts | Requests | Decisions | Cost estimate |
|---|---:|---:|---:|---:|---:|---:|---:|
${cohortRows}

All 21 fields received a trace, each with \`notInvoked / noBoundedAnchor\`. The natural and targeted cohorts remain separate. These operational counts alone cannot establish correct ineligibility.

Human reference status: **${m.reference.status}**, ${m.reference.reviewedItems}/${m.reference.requiredItems} complete posts. The reviewer sees complete public text and optional application anchors, without Jev labels, probabilities, dead-zone state, model name, provider output or existing reviewer judgments. Review covers every no-call field. Human labels are isolated engineering reference, not benchmark gold or Ontology v2 gold. ${reviewed ? `Reference hash: \`${m.reference.hash}\`.` : "No final reference file has been created by the agent."}

| Cohort | Human reviewed | Material propositions | Correctly ineligible posts | Material-item recall | Unnecessary invocation / invoked |
|---|---:|---:|---:|---:|---:|
${referenceRows}

Recall is undefined when there are no human material positives. Unnecessary-invocation rate per invoked item is undefined because there were zero invocations; the per-reviewed-post descriptive rate is stored separately. Null denominators are never presented as perfect accuracy.

## 7–10. Interpretation and complete observations

Family, polarity, service, branch, time, amount/basis and appropriate unresolved-state accuracy: **N/A, zero evaluated real observations**. Complete-observation accuracy: **N/A, 0/0**. No production threshold or exploratory cutoff was chosen. The default raw-only application policy would leave provider decisions not derived; it does not provide native abstention.

The analysis explicitly accepts only this frozen no-call sample. It refuses to silently score a changed sample with invocations. A future sample containing actual observations requires a versioned field-comparison evaluator covering consumer-required fields and unresolved states before quality can be reported. Empty observation scores here are evidence limits, not successful classifications.

## 11. Ellipsis and binding

Real ellipsis cases within the reviewed semantic slice: ${reviewed ? m.errors.filter((e: { ellipsis: string[] }) => e.ellipsis.length).length : "pending"}. Source spans and effects are retained in results/analysis/ellipsis.json where present. No real bounded candidate-binding question was asked, no context resolution was demonstrated and no shadow observation was produced. The Phase 7B omitted-service limitation remains: a Jev YES alone must not establish inherited service binding. The controlled smoke includes the safeguard, but cannot establish real-content ellipsis quality. General discourse antecedents outside the three-family slice were not scored.

## 12–14. Contract, confidence and repeatability

- Real-content provider failure, timeout and contract-invalid rates: N/A with zero requests/observations. Four controlled live observations were structurally valid; trace completeness is 21/21.
- Raw native probabilities remain in the smoke traces/native receipts. Real-content probability distributions, high-confidence errors and selective behavior: N/A. There was no application dead-zone, native UNCERTAIN or calibrated joint confidence.
- The repeat subset was frozen before primary execution: zero eligible real anchors, three planned passes, zero requests executed. Label flips, binding flips and probability variance are not demonstrated. Controlled fixtures were not substituted and no runs were cherry-picked.

## 15. Existing Safety comparison

Original independent Safety output is not persisted separately for these sources. Available consolidated per-post review is linked in results/analysis/comparison.json, labeled as consolidated review rather than Safety gold. The four Safety-versus-middleware comparison categories cannot be scored from missing original Safety output. Human reference remains independent.

## 16–17. Error stages, action consequences and usefulness

${reviewed ? `The human reference identifies ${m.errors.length} slice propositions with no prepared task. Each is recorded with its exact source span, polarity, binding/ellipsis notes, consumer sufficiency and the reviewer's analytical missed-action category.` : "No semantic errors or missed-action counts are inferred before human review. Empty error records are explicitly pending, not a claim of zero semantic errors."}

Any identified no-call miss belongs to **A candidate/eligibility preparation**. B proposition-anchor errors, C Jev interpretation errors, D adaptation/contract errors and E downstream projection errors have no invoked real cases to score. No application-owned source extraction or identity is credited to Jev.

Action categories are human analytical simulation only: no action difference, reviewer focus, unnecessary review/repair, missed necessary review/repair, wrong fact/entity binding, potentially wrong publication handling. Per-cohort counts and missed material action rates are in results/analysis/metrics.json. There were zero observation-caused interventions; false intervention rate per observation is undefined. No real handling changed.

${reviewed ? `Observed material slice misses: ${m.errors.length}; human-identified missed material-action propositions: ${m.cohorts.A.humanEvaluation.actions.missedMaterialActionPropositions + m.cohorts.B.humanEvaluation.actions.missedMaterialActionPropositions}; actual false interventions: 0. With no material positives or observations, both action-risk rates lack a denominator. These three negatives do not establish low risk for eligible cases.` : "Material-miss and action-impact counts remain pending human reference."}

Useful observations / all real observations = **N/A (0/0)**. Cost per useful observation = **N/A**, not zero. Potential named-consumer opportunities in human misses are counted separately; they are not delivered observations or demonstrated operational value.

## 18. Cost and latency

For each real cohort: zero requests, zero decisions, zero input/output provider tokens, zero cost per content item. Mean/p50/p95 request latency, decisions/request, timeout/failure rate, cost/eligible item and cost/useful observation are N/A. Total Phase 7D provider usage is the smoke's 4 requests/24 decisions/$0.00025347 estimate. Primary and repeatability added no provider cost. No claim is made about the speed of real eligible tasks.

## 19–20. Readiness and Phase 7E recommendation

| Capability | Readiness | Evidence |
|---|---|---|
${readiness}

${m.recommendation.choice ? `**Choose ${m.recommendation.choice}.** ${m.recommendation.rationale}` : `**Final A–F choice pending the user's blind review.** ${m.recommendation.rationale} The deterministic decision rule is C if real material slice propositions were missed, otherwise A for same-slice shadow continuation with a larger verified real sample. This rule is not a production probability threshold.`}

Neither the sample size nor the zero-invocation outcome supports reviewer admission, broad production activation, a new family slice or a verdict on unrestricted Jev quality. Free-form argument extraction, unrestricted proposition discovery, entity-ID resolution, native abstention and calibrated joint confidence remain unsupported/unproven by this adapter.

## 21. Isolation and files

All new repository artifacts are under experiments/semantic-middleware-phase-7d/. Original UNDA source/config/env files and frozen benchmark/review artifacts are checked byte-for-byte against the pre-phase snapshot; see integrity/verification.json. No production decision, prompt, repair, scheduling, approval, publication or user-facing behavior was changed. Shadow remains disabled in production configuration. Ontology v2 and the 834-item review remain untouched.

The existing local Docker/Postgres runtime was started for read-only source access. No database record, migration, worker or schema was changed. The only additional local server is the isolated blind-review page.

Validation: 348 existing offline tests and 13 isolated evaluation tests passed. Type checking and the domain build passed; Phase 7D lint finished with zero errors/warnings. No Next production build was run because this phase changed only isolated evaluation files. Results and commands are recorded in results/validation.json. The integrity receipt lists every created file and verifies 596 original UNDA plus 200 original benchmark files and both Git heads unchanged.

Files: sample-manifest.json, sample.json, prepared-tasks.json and frozen-files.json; review queue/template and human draft/reference when submitted; smoke receipts; primary traces/native responses/normalized observations; repeatability receipts; analysis metrics/errors/field scores/ellipsis/comparison; isolated scripts/tests; integrity receipts; this report and README.md. No existing repository file was modified. See README.md for offline analysis and review continuation.
`
await writeFile(path.join(experiment, "REPORT.md"), report)
console.log(JSON.stringify({ report: "REPORT.md", status: m.evaluationStatus }))
