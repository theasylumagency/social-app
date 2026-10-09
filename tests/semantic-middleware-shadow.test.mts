import assert from "node:assert/strict"
import test from "node:test"
import { readFile, mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { phase7aShadowInputs, fixtureConfiguration, fixtureJevInterpreter, fixtureLinkage, fixtureProbabilities } from "./fixtures/semantic-shadow"
import { evaluateSemanticShadow, collectSemanticShadow, deriveShadowDecision, type ShadowCollection } from "../src/application/semantic-middleware/collect-shadow"
import { controlledSentenceTask, boundedDecisionRequest, validateBoundedTask } from "../src/blueprints/social/semantic-middleware/shadow-task"
import { semanticShadowMetrics } from "../src/blueprints/social/semantic-middleware/shadow-metrics"
import type { ShadowTrace, ShadowInterpreter, BoundedSemanticTask } from "../src/blueprints/social/semantic-middleware/shadow"
import { semanticShadowSettings } from "../src/infrastructure/models/semantic-shadow-config"
import { buildJevShadowBody, createJevShadowInterpreter, validateJevShadowResponse } from "../src/infrastructure/models/jev-semantic-shadow"
import { createShadowJsonlSink } from "../src/infrastructure/semantic-shadow/jsonl-trace-store"
import { createWeeklySemanticShadowCollector, observeCommittedWeeklyShadow, weeklyShadowInputs, weeklyShadowSnapshot } from "../src/worker/semantic-shadow"
import { reviewPosts } from "../src/application/weekly-planning/posts"
import { applyPostReview, type PostsPayload, type PostsReview } from "../src/blueprints/social/weekly-planning/posts"
import { planningFixture, completePlanningFixture } from "./weekly-planning-fixture"
import { copyFixture, scheduleFixture, editorialFixture } from "./weekly-posts-fixture"
import type { BrandReasoner } from "../src/infrastructure/models/brand-reasoning"

const all = phase7aShadowInputs(), price = all.find(i => i.source.sourceId === "exactPrice")!
function collection(input = price, options: Partial<ShadowCollection> = {}): ShadowCollection {
  return { enabled: true, configuration: fixtureConfiguration, interpreter: fixtureJevInterpreter(input), sink: { async append() {} }, ...options }
}
async function evaluate(input = price, options: Partial<ShadowCollection> = {}) { return evaluateSemanticShadow(input, collection(input, options)) }
function observation(trace: ShadowTrace) {
  assert.equal(trace.contractValidation.status, "structurallyValid", JSON.stringify(trace.contractValidation))
  assert.ok(trace.observation)
  return trace.observation.observation
}

test("missing/disabled/invalid configuration makes no provider or sink call", async () => {
  assert.deepEqual(semanticShadowSettings({}), { enabled: false, reason: "disabled" })
  assert.equal(semanticShadowSettings({ SEMANTIC_MIDDLEWARE_SHADOW_ENABLED: "true" }).enabled, false)
  let calls = 0
  const interpreter: ShadowInterpreter = { async interpret() { calls++; throw Error("must not call") } }
  assert.equal(createWeeklySemanticShadowCollector({ enabled: false, reason: "disabled" }, { interpreter }), undefined)
  const disabled = collection(price, { enabled: false, interpreter, sink: { async append() { calls++ } } })
  await collectSemanticShadow([price], disabled, 1000)
  const trace = await evaluateSemanticShadow(price, disabled)
  assert.equal(calls, 0); assert.equal(trace.notInvokedReason, "disabled"); assert.equal(trace.providerRequests, 0)
})
test("explicit config defaults to raw-only and redacts keys from public metadata", () => {
  const env = { SEMANTIC_MIDDLEWARE_SHADOW_ENABLED: "true", SEMANTIC_MIDDLEWARE_SHADOW_PROVIDER: "jev", SEMANTIC_MIDDLEWARE_SHADOW_MODEL: "jev-1.13.0",
    SEMANTIC_MIDDLEWARE_SHADOW_JEV_API_KEY: "PRIVATE_TEST_KEY", SEMANTIC_MIDDLEWARE_SHADOW_TRACE_PATH: ".local/semantic-shadow/test.jsonl" }
  const settings = semanticShadowSettings(env)
  assert.equal(settings.enabled, true)
  if (!settings.enabled) throw Error("expected enabled")
  assert.deepEqual(settings.metadata.policy, { mode: "rawOnly" })
  assert.ok(!JSON.stringify(settings.metadata).includes("PRIVATE_TEST_KEY"))
  for (const changed of [{ SEMANTIC_MIDDLEWARE_SHADOW_MODEL: "jev-latest" }, { SEMANTIC_MIDDLEWARE_SHADOW_TRACE_PATH: "package.json" },
    { SEMANTIC_MIDDLEWARE_SHADOW_TIMEOUT_MS: "50000" }, { SEMANTIC_MIDDLEWARE_SHADOW_EXPERIMENT_LOW: "0.2" }]) assert.equal(semanticShadowSettings({ ...env, ...changed }).enabled, false)
})
test("enabled request is bounded, batched, independent and contains no application IDs/registry/gold/Proof", () => {
  const request = boundedDecisionRequest(price.task!), body = buildJevShadowBody(request, fixtureConfiguration.model)
  assert.equal(Object.keys(body.questions).length, 6)
  assert.deepEqual(request.targets.map(t => t.key), ["family_price", "family_discount", "family_availability", "polarity_affirmed", "polarity_negated", "binding_0_0"])
  const text = JSON.stringify(body)
  for (const value of [price.task!.observationId, price.task!.propositionId, fixtureConfiguration.configurationRef]) assert.ok(!text.includes(value))
  assert.equal(body.state.calendar_reference, null)
  assert.ok(!text.includes("registryId")); assert.ok(!text.includes("expected"))
})
test("price family adapts app-owned amount/currency/basis into existing contract", async () => {
  const trace = await evaluate(), o = observation(trace)
  assert.deepEqual(o.claims, price.task!.claimCandidates); assert.deepEqual(o.polarity, { state: "known", value: "affirmed" })
  assert.equal(trace.invocation, "returned"); assert.equal(trace.providerRequests, 1); assert.equal(trace.actualModel, "jev-1.13.0")
})
test("ended/no-longer discounts and unavailable capacity preserve negated polarity", async () => {
  for (const id of ["endedDiscount", "deniedDiscount", "unavailable"]) {
    const input = all.find(i => i.source.sourceId === id)!, o = observation(await evaluate(input))
    assert.equal(o.claims[0]!.type, id === "unavailable" ? "availability" : "discount")
    assert.deepEqual(o.polarity, { state: "known", value: "negated" })
  }
})
test("opening hours, working today, lexical hits, compounds, quotes and unknown service never force an anchor", async () => {
  for (const text of ["დღეს ვმუშაობთ.", "კლინიკა 10:00-დან 18:00-მდე მუშაობს.", "ფასი 150", "კონსულტაცია 150 ლარი ღირს, მასაჟი 80 ლარი ღირს.", "ნინომ თქვა: კონსულტაცია 150 ლარი ღირს.", "კონსულტაცია 150 ლარი ღირს?", "მასაჟი 80 ლარი ღირს."]) {
    assert.equal(controlledSentenceTask({ sourceId: "s", revisionId: "r", text }, "o", ["კონსულტაცია"]), null)
  }
  let called = 0
  const hours = all.find(i => i.source.sourceId === "openingHours")!
  const trace = await evaluate(hours, { interpreter: { async interpret() { called++; throw Error("unexpected") } } })
  assert.equal(called, 0); assert.equal(trace.notInvokedReason, "noBoundedAnchor"); assert.equal(trace.observation, undefined)
})
test("controlled full-field grammar owns codepoint anchor and only literal argument values", async () => {
  for (const text of ["კონსულტაცია 150 ლარი ღირს.", "კონსულტაცია 150 ლარი არ ღირს.", "კონსულტაცია: ფასი 150 ლარიდან იწყება.", "ახლა კონსულტაციაზე 20%-იანი ფასდაკლება აღარ მოქმედებს.", "დღეს კონსულტაციაზე თავისუფალი ადგილები არ არის."]) {
    const source = { sourceId: "s", revisionId: "sha:exact", text: "\n " + text + "\n" }
    const task = controlledSentenceTask(source, "application-id", ["კონსულტაცია"])!
    assert.ok(task); assert.equal(validateBoundedTask(task), true)
    const span = task.spans[0]!
    assert.equal(Array.from(source.text).slice(span.start, span.end).join(""), text)
    assert.equal(task.observationId, "application-id")
  }
})
test("stale spans, unsupported targets and unbounded candidate sets are not invoked", async () => {
  let calls = 0
  for (const task of [{ ...price.task!, spans: [{ ...price.task!.spans[0]!, revisionId: "stale" }] }, { ...price.task!, families: ["clinicalOutcome"] },
    { ...price.task!, anchorRule: "lexicalTrigger" }, { ...price.task!, timeCandidates: [{ candidateId: "past", value: "past" }, { candidateId: "current", value: "current" }, { candidateId: "future", value: "future" }] }]) {
    const trace = await evaluate({ ...price, task: task as BoundedSemanticTask }, { interpreter: { async interpret() { calls++; throw Error("unexpected") } } })
    assert.equal(trace.notInvokedReason, "invalidTask")
  }
  assert.equal(calls, 0)
  const mismatched = await evaluateSemanticShadow({ ...price, source: { ...price.source, text: "A different revision" } }, collection(price))
  assert.equal(mismatched.notInvokedReason, "invalidTask"); assert.equal(mismatched.providerRequests, 0)
})
test("batched answers preserve each target and cannot collapse polarity into family correctness", async () => {
  const trace = await evaluate(price, { interpreter: fixtureJevInterpreter(price, { polarity_affirmed: 0.95, polarity_negated: 0.95 }) })
  assert.equal(observation(trace).claims[0]!.type, "price")
  assert.deepEqual(observation(trace).polarity, { state: "unresolved" })
  assert.ok(trace.unresolvedFields.includes("polarity")); assert.equal(new Set(trace.decisions.map(d => d.key)).size, trace.decisions.length)
})
test("raw-only and configured application dead-zone never invent native abstention", async () => {
  const raw = await evaluate(price, { configuration: { ...fixtureConfiguration, policy: { mode: "rawOnly" } } })
  assert.ok(raw.decisions.every(d => d.derived === "notDerived")); assert.equal(observation(raw).claims.length, 0)
  assert.ok(raw.unresolvedFields.includes("claims")); assert.ok(raw.decisions.every(d => d.probabilityYes !== null))
  assert.equal(deriveShadowDecision(0.55, fixtureConfiguration), "applicationDeadZone")
  assert.equal(deriveShadowDecision(null, fixtureConfiguration), "technicalMissing")
  const trace = await evaluate(price, { interpreter: fixtureJevInterpreter(price, { family_price: 0.55 }) })
  assert.equal(trace.decisions.find(d => d.key === "family_price")!.derived, "applicationDeadZone")
})
test("malformed/missing/out-of-range answers become technical missing, never policy output", async () => {
  const request = boundedDecisionRequest(price.task!)
  const raw = { model: fixtureConfiguration.model, answers: Object.fromEntries(request.targets.map(t => [t.key, { type: "noul", noul: 0.95 }])), usage: { input_tokens: 1, output_tokens: 1 } }
  for (const value of [NaN, -0.1, 1.01, "0.9", undefined]) assert.throws(() => validateJevShadowResponse({ ...raw, answers: { ...raw.answers, family_price: { type: "noul", noul: value } } }, request, fixtureConfiguration.model))
  const interpreter = createJevShadowInterpreter("DO_NOT_LOG", fixtureConfiguration.model, async () => Response.json({ ...raw, answers: {} }))
  const trace = await evaluate(price, { interpreter })
  assert.equal(trace.invocation, "technicalFailure"); assert.deepEqual(trace.technicalErrors, [{ code: "providerSchema" }])
  assert.ok(trace.decisions.every(d => d.derived === "technicalMissing")); observation(trace)
})
test("timeout and provider exceptions retain original review/output and sanitized errors", async () => {
  const existing = { writer: { caption: price.source.text }, review: fixtureLinkage.safetyReviewer.outcome, approved: false, published: false }
  const bytes = JSON.stringify(existing)
  for (const interpreter of [{ interpret: async () => new Promise<never>(() => {}) }, { async interpret() { throw Error("PRIVATE_KEY_AND_PROMPT_DO_NOT_LOG") } }]) {
    const started = performance.now()
    const trace = await evaluate(price, { configuration: { ...fixtureConfiguration, timeoutMs: 20 }, interpreter })
    assert.ok(performance.now() - started < 1000)
    assert.ok(["timeout", "technicalFailure"].includes(trace.invocation)); assert.equal(JSON.stringify(existing), bytes)
    assert.ok(!JSON.stringify(trace).includes("PRIVATE_KEY_AND_PROMPT")); observation(trace)
  }
})
test("ellipsis/ambiguous service YES never establishes inherited binding; trusted app context can", async () => {
  const input = all.find(i => i.source.sourceId === "branchPrices" && i.task!.propositionId.endsWith("p2"))!
  const trace = await evaluate(input), o = observation(trace)
  assert.equal(o.bindings![0]!.target.state, "unresolved"); assert.ok(trace.knownCapabilityLimits.some(l => l.code === "ellipticalBinding"))
  const b = input.task!.bindings[0]!, candidate = b.candidates[0]!
  const grounded = { ...input, task: { ...input.task!, bindings: [{ ...b, candidates: [{ ...candidate, grounding: "applicationEstablished" as const, contextRef: input.task!.contextRefs[0]! }] }, input.task!.bindings[1]!] } }
  assert.equal(observation(await evaluate(grounded)).bindings![0]!.target.state, "known")
  const ambiguous = { ...input, task: { ...input.task!, bindings: [{ ...b, capabilityLimit: "ambiguousBinding" as const, candidates: [{ ...candidate, grounding: "ambiguous" as const }] }] } }
  assert.equal(observation(await evaluate(ambiguous)).bindings![0]!.target.state, "unresolved")
})
test("provider cannot mint IDs/spans/registry identifiers; application resolutions alone attach registry IDs", async () => {
  const trace = await evaluate(), o = observation(trace)
  assert.equal(o.observationId, price.task!.observationId); assert.equal(o.propositionId, price.task!.propositionId); assert.deepEqual(o.sourceSpans, price.task!.spans)
  const registry = "app-registry:consultation", ref = "app-registry-context:1"
  const task = { ...price.task!, contextRefs: [...price.task!.contextRefs, ref],
    bindings: [{ ...price.task!.bindings[0]!, candidates: [{ ...price.task!.bindings[0]!.candidates[0]!, value: { mention: "კონსულტაცია", registryId: registry } }] }] }
  assert.equal(observation(await evaluate({ ...price, task })).bindings![0]!.target.state, "known")
  const without = observation(await evaluate({ ...price, task })).bindings![0]!.target
  assert.equal(without.state === "known" ? without.value.registryId : undefined, undefined)
  const resolved = { ...task, registryResolutions: [{ bindingId: "service1", mention: "კონსულტაცია", registryId: registry, method: "deterministic" as const, sourceRef: ref }] }
  const withRegistry = observation(await evaluate({ ...price, task: resolved })).bindings![0]!.target
  assert.equal(withRegistry.state === "known" ? withRegistry.value.registryId : undefined, registry)
  const body = buildJevShadowBody(boundedDecisionRequest(resolved), fixtureConfiguration.model)
  assert.ok(!JSON.stringify(body).includes(registry))
  const malicious = { model: fixtureConfiguration.model, observationId: "provider-minted", registryId: "provider-minted",
    answers: Object.fromEntries(Object.keys(body.questions).map(key => [key, { type: "noul", noul: 0.95 }])), usage: { input_tokens: 1, output_tokens: 1 } }
  const normalized = validateJevShadowResponse(malicious, boundedDecisionRequest(resolved), fixtureConfiguration.model)
  assert.ok(!JSON.stringify(normalized).includes("provider-minted"))
  assert.throws(() => validateJevShadowResponse({ ...malicious, answers: { ...malicious.answers, family_price: { type: "noul", noul: 0.95, registryId: "provider-minted" } } }, boundedDecisionRequest(resolved), fixtureConfiguration.model))
})
test("temporal and amount/basis confirmation stay bounded and caller-owned; no relative clock resolution", async () => {
  const temporal = { ...price, task: { ...price.task!, time: { relation: { state: "unknown" as const, reason: "notSupplied" as const }, expressions: ["მომავალ კვირას"], period: { state: "unknown" as const, reason: "notSupplied" as const }, relativeReferenceId: { state: "unknown" as const, reason: "notSupplied" as const } },
    timeCandidates: [{ candidateId: "future", value: "future" as const }, { candidateId: "current", value: "current" as const }] } }
  const result = { provider: "jev" as const, model: fixtureConfiguration.model, inputTokens: 12, outputTokens: 2,
    probabilities: { ...fixtureProbabilities(price), time_0: 0.95, time_1: 0.05 } }
  const o = observation(await evaluate(temporal, { interpreter: { async interpret() { return result } } }))
  assert.deepEqual(o.time!.relation, { state: "known", value: "future" }); assert.equal(o.time!.period.state, "unknown"); assert.equal(o.time!.relativeReferenceId!.state, "unknown")
  const claim = price.task!.claimCandidates[0]!
  assert.equal(claim.type, "price"); if (claim.type !== "price") throw Error("fixture")
  const amount = { ...price, task: { ...price.task!, amountCandidates: [{ candidateId: "literal", claim }, { candidateId: "wrong", claim: { ...claim, amount: { state: "known" as const, value: "180" } } }] } }
  const confirmed = observation(await evaluate(amount, { interpreter: { async interpret() { return { ...result, probabilities: { ...fixtureProbabilities(price), amount_0: 0.95, amount_1: 0.05 } } } } }))
  assert.deepEqual(confirmed.claims[0], claim)
  const wrong = await evaluate(amount, { interpreter: { async interpret() { return { ...result, probabilities: { ...fixtureProbabilities(price), amount_0: 0.05, amount_1: 0.95 } } } } })
  assert.deepEqual(observation(wrong).claims[0], claim); assert.ok(wrong.unresolvedFields.includes("claims"))
})
test("trace storage includes config/probabilities/contract lineage and contains no credentials", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "unda-shadow-")), file = path.join(dir, "trace.jsonl")
  try {
    const trace = await evaluate(), sink = createShadowJsonlSink(file)
    await sink.append(trace, new AbortController().signal)
    const text = await readFile(file, "utf8"), stored = JSON.parse(text)
    assert.equal(stored.traceVersion, "unda-semantic-shadow-trace-v1"); assert.equal(stored.configuration.executionMode, "fixture")
    assert.equal(stored.observation.observation.provenance.contractVersion, "unda-semantic-observation-v1")
    assert.deepEqual(stored.applicationTask.claimCandidates, price.task!.claimCandidates)
    assert.equal(stored.configuration.budgetMs, fixtureConfiguration.budgetMs)
    assert.ok(stored.decisions.every((d: { probabilityYes: unknown }) => typeof d.probabilityYes === "number"))
    assert.ok(!/Bearer|Authorization|apiKey|DO_NOT_LOG/.test(text))
  } finally {
    const resolved = path.resolve(dir)
    assert.ok(resolved.startsWith(path.resolve(tmpdir()) + path.sep) && path.basename(resolved).startsWith("unda-shadow-"))
    await rm(resolved, { recursive: true })
  }
})
test("task cap, total budget and sink failure preserve fail-open void boundary", async () => {
  let calls = 0; const traces: ShadowTrace[] = []
  const interpreter: ShadowInterpreter = { async interpret(request) { calls++; return { provider: "jev", model: fixtureConfiguration.model, probabilities: Object.fromEntries(request.targets.map(t => [t.key, fixtureProbabilities(price)[t.key]!])), inputTokens: 0, outputTokens: 0 } } }
  const c = collection(price, { configuration: { ...fixtureConfiguration, maxTasks: 1 }, interpreter, sink: { async append(t) { traces.push(t) } } })
  assert.equal(await collectSemanticShadow([price, price], c, 1000), undefined)
  assert.equal(calls, 1); assert.equal(traces[1]!.notInvokedReason, "taskLimit")
  await collectSemanticShadow([price], { ...c, sink: { async append() { throw Error("PRIVATE_STORAGE_ERROR") } } }, 1000)
  await collectSemanticShadow([price], { ...c, sink: { append: async () => new Promise<never>(() => {}) } }, 20)
  const controller = new AbortController(); controller.abort()
  const alreadyAborted = await evaluateSemanticShadow(price, c, controller.signal)
  assert.equal(alreadyAborted.notInvokedReason, "budgetExhausted"); assert.equal(alreadyAborted.providerRequests, 0); assert.equal(calls, 2)
})
test("metrics keep failures/unresolved/known limits separate without a quality score", async () => {
  const traces = [await evaluate(), await evaluate(all.find(i => i.source.sourceId === "openingHours")!),
    await evaluate(all.find(i => i.source.sourceId === "branchPrices" && i.task!.propositionId.endsWith("p2"))!)]
  const m = semanticShadowMetrics(traces)
  assert.equal(m.shadowEligibleTexts, 2); assert.equal(m.shadowIneligibleTexts, 1); assert.equal(m.providerRequests, 2)
  assert.equal(m.knownEllipsisLimitCases, 1); assert.ok(m.unresolvedSemanticFields > 0); assert.equal(m.contractInvalidObservations, 0)
  assert.ok(!("qualityScore" in m)); assert.equal(m.requestsWithUnknownCost, 2)
})
test("original reviewer/repair outcome and prompts remain identical with throwing/mutating shadow observer", async () => {
  const run = await completePlanningFixture(await planningFixture())
  const payload: PostsPayload = { outline: scheduleFixture(), copies: { p1: copyFixture(), p2: copyFixture(), p3: copyFixture() }, review: null, repairs: 0 }
  const safety: PostsReview = { summary: "Existing Safety", issues: [{ postKey: "p1", severity: "blocking", message: "Existing blocker" }] }
  const calls: unknown[] = []
  const reason: BrandReasoner = async <T,>(call: Parameters<BrandReasoner>[0]) => { calls.push(structuredClone({ prompt: call.prompt, input: call.input, version: call.version, schema: call.schema })); return structuredClone(call.step === "post_review" ? safety : editorialFixture()) as T }
  const original = await reviewPosts(run, payload, reason), firstCalls = structuredClone(calls); calls.length = 0
  const observed = await reviewPosts(run, payload, reason, r => { r.issues.length = 0; throw Error("SHADOW_OBSERVER_FAILURE") })
  assert.deepEqual(observed, original); assert.deepEqual(calls, firstCalls)
  const originalPayload = structuredClone(payload), observedPayload = structuredClone(payload)
  assert.equal(applyPostReview(originalPayload, original), applyPostReview(observedPayload, observed)); assert.deepEqual(observedPayload, originalPayload)
  const asyncObserved = await reviewPosts(run, payload, reason, async () => { throw Error("ASYNC_SHADOW_FAILURE") })
  assert.deepEqual(asyncObserved, original)
})
test("worker captures reviewed revision/surfaces before repair and collection cannot mutate committed state", async () => {
  const run = await planningFixture(); run.payload.basis.payload.understanding!.offers = [{ name: "კონსულტაცია", description: "candidate vocabulary only", sourceKey: "fixture", exactExcerpt: "კონსულტაცია" }]
  const copies = { p1: { variants: [{ ...copyFixture().variants[0]!, caption: price.source.text }] } }, review: PostsReview = { summary: "Existing review", issues: [] }
  const event = weeklyShadowSnapshot(run, copies, review, review, "ready"), inputs = weeklyShadowInputs(event)
  assert.equal(inputs[0]!.source.text, price.source.text); assert.ok(inputs[0]!.task)
  const original = JSON.stringify({ copies, review }), traces: ShadowTrace[] = []
  const settings = semanticShadowSettings({ SEMANTIC_MIDDLEWARE_SHADOW_ENABLED: "true", SEMANTIC_MIDDLEWARE_SHADOW_PROVIDER: "jev", SEMANTIC_MIDDLEWARE_SHADOW_MODEL: "jev-1.13.0", SEMANTIC_MIDDLEWARE_SHADOW_JEV_API_KEY: "PRIVATE_NOT_SAVED", SEMANTIC_MIDDLEWARE_SHADOW_TRACE_PATH: ".local/semantic-shadow/test.jsonl" })
  const collector = createWeeklySemanticShadowCollector(settings, { interpreter: { async interpret() { throw Error("JEV_FAILED") } }, sink: { async append(t) { traces.push(t) } } })
  await observeCommittedWeeklyShadow(collector, event, 2000)
  assert.equal(traces[0]!.invocation, "technicalFailure")
  assert.equal(JSON.stringify({ copies, review }), original)
  await observeCommittedWeeklyShadow(async () => { throw Error("broken collector") }, event, 1000)
  assert.equal(JSON.stringify({ copies, review }), original)
})
