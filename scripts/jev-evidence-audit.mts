import { createHash } from "node:crypto"
import { readFile, writeFile } from "node:fs/promises"
import { validateWeeklyV2 } from "../experiments/jev-request-routing-phase-7e/weekly-v2.mjs"
import { latencyStats } from "../src/application/evaluation/performance-report"
import { optimizationGate } from "../src/application/evaluation/optimization-gate"
import { evaluationReportPath } from "./evaluation-report-path.mjs"

const out = evaluationReportPath("docs/plans/2026-10-09-jev-evidence.json")
const directory = "experiments/jev-request-routing-phase-7e/"
const hash = (value: string | Buffer) => createHash("sha256").update(value).digest("hex")
const read = async (path: string) => readFile(directory + path, "utf8")
const sample = JSON.parse(await read("weekly-sample-v2.json"))
const { sampleHash, ...samplePayload } = sample
if (hash(JSON.stringify(samplePayload)) !== sampleHash) throw Error("FROZEN_SAMPLE_CHANGED")
const historicalSourceChanges = []
for (const [path, expected] of Object.entries(sample.codeHashes)) {
  const actual = hash(await readFile(path))
  // The frozen provider protocol/reference is replayed; historical app code is provenance only.
  if (path.startsWith(directory) && actual !== expected) throw Error(`FROZEN_PROTOCOL_CHANGED:${path}`)
  if (!path.startsWith(directory) && actual !== expected) historicalSourceChanges.push({ path, frozenHash: expected, currentHash: actual })
}
const referenceText = await read("user-reference.json"), reference = JSON.parse(referenceText)
const receiptsText = await read("results/weekly-jev-v2/requests.jsonl")
const receipts = receiptsText.trim().split("\n").map(line => JSON.parse(line))
if (receipts.length !== 15) throw Error("INCOMPLETE_FROZEN_RECEIPTS")
const identities = new Set<string>()
const cases = reference.items.map((item: { id: string; required: Record<string, string>; engineeringNegatives: Record<string, string> }) => {
  const source = sample.cases.find((candidate: { id: string }) => candidate.id === item.id)
  if (!source) throw Error("MISSING_CASE")
  const rows = receipts.filter(row => row.caseId === item.id)
  if (rows.length !== 3) throw Error("MISSING_CASE_PASSES")
  const passes = rows.map(row => {
    const identity = `${row.caseId}:${row.run}`
    if (identities.has(identity) || ![1, 2, 3].includes(row.run) || row.sampleHash !== sampleHash || row.failure !== null) throw Error("INVALID_RECEIPT")
    identities.add(identity)
    const actual = validateWeeklyV2(row.raw, source.text)
    const answers = actual.answers as Record<string, { choice: string }>
    const score = (required: Record<string, string>) => Object.entries(required).map(([field, expected]) => ({ field, expected, actual: answers[field]!.choice, passed: answers[field]!.choice === expected }))
    return { pass: row.run, latencyMs: row.latencyMs, humanConfirmedFields: score(item.required), engineeringNegatives: score(item.engineeringNegatives),
      cadenceBasisEngineeringControl: { expected: item.id === "U03" ? "perWeekAcrossRange" : item.id === "U01" || item.id === "U05" ? "currentWeekTotal" : "notSpecified", actual: actual.answers.cadenceBasis!.choice },
      consistencyIssues: actual.observation.consistencyIssues }
  })
  return { caseId: item.id, latencyMs: latencyStats(rows.map(row => row.latencyMs)), passes }
})
const baseline = JSON.parse(await read("results/comparison-v1.json"))
const report = { version: 1, mode: "offline-frozen-receipt-revalidation", providerCalled: false, sourceHashes: {
  sample: sampleHash, reference: hash(referenceText), receipts: hash(receiptsText) }, historicalSourceChanges, distinctUserTasks: cases.length, jevRequests: receipts.length,
  requiredFieldFailures: cases.flatMap((item: { passes: { humanConfirmedFields: { passed: boolean }[] }[] }) => item.passes.flatMap(pass => pass.humanConfirmedFields)).filter((field: { passed: boolean }) => !field.passed).length,
  engineeringNegativeFailures: cases.flatMap((item: { passes: { engineeringNegatives: { passed: boolean }[] }[] }) => item.passes.flatMap(pass => pass.engineeringNegatives)).filter((field: { passed: boolean }) => !field.passed).length,
  cases, recordedInterpretationStage: { baseline: baseline.baseline.latencyMs, jev: latencyStats(receipts.map(row => row.latencyMs)),
    comparableResponsibilities: false, fullPipelineBenefit: null, monetaryCostUsd: null },
  admission: optimizationGate({ distinctCases: cases.length, sameInputsAndContext: false, currentPipeline: false, sameResponsibilities: false,
    independentQualityReference: false, criticalRegressions: null, requiredMeaningRegressions: null, languageVoiceScoreChange: null,
    falseBlockerRateChange: null, firstPassAcceptanceRateChange: null, fullTimeReduction: null, totalCostReduction: null }),
  semanticQualityEvidence: { realPosts: 3, materialPositives: 0, realJevObservations: 0, recall: null, reviewerAdmission: false },
  limits: ["Five distinct tasks and three repeats are not fifteen independent tasks.", "Human-confirmed semantic fields are not blind final-content quality labels.",
    "Baseline and Jev have different responsibilities, context and recording periods.", "The wider interpreter and downstream planner/review/queue/fallback costs were not replaced or measured.",
    "Phase 7D has no material-positive denominator; zero missed positives does not establish recall."] }
await writeFile(out, JSON.stringify(report, null, 2) + "\n", { flag: "wx" })
console.log(JSON.stringify({ distinctTasks: report.distinctUserTasks, requests: report.jevRequests, requiredFieldFailures: report.requiredFieldFailures,
  engineeringNegativeFailures: report.engineeringNegativeFailures, admission: report.admission }))
