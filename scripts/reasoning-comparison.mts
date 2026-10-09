import { readFile, writeFile, appendFile, mkdir } from "node:fs/promises"
import { createHash } from "node:crypto"
import { resolve, relative } from "node:path"
import { effortCases, captureEffortCalls, EFFORTS, type Effort } from "../evals/reasoning-comparison/cases"
import { EffortBudget, EFFORT_LIMITS, MODEL } from "../evals/reasoning-comparison/budget"
import { PRICING_SOURCES, MODEL_PRICES, type HttpReceipt } from "../evals/model-comparison/cost"
import { freezeCorpus } from "../evals/performance/freeze"
import { digest } from "../evals/performance/corpus"
import { WEEK, type Check } from "../evals/model-comparison/cases"
import { createBrandReasoner, type BrandModelRun, type BrandReasoner } from "../src/infrastructure/models/brand-reasoning"
import { modelFailure } from "../src/infrastructure/models/runtime-policy"

type Receipt = Omit<HttpReceipt, "arm"> & { effort: Effort; repetition: number }
type Result = { caseId: string; role: string; effort: Effort; repetition: number; inputDigest: string; durationMs: number; output: unknown; failure: ReturnType<typeof modelFailure> | null; checks: Check[]; modelRuns: BrandModelRun[]; requests: Receipt[] }
const hashFile = async (file: string) => createHash("sha256").update(await readFile(file)).digest("hex")
async function main() {
  const [target, mode] = process.argv.slice(2)
  const root = resolve(".local/reasoning-comparison"), directory = resolve(target ?? "")
  if (!target || !["--prepare", "--live"].includes(mode ?? "") || !/^[-a-zA-Z0-9]+$/u.test(relative(root, directory))) throw Error("USE_NEW_LOCAL_REASONING_DIRECTORY_AND_MODE")
  const live = mode === "--live"
  if (live && (!process.env.OPENAI_API_KEY || process.env.OPENAI_POST_WRITER_MODEL?.trim() !== MODEL || process.env.OPENAI_PLANNING_MODEL?.trim() !== MODEL)) throw Error("EFFORT_MODEL_CONFIGURATION_MISMATCH")
  const cases = await effortCases(), prepared = await Promise.all(cases.map(async item => ({ id: item.id, title: item.title, role: item.role, rubric: item.rubric, calls: await captureEffortCalls(item) })))
  if (cases.length !== 8 || prepared.some(item => !item.calls.length)) throw Error("EFFORT_CASES_MISSING")
  const base = await freezeCorpus(WEEK)
  const additionalFiles = ["evals/reasoning-comparison/cases.ts", "evals/reasoning-comparison/budget.ts", "evals/model-comparison/cases.ts", "evals/model-comparison/cost.ts", "scripts/reasoning-comparison.mts", "tests/reasoning-comparison.test.mts"]
  const sourceHashes = { ...base.sourceHashes, ...Object.fromEntries(await Promise.all(additionalFiles.map(async file => [file, await hashFile(file)]))) }
  const manifest = { version: 1, createdAt: new Date().toISOString(), model: MODEL, efforts: EFFORTS, repetitions: 2, cases: prepared, sourceHashes, limits: EFFORT_LIMITS, pricing: { capturedAt: "2026-10-09", tier: "default", ratesPerMillion: MODEL_PRICES[MODEL], sources: PRICING_SOURCES }, qualityAssessment: { independentHuman: false, rubricFrozenBeforeCalls: true, assistantQualitativeReview: "pending", automaticActivation: false }, productionWrites: false }
  const manifestHash = digest(manifest)
  await mkdir(root, { recursive: true }); await mkdir(directory)
  await writeFile(`${directory}/manifest.json`, JSON.stringify({ ...manifest, manifestHash }, null, 2) + "\n", { flag: "wx" })
  if (!live) { console.log(JSON.stringify({ preparedCases: prepared.length, plannedArms: 48, minimumProviderRequests: 66, manifestHash, providerRequests: 0 })); return }
  for (const file of ["requests.jsonl", "model-runs.jsonl", "results.jsonl"]) await writeFile(`${directory}/${file}`, "", { flag: "wx" })
  const budget = new EffortBudget(), receipts: Receipt[] = [], results: Result[] = []
  let tag = { caseId: "", effort: "low" as Effort, repetition: 0 }, halted: string | null = null, writes = Promise.resolve()
  const persist = (file: string, value: unknown) => { writes = writes.then(() => appendFile(`${directory}/${file}`, JSON.stringify(value) + "\n")); return writes }
  const limitedFetch: typeof fetch = async (url, init) => {
    if (String(url) !== "https://api.openai.com/v1/responses" || init?.method !== "POST" || typeof init.body !== "string") throw Error("EFFORT_PROVIDER_BOUNDARY")
    const body = { ...JSON.parse(init.body), service_tier: "default", store: false }
    if (body.model !== MODEL || body.reasoning?.effort !== tag.effort || body.max_output_tokens !== 10000) throw Error("EFFORT_REQUEST_CONFIGURATION_CHANGED")
    const serialized = JSON.stringify(body), bytes = Buffer.byteLength(serialized)
    let reservation: number
    try { reservation = budget.admit(bytes, 10000) } catch (error) { halted = "shared-budget-limit"; throw error }
    const started = performance.now()
    const receipt: Receipt = { ...tag, model: MODEL, responseModel: null, serviceTier: null, requestHash: digest(serialized), startedAt: new Date().toISOString(), durationMs: 0, requestBytes: bytes, inputHash: digest(body.input), promptHash: digest(body.instructions), schemaHash: digest(body.text.format.schema), usage: null, estimatedCost: { usd: null, lowerUsd: null, upperUsd: null }, status: null, failure: null }
    try {
      const response = await fetch(url, { ...init, body: serialized, signal: AbortSignal.any([...(init.signal ? [init.signal] : []), AbortSignal.timeout(Math.max(1, Math.ceil(budget.remainingMs())))]) })
      receipt.status = response.status
      try { const raw = await response.clone().json() as { usage?: unknown; model?: string; service_tier?: string }; receipt.usage = raw.usage ?? null; receipt.responseModel = raw.model ?? null; receipt.serviceTier = raw.service_tier ?? null } catch { /* Unknown usage retains the admission reservation. */ }
      return response
    } catch (error) { receipt.failure = modelFailure(error).kind; throw error }
    finally { receipt.durationMs = performance.now() - started; receipt.estimatedCost = budget.settle(reservation, receipt.usage, receipt.serviceTier); receipts.push(receipt); await persist("requests.jsonl", receipt) }
  }
  // Rotate the starting level across cases and repetitions to reduce a consistent order advantage.
  for (let repetition = 1; repetition <= 2 && !halted; repetition++) {
    for (const [index, item] of cases.entries()) {
      const offset = (index + repetition - 1) % 3, order = [...EFFORTS.slice(offset), ...EFFORTS.slice(0, offset)]
      for (const effort of order) {
        if (halted) break
        tag = { caseId: item.id, effort, repetition }
        const runs: BrandModelRun[] = [], startRequest = receipts.length
        const reason = createBrandReasoner(async run => { runs.push(run); await persist("model-runs.jsonl", { ...tag, run }) }, { model: MODEL, reasoningEffort: effort, requestTimeoutMs: 150000, fetch: limitedFetch })
        const expected = prepared[index]!.calls.map(call => digest(call))
        const checked: BrandReasoner = call => {
          if (!expected.includes(digest({ step: call.step, version: call.version, prompt: call.prompt, input: call.input, schema: call.schema, language: call.outputLanguage ?? "ka" }))) throw Error("EFFORT_FROZEN_INPUT_CHANGED")
          return reason(call)
        }
        const started = performance.now(); let output: unknown = null, failure: Result["failure"] = null, checks: Check[] = []
        try { output = await item.execute(checked); checks = item.checks(output) } catch (error) { failure = modelFailure(error) }
        await writes
        const result: Result = { ...tag, role: item.role, inputDigest: digest(prepared[index]!.calls), durationMs: performance.now() - started, output, failure, checks, modelRuns: runs, requests: receipts.slice(startRequest) }
        results.push(result); await persist("results.jsonl", result)
        console.log(JSON.stringify({ ...tag, seconds: result.durationMs / 1000, passed: checks.filter(check => check.passed).length, total: checks.length, failure, providerRequests: budget.requests, estimatedUsd: budget.spentUpperUsd }))
      }
      if (halted) break
    }
  }
  await writes
  for (const [file, hash] of Object.entries(sourceHashes)) if (await hashFile(file) !== hash) throw Error(`EFFORT_SOURCE_CHANGED:${file}`)
  const summary = (effort: Effort) => {
    const selected = results.filter(result => result.effort === effort), requests = selected.flatMap(result => result.requests)
    return { arms: selected.length, providerRequests: requests.length, summedStageMs: selected.reduce((sum, result) => sum + result.durationMs, 0), failedArms: selected.filter(result => result.failure).length, checksPassed: selected.flatMap(result => result.checks).filter(check => check.passed).length, checksTotal: selected.flatMap(result => result.checks).length, invalidAttempts: selected.flatMap(result => result.modelRuns).filter(run => run.validationErrors.length).length, estimatedCostUsd: requests.every(request => request.estimatedCost.usd !== null) ? requests.reduce((sum, request) => sum + request.estimatedCost.usd!, 0) : null, outputTokens: requests.reduce((sum, request) => sum + ((request.usage as { output_tokens?: number } | null)?.output_tokens ?? 0), 0), reasoningTokens: requests.reduce((sum, request) => sum + ((request.usage as { output_tokens_details?: { reasoning_tokens?: number } } | null)?.output_tokens_details?.reasoning_tokens ?? 0), 0) }
  }
  const report = { version: 1, model: MODEL, manifestHash, resultsHash: digest(results), requestsHash: digest(receipts), completedAt: new Date().toISOString(), expectedArms: 48, completedArms: results.length, halted, summaries: Object.fromEntries(EFFORTS.map(effort => [effort, summary(effort)])), budget: budget.snapshot(), productionWrites: false, fullWorkflowTime: null, actualInvoiceUsd: null, independentHumanQuality: "not-collected", assistantQualityReview: "pending", automaticActivation: false, limitations: ["Eight controlled cases, two repetitions per effort; not representative live traffic or a statistical quality/latency estimate.", "Native usage, cache writes/reads, retries and failures are included. Cost is a standard-rate estimate, not an invoice.", "A sum of isolated stages does not include production queue, downstream per-post workload, images, database or publishing.", "Named checks establish their own requirements only. Model reviewers are test subjects, not independent judges.", "Same current prompts, validators, output cap and request timeout across efforts; high is compared without rewriting prompts."] }
  await writeFile(`${directory}/report.json`, JSON.stringify(report, null, 2) + "\n", { flag: "wx" })
  const mapping: { caseId: string; label: string; effort: Effort; repetition: number }[] = []
  for (const item of prepared) {
    const chosen = results.filter(result => result.caseId === item.id).sort((a, b) => digest([a.caseId, a.effort, a.repetition]).localeCompare(digest([b.caseId, b.effort, b.repetition])))
    const text = [`# ${item.title}`, "", "მსჯელობის დონე და დრო დაფარულია; ადამიანური შეფასება ავტომატურად არ ენიჭება.", "", "კრიტერიუმები:", "", ...item.rubric.map(value => `- ${value}`), ""]
    for (const [index, result] of chosen.entries()) {
      const label = String.fromCharCode(65 + index); mapping.push({ caseId: item.id, label, effort: result.effort, repetition: result.repetition })
      text.push(`## ${label}`, "", "~~~json", JSON.stringify({ output: result.output, failure: result.failure }, null, 2), "~~~", "")
    }
    await writeFile(`${directory}/quality-${item.id}.md`, text.join("\n"), { flag: "wx" })
  }
  await writeFile(`${directory}/quality-mapping.private.json`, JSON.stringify({ manifestHash, resultsHash: report.resultsHash, mapping }, null, 2) + "\n", { flag: "wx" })
  console.log(JSON.stringify({ complete: results.length === 48, report: `${directory}/report.json`, summaries: report.summaries, budget: report.budget }))
}
main().catch(error => { console.error(error instanceof Error ? error.message : "EFFORT_COMPARISON_FAILED"); process.exitCode = 1 })
