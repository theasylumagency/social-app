import { appendFile, mkdir, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { createBrandReasoner, type BrandModelRun } from "../../src/infrastructure/models/brand-reasoning"
import { modelFailure } from "../../src/infrastructure/models/runtime-policy"
import { assertFrozenCorpus } from "./freeze"
import { digest } from "./corpus"
import { evaluationBudget, EvaluationBudgetError, type BudgetLimits } from "./budget"
import { evaluateWorkflow } from "./workflow"
import type { Arm, CaseReceipt, FrozenCorpus } from "./model"

export const DIAGNOSTIC_CASES = ["U04", "U05", "C01", "C04", "E01", "E06"] as const
export const DIAGNOSTIC_LIMITS: BudgetLimits = { maxRequests: 48, maxInputBytes: 4000000, maxOutputTokens: 80000, maxMinutes: 20 }
// Alternate first arm; the hash changes only which arm starts the balanced sequence.
export function armOrder(corpusHash: string, pairIndex: number): Arm[] {
  return (parseInt(corpusHash.slice(0, 2), 16) + pairIndex) % 2 ? ["lowInterpreter", "baseline"] : ["baseline", "lowInterpreter"]
}
export async function runPairs(corpus: FrozenCorpus, directory: string, options: { mode: "live-provider" | "mock-contract"; fetch?: typeof fetch; limits?: BudgetLimits; caseIds?: readonly string[] }) {
  await assertFrozenCorpus(corpus)
  const caseIds = options.caseIds ?? DIAGNOSTIC_CASES
  if (!caseIds.length || new Set(caseIds).size !== caseIds.length || caseIds.some(id => !DIAGNOSTIC_CASES.includes(id as typeof DIAGNOSTIC_CASES[number]))) throw Error("INVALID_DIAGNOSTIC_CASES")
  if (options.mode === "live-provider" && !process.env.OPENAI_API_KEY) throw Error("EVALUATION_API_KEY_REQUIRED")
  if (options.mode === "mock-contract" && !options.fetch) throw Error("MOCK_FETCH_REQUIRED")
  const budget = evaluationBudget(options.limits ?? DIAGNOSTIC_LIMITS, options.fetch)
  // mkdir without recursive prevents overwriting or resuming incomplete evidence.
  await mkdir(directory)
  const runId = directory.split(/[\\/]/u).at(-1)!
  const manifest = { version: 1, runId, corpusHash: corpus.corpusHash, mode: options.mode, caseIds,
    configuration: corpus.configuration, limits: options.limits ?? DIAGNOSTIC_LIMITS, scope: "prepare-note-and-selected-revision-review", productionWrites: false }
  await writeFile(join(directory, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n", { flag: "wx" })
  await writeFile(join(directory, "attempts.jsonl"), "", { flag: "wx" })
  await writeFile(join(directory, "receipts.jsonl"), "", { flag: "wx" })
  const receipts: CaseReceipt[] = []
  let halted: string | null = null
  let persistenceFailure = false
  for (const [pairIndex, caseId] of caseIds.entries()) {
    const item = corpus.cases.find(value => value.id === caseId)!
    if (!item) throw Error("DIAGNOSTIC_CASE_MISSING")
    for (const [order, arm] of armOrder(corpus.corpusHash, pairIndex).entries()) {
      const runs: BrandModelRun[] = [], reviewRuns: BrandModelRun[] = [], providerRequestIds: string[] = []
      // Concurrent review callbacks serialize complete append operations through this promise.
      let writes = Promise.resolve()
      const record = async (modelRun: BrandModelRun) => {
        const sentToProvider = budget.consumeAdmission(modelRun.telemetry!.requestHash)
        writes = writes.then(() => appendFile(join(directory, "attempts.jsonl"), JSON.stringify({ runId, caseId, arm, sentToProvider, modelRun }) + "\n"))
        try { await writes } catch (error) { persistenceFailure = true; throw error }
        runs.push(modelRun)
        if (sentToProvider) providerRequestIds.push(modelRun.id)
      }
      const configuration = corpus.configuration
      const common = { fetch: budget.fetch, apiKey: options.mode === "mock-contract" ? "offline-fixture" : process.env.OPENAI_API_KEY!,
        model: configuration.notesModel, requestTimeoutMs: configuration.noteTimeoutMs }
      const baseline = createBrandReasoner(record, common)
      const candidate = createBrandReasoner(record, { ...common, reasoningEffort: "low" })
      const notes: typeof baseline = call => arm === "lowInterpreter" && call.step === "contextual_notes" ? candidate(call) : baseline(call)
      const review = createBrandReasoner(async modelRun => { await record(modelRun); reviewRuns.push(modelRun) },
        { ...common, model: configuration.reviewModel, requestTimeoutMs: configuration.reviewTimeoutMs })
      const startedAt = new Date().toISOString(), started = performance.now()
      let result: CaseReceipt["result"] = null, phases: CaseReceipt["phases"] = [], failure: CaseReceipt["failure"] = null
      try { ({ result, phases } = await evaluateWorkflow(item, corpus.week, notes, review, reviewRuns)) }
      catch (error) {
        failure = error instanceof EvaluationBudgetError ? { kind: "evaluation_budget", transient: false } : modelFailure(error)
        if (error instanceof EvaluationBudgetError) halted = "evaluation_budget"
        if (failure.httpStatus && [400, 401, 403, 404, 422].includes(failure.httpStatus)) halted = "provider_configuration"
        if (persistenceFailure) throw Error("EVALUATION_RECEIPT_PERSISTENCE_FAILED")
      }
      // reviewPosts joins both parallel reviewers, including failures, before this point.
      await writes
      const receipt: CaseReceipt = { corpusHash: corpus.corpusHash, caseId, arm, pairIndex, order, runId,
        contextHash: digest({ input: item.input, context: item.context }), mode: options.mode, startedAt, completedAt: new Date().toISOString(),
        applicationMs: performance.now() - started, phases, modelRuns: runs, providerRequestIds, result, failure,
        productionQueueMs: null, databasePersistenceMs: null, monetaryCostUsd: null }
      await appendFile(join(directory, "receipts.jsonl"), JSON.stringify(receipt) + "\n")
      receipts.push(receipt)
      process.stdout.write(JSON.stringify({ caseId, arm, status: result?.status ?? failure?.kind, requests: budget.snapshot().requests }) + "\n")
      if (halted) break
    }
    if (halted) break
  }
  const summary = { ...manifest, completedAt: new Date().toISOString(), completedArms: receipts.length, halted, budget: budget.snapshot(),
    receiptsHash: digest(receipts), independentHumanReview: "pending", productionQueueMs: null, databasePersistenceMs: null, fullTimeReduction: null }
  await writeFile(join(directory, "summary.json"), JSON.stringify(summary, null, 2) + "\n", { flag: "wx" })
  return { receipts, summary }
}
