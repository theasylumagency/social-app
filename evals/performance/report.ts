import { optimizationGate } from "../../src/application/evaluation/optimization-gate"
import { latencyStats, summarizeAttempts } from "../../src/application/evaluation/performance-report"
import { digest } from "./corpus"
import { DIAGNOSTIC_CASES } from "./runner"
import type { Arm, CaseReceipt, FrozenCorpus } from "./model"

export function pairedReport(corpus: FrozenCorpus, receipts: CaseReceipt[], plannedCases: readonly string[] = DIAGNOSTIC_CASES) {
  if (!plannedCases.length || new Set(plannedCases).size !== plannedCases.length || plannedCases.some(id => !DIAGNOSTIC_CASES.includes(id as typeof DIAGNOSTIC_CASES[number]))) throw Error("INVALID_PLANNED_CASES")
  const modes = new Set(receipts.map(row => row.mode)), runs = new Set(receipts.map(row => row.runId))
  if (modes.size > 1 || runs.size > 1) throw Error("MIXED_EVALUATION_RUNS")
  const live = receipts.length > 0 && modes.has("live-provider")
  const keys = receipts.map(row => `${row.caseId}:${row.arm}`)
  if (new Set(keys).size !== keys.length) throw Error("DUPLICATE_CASE_ARM")
  for (const row of receipts) {
    const item = corpus.cases.find(value => value.id === row.caseId)
    if (!item || !["baseline", "lowInterpreter"].includes(row.arm) || !plannedCases.includes(row.caseId)
      || row.corpusHash !== corpus.corpusHash || row.contextHash !== digest({ input: item.input, context: item.context })
      || !Number.isFinite(row.applicationMs) || row.applicationMs < 0 || (!row.result === !row.failure)) throw Error("INVALID_CASE_RECEIPT")
    if (new Set(row.providerRequestIds).size !== row.providerRequestIds.length || row.providerRequestIds.some(id => !row.modelRuns.some(run => run.id === id))) throw Error("INVALID_PROVIDER_ADMISSIONS")
    for (const run of row.modelRuns) {
      const interpreter = run.step === "contextual_notes", reviewer = ["post_review", "post_editorial"].includes(run.step)
      if (!["contextual_notes", "contextual_post_revision", "post_review", "post_editorial"].includes(run.step)
        || run.model !== (reviewer ? corpus.configuration.reviewModel : corpus.configuration.notesModel)
        || run.telemetry?.timeoutMs !== (reviewer ? 60000 : 40000)
        || run.telemetry.reasoningEffort !== (interpreter && row.arm === "lowInterpreter" ? "low" : null)) throw Error("EVALUATION_RESPONSIBILITIES_CHANGED")
    }
  }
  const pairs = plannedCases.map(caseId => {
    const baseline = receipts.find(row => row.caseId === caseId && row.arm === "baseline")
    const candidate = receipts.find(row => row.caseId === caseId && row.arm === "lowInterpreter")
    const firstInput = (row: CaseReceipt) => row.modelRuns.find(run => run.step === "contextual_notes")?.inputHash
    if (baseline && candidate && (!firstInput(baseline) || firstInput(baseline) !== firstInput(candidate))) throw Error("PAIRED_MODEL_INPUT_CHANGED")
    return { caseId, complete: !!baseline && !!candidate, baselineMs: live ? baseline?.applicationMs ?? null : null, candidateMs: live ? candidate?.applicationMs ?? null : null,
      baselineStatus: baseline?.result?.status ?? baseline?.failure?.kind ?? "missing", candidateStatus: candidate?.result?.status ?? candidate?.failure?.kind ?? "missing",
      baselineFailures: baseline?.result?.assertions.filter(check => !check.passed).map(check => check.id) ?? null,
      candidateFailures: candidate?.result?.assertions.filter(check => !check.passed).map(check => check.id) ?? null,
      pairedApplicationReduction: live && baseline && candidate && baseline.applicationMs > 0 ? 1 - candidate.applicationMs / baseline.applicationMs : null }
  })
  const complete = pairs.filter(pair => pair.complete)
  const arm = (name: Arm) => {
    const rows = receipts.filter(row => row.arm === name)
    return { completedArms: rows.length, providerRequests: rows.reduce((sum, row) => sum + row.providerRequestIds.length, 0), localAttemptRecords: rows.reduce((sum, row) => sum + row.modelRuns.length, 0), workflowFailures: rows.filter(row => row.failure).length,
      applicationMs: live ? latencyStats(rows.map(row => row.applicationMs)) : null, assertionFailures: rows.flatMap(row => row.result?.assertions.filter(check => !check.passed).map(check => ({ caseId: row.caseId, check: check.id, provenance: check.provenance })) ?? []),
      attempts: live ? summarizeAttempts(rows.flatMap(row => row.modelRuns.filter(run => row.providerRequestIds.includes(run.id)).map(run => ({ ...run, workflow: "paired-note-evaluation", workflowId: `${row.caseId}:${row.arm}`, telemetry: run.telemetry ?? null })))) : null }
  }
  const totalBaseline = complete.reduce((sum, row) => sum + row.baselineMs!, 0), totalCandidate = complete.reduce((sum, row) => sum + row.candidateMs!, 0)
  return { version: 1, corpusHash: corpus.corpusHash, receiptsHash: digest(receipts), mode: [...modes][0] ?? null, distinctCompletePairs: complete.length,
    plannedCaseIds: plannedCases, missingArms: plannedCases.flatMap(id => (["baseline", "lowInterpreter"] as const).filter(name => !receipts.some(row => row.caseId === id && row.arm === name)).map(arm => ({ caseId: id, arm }))),
    pairs, baseline: arm("baseline"), candidate: arm("lowInterpreter"),
    pairedSummedApplicationReduction: totalBaseline > 0 ? 1 - totalCandidate / totalBaseline : null,
    fullTimeReduction: null, totalCostReduction: null, independentHumanReview: "pending",
    gate: optimizationGate({ distinctCases: complete.length, sameInputsAndContext: complete.length > 0, currentPipeline: live, sameResponsibilities: true,
      independentQualityReference: false, criticalRegressions: null, requiredMeaningRegressions: null, languageVoiceScoreChange: null,
      falseBlockerRateChange: null, firstPassAcceptanceRateChange: null, fullTimeReduction: null, totalCostReduction: null }),
    evidenceLimits: [`This run planned ${plannedCases.length} controlled diagnostic pairs; it is not a representative population or a statistical equivalence study.`,
      "Application timing includes interpretation, optional single-channel writing and independent model review. Production queue, database persistence, weekly replanning and human confirmation are excluded.",
      "Failures remain in paired timing. A quick failed arm is not a quality improvement. Native usage includes every recorded retry/repair; unknown usage is not zero cost.",
      "Model reviews and mechanical assertions are not independent human quality labels. Mock receipts cannot establish latency, tokens, cost or quality.",
      "The production interpreter omits reasoning effort; its effective provider default is unknown. Only the candidate interpreter explicitly requests low."] }
}
