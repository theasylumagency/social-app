import { appendFile, mkdir, readFile, writeFile } from "node:fs/promises"
import { join, resolve, relative } from "node:path"
import { createHash } from "node:crypto"
import { comparisonCases, captureCalls, WEEK, type Check } from "../evals/model-comparison/cases"
import { estimateCost, reserveCost, MODEL_PRICES, PRICING_SOURCES, LIMITS, type HttpReceipt, type PricedModel } from "../evals/model-comparison/cost"
import { digest } from "../evals/performance/corpus"
import { freezeCorpus } from "../evals/performance/freeze"
import { createBrandReasoner, type BrandModelRun } from "../src/infrastructure/models/brand-reasoning"
import { modelFailure } from "../src/infrastructure/models/runtime-policy"
import { validateSchema } from "../src/blueprints/social/brand-discovery/validation"
import type { JsonSchema } from "../src/blueprints/social/brand-discovery/schemas"
import type { BrandModelRequest } from "../src/infrastructure/web/brand-model-extraction"

const hashFile = async (path: string) => createHash("sha256").update(await readFile(path)).digest("hex")
const nativeOutput = (body: { output?: { content?: { type: string; text?: string }[] }[] }) => body.output?.flatMap(item => item.content ?? []).filter(content => content.type === "output_text").map(content => content.text ?? "").join("") ?? ""
const escapeMarkdown = (value: string) => value.replace(/[|\r\n]/gu, " ")
type Result = { caseId: string; title: string; role: string; arm: "old" | "new"; model: string; effort: string; inputDigest: string; durationMs: number; output: unknown; checks: Check[]; failure: ReturnType<typeof modelFailure> | null; modelRuns: BrandModelRun[]; requests: HttpReceipt[] }

