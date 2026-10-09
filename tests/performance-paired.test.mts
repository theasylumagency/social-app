import assert from "node:assert/strict"
import test from "node:test"
import { mkdtemp, rm, readFile, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { tmpdir } from "node:os"
import { freezeCorpus, assertFrozenCorpus } from "../evals/performance/freeze"
import { evaluationBudget, EvaluationBudgetError } from "../evals/performance/budget"
import { runPairs, armOrder, DIAGNOSTIC_LIMITS } from "../evals/performance/runner"
import { pairedReport } from "../evals/performance/report"
import { blindReview } from "../evals/performance/blind-review"
import { digest } from "../evals/performance/corpus"
import { prepareContextualNote } from "../src/application/contextual-notes/workflow"
import { currentWeek } from "../src/application/dashboard/model"
import type { Interpretation } from "../src/application/contextual-notes/model"
import type { PostCopy } from "../src/blueprints/social/weekly-planning/posts"
import { editorialFixture } from "./weekly-posts-fixture"
import { evidencePath } from "../evals/performance/evidence-path"
import { JSDOM } from "jsdom"
import { remainingBudget } from "../evals/performance/continuation-budget"

const request = { method: "POST", body: JSON.stringify({ max_output_tokens: 10000 }) }
const endpoint = "https://api.openai.com/v1/responses"
const usage = { input_tokens: 100, output_tokens: 50, input_tokens_details: { cached_tokens: 0 }, output_tokens_details: { reasoning_tokens: 0 } }
test("paid budget reserves concurrent output and retains unknown usage after transport failure", async () => {
  let calls = 0, release!: () => void
  const pending = new Promise<void>(resolve => { release = resolve })
  const budget = evaluationBudget({ ...DIAGNOSTIC_LIMITS, maxOutputTokens: 10000 }, async () => { calls++; await pending; throw new TypeError("fetch failed") })
  const first = budget.fetch(endpoint, request)
  await assert.rejects(() => budget.fetch(endpoint, request), EvaluationBudgetError)
  release(); await assert.rejects(() => first)
  assert.equal(budget.snapshot().unknownOutputReservation, 10000)
  await assert.rejects(() => budget.fetch(endpoint, request), EvaluationBudgetError)
  assert.equal(calls, 1)
})
test("paid budget releases only native known usage and rejects other endpoints/changed caps", async () => {
  const budget = evaluationBudget({ ...DIAGNOSTIC_LIMITS, maxRequests: 2 }, async () => Response.json({ usage }))
  await budget.fetch(endpoint, request); await budget.fetch(endpoint, request)
  assert.equal(budget.snapshot().knownOutputTokens, 100)
  await assert.rejects(() => budget.fetch(endpoint, request), EvaluationBudgetError)
  await assert.rejects(() => budget.fetch("https://example.test", request), /PROVIDER_BOUNDARY/)
  await assert.rejects(() => budget.fetch(endpoint, { ...request, body: '{"max_output_tokens":20000}' }), /REQUEST_LIMIT_CHANGED/)
  assert.throws(() => evaluationBudget({ ...DIAGNOSTIC_LIMITS, maxRequests: 49 }), /INVALID_EVALUATION_BUDGET/)
})
test("correction checks consume the original remaining budget including uncertain usage", () => {
  const prior = { limits: DIAGNOSTIC_LIMITS, requests: 21, serializedRequestBytes: 709191, knownOutputTokens: 10636,
    unknownOutputReservation: 10000, pendingOutputReservation: 0, elapsedMs: 202126 }
  const remaining = remainingBudget(DIAGNOSTIC_LIMITS, prior)
  assert.equal(remaining.maxRequests, 27)
  assert.equal(remaining.maxInputBytes, 3290809)
  assert.equal(remaining.maxOutputTokens, 59364)
  assert.ok(remaining.maxMinutes < 20)
  assert.throws(() => remainingBudget(DIAGNOSTIC_LIMITS, { ...prior, pendingOutputReservation: 10000 }), /INVALID_PRIOR_BUDGET/)
  assert.throws(() => remainingBudget(DIAGNOSTIC_LIMITS, { ...prior, knownOutputTokens: 75000 }), /NO_REMAINING_EVALUATION_BUDGET/)
  assert.throws(() => remainingBudget(DIAGNOSTIC_LIMITS, { ...prior, requests: 48 }), /NO_REMAINING_EVALUATION_BUDGET/)
})
test("frozen corpus detects text, configuration and source changes before any paid request", async () => {
  const corpus = await freezeCorpus(currentWeek())
  assert.equal(corpus.cases.length, 30)
  assert.equal(corpus.cases.filter(item => item.reference.provenance === "human-confirmed-fields").length, 5)
  await assertFrozenCorpus(corpus)
  const changed = structuredClone(corpus); changed.cases[0]!.input.text += " შეიცვალა"
  await assert.rejects(() => assertFrozenCorpus(changed), /FROZEN_CORPUS_CHANGED/)
  const configuration = structuredClone(corpus); configuration.configuration.notesModel = "other-model"
  const configurationPayload = { ...configuration }; delete (configurationPayload as Partial<typeof configurationPayload>).corpusHash
  configuration.corpusHash = digest(configurationPayload)
  await assert.rejects(() => assertFrozenCorpus(configuration), /FROZEN_MODEL_CONFIGURATION_CHANGED/)
  const source = structuredClone(corpus); source.sourceHashes["src/application/contextual-notes/workflow.ts"] = "changed"
  const sourcePayload = { ...source }; delete (sourcePayload as Partial<typeof sourcePayload>).corpusHash; source.corpusHash = digest(sourcePayload)
  await assert.rejects(() => assertFrozenCorpus(source), /FROZEN_SOURCE_CHANGED/)
})

function interpretation(message: string, revision: boolean): Interpretation {
  return { statements: [{ quote: message, meaning: message, kind: revision ? "draft_correction" : "question", scope: revision ? "post" : "screen", actionable: revision }],
    response: "შენიშვნა მივიღეთ და მოთხოვნის ფარგლებს ვიცავთ.", clarification: "", action: revision ? "revise_post" : "none", instruction: revision ? message : "", ambiguous: false, weeklyDirectives: null }
}
test("frozen clock allows historical controlled replay while production rejects old selected weeks", async () => {
  const corpus = await freezeCorpus("2020-01-06"), item = corpus.cases.find(value => value.id === "E01")!
  const original = structuredClone(item.context)
  const ports = { reason: async <T,>() => structuredClone(item.context.planning.posts!.payload.copies.p1!) as T,
    interpret: async () => interpretation(item.input.text, true), channelPolicies: async () => [], channelImpact: async () => ({ affectedFuture: 0, unresolved: 0 }) }
  const normal = await prepareContextualNote(item.input, item.context, ports)
  assert.equal(normal.decision.action, "none")
  const replay = await prepareContextualNote(item.input, item.context, { ...ports, currentWeek: () => corpus.week })
  assert.equal(replay.decision.action, "revise_post")
  assert.deepEqual(item.context, original)
})

test("paired mock execution pins interpreter-only low, retains review and scope, and cannot pass production gate", async () => {
  const corpus = await freezeCorpus(currentWeek()), directory = await mkdtemp(join(tmpdir(), "unda-t12-pairs-")), out = join(directory, "run")
  const bodies: Record<string, unknown>[] = []
  const fake: typeof fetch = async (_url, init) => {
    const body = JSON.parse(init!.body as string), step = body.text.format.name.slice(6), input = JSON.parse(body.input)
    bodies.push(body)
    let output: unknown
    if (step === "contextual_notes") output = interpretation(input.message, !!input.selectedPost && !input.message.includes("ამიერიდან"))
    else if (step === "contextual_post_revision") {
      const copy: PostCopy = structuredClone(input.current)
      copy.variants.find(variant => variant.channel === input.channel)!.caption = input.context.brand?.language === "en" ? "A concise political tension remains." : "ფოტო გვეხმარება, მაგრამ საბოლოო შედეგს არ გვპირდება."
      output = copy
    } else if (step === "post_review") output = { summary: "ფაქტები და მოცემული საზღვრები შენარჩუნებულია", issues: [] }
    else if (step === "post_editorial") output = editorialFixture(input.posts.map((post: { postKey: string }) => post.postKey))
    else throw Error(`Unexpected mock step ${step}`)
    return Response.json({ status: "completed", model: body.model, output: [{ content: [{ type: "output_text", text: JSON.stringify(output) }] }], usage })
  }
  try {
    const result = await runPairs(corpus, out, { mode: "mock-contract", fetch: fake })
    assert.equal(result.receipts.length, 12)
    assert.equal(result.summary.budget.requests, 24)
    assert.equal(bodies.filter(body => body.reasoning).length, 6)
    assert.ok(bodies.filter(body => body.reasoning).every(body => (body.text as { format: { name: string } }).format.name === "brand_contextual_notes"))
    assert.ok(result.receipts.every(receipt => receipt.failure === null))
    for (const row of result.receipts.filter(row => ["E01", "E06"].includes(row.caseId))) {
      assert.ok(row.modelRuns.some(run => run.step === "post_review"))
      assert.ok(row.modelRuns.some(run => run.step === "post_editorial"))
      assert.ok(row.result!.assertions.find(check => check.id === "unselectedScopePreserved")?.passed)
    }
    const report = pairedReport(corpus, result.receipts)
    assert.equal(report.distinctCompletePairs, 6); assert.equal(report.gate.decision, "shadowOnly")
    assert.equal(report.fullTimeReduction, null)
    assert.equal(report.pairedSummedApplicationReduction, null)
    assert.equal(report.baseline.attempts, null)
    assert.equal(report.baseline.applicationMs, null)
    const subset = result.receipts.filter(row => ["E01", "E06"].includes(row.caseId))
    assert.equal(pairedReport(corpus, subset, ["E01", "E06"]).distinctCompletePairs, 2)
    assert.equal(pairedReport(corpus, subset, ["E01", "E06"]).missingArms.length, 0)
    assert.throws(() => pairedReport(corpus, result.receipts, ["E01", "E06"]), /INVALID_CASE_RECEIPT/)
    const negative = result.receipts.find(row => row.caseId === "U04")!.result!.assertions.find(check => check.id === "engineeringPeriod")!
    assert.equal(negative.provenance, "engineering-invariant")
    const incomplete = pairedReport(corpus, result.receipts.slice(0, 1))
    assert.equal(incomplete.distinctCompletePairs, 0); assert.equal(incomplete.missingArms.length, 11)
    assert.throws(() => pairedReport(corpus, [...result.receipts, result.receipts[0]!]), /DUPLICATE_CASE_ARM/)
    const mismatched = structuredClone(result.receipts); mismatched[1]!.contextHash = "other"
    assert.throws(() => pairedReport(corpus, mismatched), /INVALID_CASE_RECEIPT/)
    const changedRouting = structuredClone(result.receipts)
    changedRouting.find(row => row.caseId === "E01")!.modelRuns.find(run => run.step === "post_review")!.telemetry!.reasoningEffort = "low"
    assert.throws(() => pairedReport(corpus, changedRouting), /RESPONSIBILITIES_CHANGED/)
    const blind = blindReview(corpus, result.receipts)
    assert.ok(!blind.html.includes("lowInterpreter") && !blind.html.includes("gpt-5.6-terra") && !blind.html.includes("applicationMs"))
    assert.ok(blind.html.includes("იმიტაცია: რეალური მოდელის პასუხები ჯერ არ მიღებულა"))
    assert.ok(blind.html.includes('<button type="submit" disabled>'))
    const document = new JSDOM(blind.html).window.document
    assert.equal(document.querySelectorAll("section").length, 6)
    assert.equal(document.querySelectorAll("article").length, 12)
    assert.equal(document.querySelectorAll("select[required]").length, 96)
    assert.ok((document.querySelector('button[type="submit"]') as HTMLButtonElement).disabled)
    const injected = structuredClone(result.receipts)
    injected[0]!.result!.interpretation.response = '</pre><img src="https://example.test" onerror="alert(1)">'
    const injectedDocument = new JSDOM(blindReview(corpus, injected).html).window.document
    assert.equal(injectedDocument.querySelectorAll("img").length, 0)
    assert.equal(injectedDocument.querySelectorAll("script").length, 1)
    assert.equal(blind.mapping.receiptsHash, digest(result.receipts))
    assert.equal((await readFile(join(out, "attempts.jsonl"), "utf8")).trim().split("\n").length, 24)
    await assert.rejects(() => runPairs(corpus, out, { mode: "mock-contract", fetch: fake }), /EEXIST/)
    const first = armOrder(corpus.corpusHash, 0), second = armOrder(corpus.corpusHash, 1)
    assert.notEqual(first[0], second[0])
  } finally { await rm(directory, { recursive: true, force: true }) }
})
test("evidence output is restricted to a new local experiment path", async () => {
  assert.ok(evidencePath(".local/t12-2/new.json").endsWith("new.json"))
  for (const path of ["src/new.json", "experiments/new.json", ".local/t12-2/../new.json", ".local/t12-2/.secrets/test.json"]) assert.throws(() => evidencePath(path), /LOCAL_EVIDENCE/)
  const directory = await mkdtemp(join(tmpdir(), "unda-t12-wx-")), file = join(directory, "receipt.json")
  try { await writeFile(file, "first", { flag: "wx" }); await assert.rejects(() => writeFile(file, "second", { flag: "wx" }), /EEXIST/); assert.equal(await readFile(file, "utf8"), "first") }
  finally { await rm(directory, { recursive: true, force: true }) }
})
test("budget denial remains durable but is excluded from paid request statistics", async () => {
  const corpus = await freezeCorpus(currentWeek()), directory = await mkdtemp(join(tmpdir(), "unda-t12-budget-")), out = join(directory, "run")
  const fake: typeof fetch = async (_url, init) => {
    const body = JSON.parse(init!.body as string), input = JSON.parse(body.input)
    return Response.json({ status: "completed", model: body.model, output: [{ content: [{ type: "output_text", text: JSON.stringify(interpretation(input.message, false)) }] }], usage })
  }
  try {
    const result = await runPairs(corpus, out, { mode: "mock-contract", fetch: fake, limits: { ...DIAGNOSTIC_LIMITS, maxRequests: 1 } })
    assert.equal(result.summary.halted, "evaluation_budget")
    assert.equal(result.receipts.length, 2); assert.equal(result.summary.budget.requests, 1)
    assert.equal(result.receipts[1]!.providerRequestIds.length, 0)
    assert.equal(result.receipts[1]!.modelRuns.length, 1)
    const report = pairedReport(corpus, result.receipts)
    assert.equal(report.baseline.providerRequests + report.candidate.providerRequests, 1)
    assert.equal(report.baseline.localAttemptRecords + report.candidate.localAttemptRecords, 2)
    assert.ok(report.pairs[0]!.baselineStatus === "evaluation_budget" || report.pairs[0]!.candidateStatus === "evaluation_budget")
    assert.equal(report.gate.decision, "shadowOnly")
  } finally { await rm(directory, { recursive: true, force: true }) }
})