async function main() {
  const args = process.argv.slice(2), live = args[1] === "--live", dry = args[1] === "--prepare"
  if (args.length !== 2 || !live && !dry) throw Error("USAGE: <new-output-directory> --prepare|--live")
  const root = resolve(".local/model-comparison"), directory = resolve(args[0]!)
  if (!relative(root, directory) || relative(root, directory).startsWith("..") || !directory.startsWith(root + "/") && !directory.startsWith(root + "\\")) throw Error("COMPARISON_OUTPUT_BOUNDARY")
  if (live && !process.env.OPENAI_API_KEY) throw Error("COMPARISON_API_KEY_REQUIRED")
  const expected = { OPENAI_PLANNING_MODEL: "gpt-6.1-sol", OPENAI_POST_PLANNER_MODEL: "gpt-6.1-sol", OPENAI_POST_WRITER_MODEL: "gpt-6.1-sol", OPENAI_POST_REVIEW_MODEL: "gpt-6.1-sol", OPENAI_BRAND_MODEL: "gpt-6.1-sol", OPENAI_EXTRACTION_MODEL: "gpt-6-luna", OPENAI_EXTRACTION_FALLBACK_MODEL: "gpt-6.1-sol", OPENAI_CONTEXTUAL_NOTES_MODEL: "gpt-6.1-sol" }
  if (Object.entries(expected).some(([key, model]) => process.env[key]?.trim() !== model)) throw Error("NEW_MODEL_CONFIGURATION_DIFFERS_FROM_PLANNED_COMPARISON")
  const cases = await comparisonCases(), prepared = await Promise.all(cases.map(async item => ({ id: item.id, title: item.title, role: item.role, effort: item.effort, oldModel: item.oldModel, newModel: item.newModel, calls: await captureCalls(item) })))
  const base = await freezeCorpus(WEEK)
  const sourceHashes = { ...base.sourceHashes, ...Object.fromEntries(await Promise.all(["evals/model-comparison/cases.ts", "evals/model-comparison/cost.ts", "scripts/model-comparison.mts"].map(async file => [file, await hashFile(file)]))) }
  const manifest = { version: 1, mode: live ? "live-provider" : "prepare-only", createdAt: new Date().toISOString(), cases: prepared, sourceHashes, newConfiguration: expected, limits: LIMITS,
    pricing: { capturedAt: "2026-10-09", tier: "standard", maxInputTokens: 272000, ratesPerMillion: MODEL_PRICES, sources: PRICING_SOURCES },
    scope: "isolated-stage-diagnostic", productionWrites: false, independentHumanQuality: "pending", effortComparison: false }
  const manifestHash = digest(manifest)
  await mkdir(root, { recursive: true }); await mkdir(directory)
  await writeFile(join(directory, "manifest.json"), JSON.stringify({ ...manifest, manifestHash }, null, 2) + "\n", { flag: "wx" })
  if (dry) { console.log(JSON.stringify({ preparedCases: cases.length, manifestHash, providerRequests: 0 })); return }
  await writeFile(join(directory, "requests.jsonl"), "", { flag: "wx" }); await writeFile(join(directory, "results.jsonl"), "", { flag: "wx" }); await writeFile(join(directory, "model-runs.jsonl"), "", { flag: "wx" })
  const requests: HttpReceipt[] = [], results: Result[] = []
  let tag = { caseId: "", arm: "old" as "old" | "new" }, writes = Promise.resolve(), sent = 0, sentBytes = 0, spentUpperUsd = 0, pendingUsd = 0, pendingOutput = 0, unknownOutput = 0, knownOutput = 0, halted: string | null = null
  const started = performance.now()
  const persist = (file: string, value: unknown) => { writes = writes.then(() => appendFile(join(directory, file), JSON.stringify(value) + "\n")); return writes }
  const limitedFetch: typeof fetch = async (url, init) => {
    if (String(url) !== "https://api.openai.com/v1/responses" || init?.method !== "POST" || typeof init.body !== "string") throw Error("COMPARISON_PROVIDER_BOUNDARY")
    const body = { ...JSON.parse(init.body), service_tier: "default", store: false }
    const model = body.model as PricedModel, maxOutput = body.max_output_tokens as number
    if (!(model in MODEL_PRICES) || ![6000, 10000].includes(maxOutput)) throw Error("COMPARISON_REQUEST_CONFIGURATION_CHANGED")
    const serialized = JSON.stringify(body), bytes = Buffer.byteLength(serialized), reservation = reserveCost(model, bytes, maxOutput)
    if (sent >= LIMITS.requests || sentBytes + bytes > LIMITS.requestBytes || knownOutput + pendingOutput + unknownOutput + maxOutput > LIMITS.outputTokens
      || spentUpperUsd + pendingUsd + reservation > LIMITS.estimatedUsd || performance.now() - started >= LIMITS.minutes * 60000) { halted = "shared-budget-limit"; throw Error("COMPARISON_BUDGET_EXHAUSTED") }
    sent++; sentBytes += bytes; pendingUsd += reservation; pendingOutput += maxOutput
    const receipt: HttpReceipt = { ...tag, model, responseModel: null, serviceTier: null, requestHash: digest(serialized), startedAt: new Date().toISOString(), durationMs: 0, requestBytes: bytes,
      inputHash: digest(body.input), promptHash: digest(body.instructions), schemaHash: digest(body.text.format.schema), effort: body.reasoning?.effort ?? "omitted", usage: null, estimatedCost: { usd: null, lowerUsd: null, upperUsd: null }, status: null, failure: null }
    const requestStarted = performance.now(); let known = false
    try {
      const remainingMs = Math.max(1, Math.ceil(LIMITS.minutes * 60000 - (performance.now() - started)))
      const response = await fetch(url, { ...init, body: serialized, signal: AbortSignal.any([...(init.signal ? [init.signal] : []), AbortSignal.timeout(remainingMs)]) })
      receipt.status = response.status
      try {
        const raw = await response.clone().json() as { usage?: unknown; model?: string; service_tier?: string }
        receipt.usage = raw.usage ?? null; receipt.responseModel = raw.model ?? null; receipt.serviceTier = raw.service_tier ?? null
        const compatibleTier = !raw.service_tier || ["default", "standard"].includes(raw.service_tier)
        receipt.estimatedCost = compatibleTier ? estimateCost(model, raw.usage) : { usd: null, lowerUsd: null, upperUsd: null }
        const usage = raw.usage as { output_tokens?: unknown } | undefined
        if (typeof usage?.output_tokens === "number" && Number.isSafeInteger(usage.output_tokens) && usage.output_tokens >= 0 && usage.output_tokens <= maxOutput && receipt.estimatedCost.upperUsd !== null) {
          knownOutput += usage.output_tokens; spentUpperUsd += receipt.estimatedCost.upperUsd; known = true
        }
      } catch { /* Native usage remains unknown; retain the full cost and output reservation. */ }
      return response
    } catch (error) { receipt.failure = modelFailure(error).kind; throw error }
    finally {
      receipt.durationMs = performance.now() - requestStarted; pendingUsd -= reservation; pendingOutput -= maxOutput
      if (!known) { spentUpperUsd += reservation; unknownOutput += maxOutput }
      requests.push(receipt); await persist("requests.jsonl", receipt)
    }
  }
  for (const [index, item] of cases.entries()) {
    for (const arm of index % 2 ? ["new", "old"] as const : ["old", "new"] as const) {
      if (halted) break
      tag = { caseId: item.id, arm }
      const model = arm === "old" ? item.oldModel : item.newModel, modelRuns: BrandModelRun[] = [], requestStart = requests.length
      const reason = createBrandReasoner(async run => { modelRuns.push(run); await persist("model-runs.jsonl", { ...tag, run }) }, { model, reasoningEffort: item.effort === "none" ? "low" : item.effort, requestTimeoutMs: item.role === "notes" ? 40000 : 60000, fetch: limitedFetch })
      const expectedCalls = prepared[index]!.calls.map(call => digest(call))
      const auditedReason: typeof reason = call => {
        const signature = digest({ step: call.step, version: call.version, prompt: call.prompt, input: call.input, schema: call.schema, language: call.outputLanguage ?? "ka" })
        if (!expectedCalls.includes(signature)) throw Error("COMPARISON_FROZEN_INPUT_CHANGED")
        return reason(call)
      }
      const extract = async (request: BrandModelRequest) => {
        if (!expectedCalls.includes(digest({ step: "extraction", prompt: request.instructions, input: request.input, schema: request.schema }))) throw Error("COMPARISON_FROZEN_EXTRACTION_CHANGED")
        const response = await limitedFetch("https://api.openai.com/v1/responses", { method: "POST", signal: AbortSignal.timeout(25000), headers: { authorization: `Bearer ${process.env.OPENAI_API_KEY}`, "content-type": "application/json" },
          body: JSON.stringify({ model: request.model, instructions: request.instructions, input: request.input, reasoning: { effort: request.model === "gpt-5.4-nano" || request.model === "gpt-6-luna" ? "none" : "medium" }, text: { verbosity: "low", format: { type: "json_schema", name: "brand_website_profile", strict: true, schema: request.schema } }, max_output_tokens: 6000, prompt_cache_key: "unda-brand-website-extraction-v1", store: false }) })
        if (!response.ok) throw Error(`MODEL_HTTP_${response.status}`)
        const raw = await response.json(); if (raw.status === "incomplete") throw Error("MODEL_INCOMPLETE")
        const result = JSON.parse(nativeOutput(raw)); if (validateSchema(result, request.schema as JsonSchema).length) throw Error("MODEL_CONTRACT_EXTRACTION")
        return result
      }
      const armStarted = performance.now(); let output: unknown = null, failure: Result["failure"] = null, checks: Check[] = []
      try { output = await item.execute(auditedReason, extract, arm); checks = item.checks(output) } catch (error) { failure = modelFailure(error) }
      await writes
      const result: Result = { caseId: item.id, title: item.title, role: item.role, arm, model, effort: item.effort, inputDigest: digest(prepared[index]!.calls), durationMs: performance.now() - armStarted, output, checks, failure, modelRuns, requests: requests.slice(requestStart) }
      results.push(result); await persist("results.jsonl", result)
      console.log(JSON.stringify({ caseId: item.id, arm, model, seconds: result.durationMs / 1000, checks: checks.filter(value => value.passed).length, totalChecks: checks.length, failure, requests: sent }))
    }
    if (halted) break
  }
  await writes
  for (const [file, hash] of Object.entries(sourceHashes)) if (await hashFile(file) !== hash) throw Error("COMPARISON_SOURCE_CHANGED_DURING_RUN")
  const summary = (arm: "old" | "new") => {
    const selected = results.filter(value => value.arm === arm), attempts = selected.flatMap(value => value.requests)
    const exact = attempts.every(receipt => receipt.estimatedCost.usd !== null)
    return { arms: selected.length, providerRequests: attempts.length, summedStageMs: selected.reduce((sum, result) => sum + result.durationMs, 0), contractFailures: selected.filter(result => result.failure).length,
      checksPassed: selected.flatMap(result => result.checks).filter(check => check.passed).length, checksTotal: selected.flatMap(result => result.checks).length,
      allChecksPassedCases: selected.filter(result => !result.failure && result.checks.length && result.checks.every(check => check.passed)).length,
      estimatedCostUsd: exact ? attempts.reduce((sum, attempt) => sum + attempt.estimatedCost.usd!, 0) : null,
      knownInputTokens: attempts.reduce((sum, receipt) => sum + ((receipt.usage as { input_tokens?: number } | null)?.input_tokens ?? 0), 0), knownOutputTokens: attempts.reduce((sum, receipt) => sum + ((receipt.usage as { output_tokens?: number } | null)?.output_tokens ?? 0), 0), unknownUsageReceipts: attempts.filter(receipt => receipt.estimatedCost.usd === null).length }
  }
  const pairs = cases.map(item => {
    const old = results.find(result => result.caseId === item.id && result.arm === "old"), current = results.find(result => result.caseId === item.id && result.arm === "new")
    return { caseId: item.id, title: item.title, role: item.role, complete: !!old && !!current, inputDigest: old?.inputDigest ?? current?.inputDigest, sameInput: !!old && old.inputDigest === current?.inputDigest,
      old: old ? { model: old.model, durationMs: old.durationMs, checks: old.checks, failure: old.failure, estimatedCostUsd: old.requests.every(request => request.estimatedCost.usd !== null) ? old.requests.reduce((sum, request) => sum + request.estimatedCost.usd!, 0) : null } : null,
      new: current ? { model: current.model, durationMs: current.durationMs, checks: current.checks, failure: current.failure, estimatedCostUsd: current.requests.every(request => request.estimatedCost.usd !== null) ? current.requests.reduce((sum, request) => sum + request.estimatedCost.usd!, 0) : null } : null }
  })
  const report = { version: 1, mode: "live-provider", manifestHash, resultsHash: digest(results), requestsHash: digest(requests), completedAt: new Date().toISOString(), plannedCases: cases.length, completedArms: results.length, halted, pairs, old: summary("old"), new: summary("new"),
    budget: { requests: sent, requestBytes: sentBytes, knownOutputTokens: knownOutput, unknownOutputReservation: unknownOutput, pendingOutputReservation: pendingOutput, upperCostBudgetConsumedUsd: spentUpperUsd, elapsedExecutionMs: performance.now() - started, limits: LIMITS },
    productionWrites: false, independentHumanQuality: "pending", actualInvoiceCostUsd: null, fullWorkflowTime: null, automaticActivation: false,
    evidenceLimits: ["One observation per case and model; controlled fixtures, not representative live traffic or statistical evidence.", "Current prompts and validators are held identical. Effort is explicit and equal; extraction preserves none for primary and medium for fallback. This does not benchmark the new environment's omitted extraction effort (medium default).", "Model-independent checks establish only named requirements. Voice, fluency and usefulness need qualitative review; model-based reviewers are test subjects, not independent judges.", "Every request, failure, cache read/write and reasoning output is included in estimated standard short-context price. Estimate excludes taxes and account adjustments and is not an invoice.", "Separate stage examples do not measure a complete week, production queue, persistence, publishing or human confirmation. Stage sum includes failed paths."] }
  await writeFile(join(directory, "report.json"), JSON.stringify(report, null, 2) + "\n", { flag: "wx" })
  const rows = pairs.map(pair => `| ${escapeMarkdown(pair.title)} | ${pair.old ? (pair.old.durationMs / 1000).toFixed(2) : "—"} | ${pair.new ? (pair.new.durationMs / 1000).toFixed(2) : "—"} | ${pair.old?.estimatedCostUsd?.toFixed(5) ?? "უცნობი"} | ${pair.new?.estimatedCostUsd?.toFixed(5) ?? "უცნობი"} | ${pair.old?.failure ? "ჩავარდა" : pair.old?.checks.every(check => check.passed) ? "გაიარა" : "შენიშვნა"} / ${pair.new?.failure ? "ჩავარდა" : pair.new?.checks.every(check => check.passed) ? "გაიარა" : "შენიშვნა"} |`).join("\n")
  await writeFile(join(directory, "report.md"), `# ძველი და ახალი მოდელების მცირე შედარება\n\nრვა კონტროლირებადი მაგალითი, თითო მოდელზე ერთი დაკვირვება.\n\n| მაგალითი | ძველი, წმ | ახალი, წმ | ძველი, $ | ახალი, $ | მოთხოვნების კონტროლი: ძველი / ახალი |\n|---|---:|---:|---:|---:|---|\n${rows}\n\nხარჯი native usage-ითა და ოფიციალური სტანდარტული ფასებითაა შეფასებული; მოიცავს ქეშის ჩაწერასა და განმეორებებს. ეს ანგარიშფაქტურა და მთლიანი სამუშაო დრო არ არის. ტექსტის ხმა და სარგებლიანობა ცალკე შეფასებას საჭიროებს.\n`, { flag: "wx" })
  const mapping: { caseId: string; a: string; b: string }[] = [], blind: string[] = ["# ტექსტების შედარება\n\nმოდელების სახელები და დრო დამალულია. ეს გვერდი ადამიანურ შეფასებას ავტომატურად არ ანიჭებს."]
  for (const [index, item] of cases.entries()) {
    if (item.role !== "writer") continue
    const old = results.find(result => result.caseId === item.id && result.arm === "old"), current = results.find(result => result.caseId === item.id && result.arm === "new")
    if (!old || !current) continue
    const [a, b] = index % 2 ? [current, old] : [old, current]
    mapping.push({ caseId: item.id, a: a.arm, b: b.arm })
    blind.push(`\n## ${item.title}\n\nდავალება და ხმის კონტექსტი:\n\n~~~json\n${JSON.stringify(prepared[index]!.calls, null, 2)}\n~~~\n`)
    for (const [label, value] of [["A", a], ["B", b]] as const) blind.push(`\n### ${label}\n\n~~~json\n${JSON.stringify(value.output, null, 2)}\n~~~\n`)
  }
  await writeFile(join(directory, "blind-review.md"), blind.join("\n"), { flag: "wx" })
  await writeFile(join(directory, "blind-mapping.private.json"), JSON.stringify({ manifestHash, resultsHash: report.resultsHash, mapping }, null, 2) + "\n", { flag: "wx" })
  console.log(JSON.stringify({ complete: results.length === cases.length * 2, requests: sent, old: report.old, new: report.new, report: join(directory, "report.json") }))
}
main().catch(error => { console.error(error instanceof Error ? error.message : "COMPARISON_FAILED"); process.exitCode = 1 })
