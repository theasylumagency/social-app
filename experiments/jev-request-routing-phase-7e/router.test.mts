import assert from "node:assert/strict"
import { test } from "node:test"
import { MODEL, operations, scopes, requestBody, validateResponse, diagnosticCandidate, classify, type Operation, type Scope, type RoutingResult } from "./router.mjs"
import { cases } from "./cases.mjs"
import { decideNote, type Interpretation, type NoteContext } from "../../src/application/contextual-notes/model"
const result = (operation: Operation = "shorten", scope: Scope = "selectedPost"): RoutingResult => ({ model: MODEL, answers: {
 operation: { type: "choice", choice: operation, probabilities: Object.fromEntries(Object.keys(operations).map(k => [k, k === operation ? 1 : 0])) as Record<Operation, number>, confidence: 1 },
 scope: { type: "choice", choice: scope, probabilities: Object.fromEntries(Object.keys(scopes).map(k => [k, k === scope ? 1 : 0])) as Record<Scope, number>, confidence: 1 },
 standaloneEdit: { type: "noul", noul: 1 }, extraMeaning: { type: "noul", noul: 0 } }, usage: { input_tokens: 100, output_tokens: 30 } })
test("four bounded questions share one request, without application IDs/gates or reference labels", () => {
 const body = requestBody(cases[0]!.input)
 assert.equal(Object.keys(body.questions).length, 4)
 assert.deepEqual(Object.keys(body.questions).sort(), ["extraMeaning", "operation", "scope", "standaloneEdit"])
 assert.equal(body.questions.operation.type, "choice")
 assert.ok(!JSON.stringify(body).includes("selectedTargetVerified")); assert.ok(!JSON.stringify(body).includes("C01"))
 assert.ok(Object.keys(body.questions.operation.criteria).length < 20)
 assert.throws(() => requestBody({ ...cases[0]!.input, text: "x".repeat(8001) }), /BOUNDED/)
})
test("Choice probabilities and native confidence remain separate, valid and exact", () => {
 assert.deepEqual(validateResponse(result()), result())
 const bad = result(); bad.answers.operation.probabilities.shorten = 0.4
 assert.throws(() => validateResponse(bad), /schema/)
 const unknown = { ...result(), model: "jev-latest" }; assert.throws(() => validateResponse(unknown), /schema/)
 const invented = { ...result(), answers: { ...result().answers, instruction: "invented" } }; assert.throws(() => validateResponse(invented), /schema/)
})
test("unknown options, NaN, extra answer authority and missing targets are technical failures", () => {
 const malformed = result() as unknown as Record<string, unknown>
 const r = result(); r.answers.standaloneEdit.noul = Number.NaN; assert.throws(() => validateResponse(r), /schema/)
 const options = result(); (options.answers.operation.probabilities as Record<string, number>).publish = 0
 assert.throws(() => validateResponse(options), /schema/)
 malformed.answers = { operation: result().answers.operation }; assert.throws(() => validateResponse(malformed), /schema/)
})
test("no classified operation can override application target, revision, approval or current-week gates", () => {
 for (const field of Object.keys(cases[0]!.input.gate) as (keyof typeof cases[0]["input"]["gate"])[]) {
  const input = { ...cases[0]!.input, gate: { ...cases[0]!.input.gate, [field]: false } }
  assert.equal(diagnosticCandidate(input, result()).route, "existingInterpreter")
 }
 assert.equal(diagnosticCandidate(cases.find(c => c.id === "C30")!.input, result()).route, "existingInterpreter")
 assert.equal(diagnosticCandidate(cases[0]!.input, null).route, "existingInterpreter")
})
test("scope disagreement, mixed meaning, ties and technical missing stay on existing interpreter", () => {
 assert.equal(diagnosticCandidate(cases[0]!.input, result("shorten", "ongoing")).route, "existingInterpreter")
 const mixed = result(); mixed.answers.extraMeaning.noul = 0.8
 assert.equal(diagnosticCandidate(cases[0]!.input, mixed).route, "existingInterpreter")
 const uncertain = result(); uncertain.answers.standaloneEdit.noul = 0.5
 assert.equal(diagnosticCandidate(cases[0]!.input, uncertain).route, "existingInterpreter")
 const tied = result(); tied.answers.operation.probabilities.shorten = 0.5; tied.answers.operation.probabilities.moreFormal = 0.5
 assert.equal(diagnosticCandidate(cases[0]!.input, tied).route, "existingInterpreter")
})
test("four pilot templates preserve original text and have no executable authority", () => {
 for (const op of ["shorten", "moreFormal", "lessFormal", "removeEmoji"] as const) {
  const input = { ...cases[0]!.input, text: "არ გაამოკლო — ფორმალურად დაწერე." }
  const candidate = diagnosticCandidate(input, result(op))
  assert.equal(candidate.purpose, "diagnosticOnly"); assert.equal(candidate.route, "candidateSelectedPostEdit")
  assert.equal(candidate.originalText, input.text); assert.ok(candidate.instruction!.length > 10)
  assert.ok(!("apply" in candidate)); assert.ok(!("permission" in candidate))
 }
})
test("all operations outside the four pilot edit forms are retained for full interpretation", () => {
 for (const op of Object.keys(operations) as Operation[]) if (!["shorten", "moreFormal", "lessFormal", "removeEmoji"].includes(op)) assert.equal(diagnosticCandidate(cases[0]!.input, result(op)).route, "existingInterpreter")
})
test("application-owned templates can satisfy the existing decision contract without generated argument strings", () => {
 const context: NoteContext = { brandId: "synthetic-unit", section: "content", week: "2026-10-05", postKey: "p1", channel: "facebook", runId: "synthetic-unit" }
 for (const op of ["shorten", "moreFormal", "lessFormal", "removeEmoji"] as const) {
  const c = diagnosticCandidate(cases[0]!.input, result(op))
  const interpreted: Interpretation = { statements: [{ quote: cases[0]!.input.text, meaning: c.instruction!, kind: "draft_correction", scope: "post", actionable: true }], response: "საცდელი მონაცემი", clarification: "", action: "revise_post", instruction: c.instruction!, ambiguous: false }
  assert.equal(decideNote(interpreted, context).action, "revise_post")
 }
})
test("Choice option-order audit changes only option order, preserving state and meanings", () => {
 const forward = requestBody(cases[0]!.input), reverse = requestBody(cases[0]!.input, true)
 assert.deepEqual(forward.state, reverse.state)
 assert.deepEqual(Object.keys(reverse.questions.operation.criteria), Object.keys(forward.questions.operation.criteria).reverse())
 assert.deepEqual(reverse.questions.standaloneEdit, forward.questions.standaloneEdit)
})
test("provider HTTP/malformed/timeout errors never become fabricated routed outputs", async () => {
 await assert.rejects(classify(cases[0]!.input, "unit-secret", AbortSignal.timeout(1000), false, async () => new Response("private body", { status: 401 })), /http/)
 await assert.rejects(classify(cases[0]!.input, "unit-secret", AbortSignal.timeout(1000), false, async () => new Response("bad json", { status: 200 })), /schema/)
 await assert.rejects(classify(cases[0]!.input, "unit-secret", AbortSignal.timeout(1000), false, async () => { throw new DOMException("unit", "TimeoutError") }), { name: "TimeoutError" })
})
test("engineered corpus is bounded, has controls and never labels itself human gold", () => {
 assert.equal(cases.length, 32); assert.equal(new Set(cases.map(c => c.id)).size, 32)
 assert.equal(cases.filter(c => c.expected.candidate).length, 10)
 assert.ok(cases.some(c => c.tags.includes("durableRule"))); assert.ok(cases.some(c => c.tags.includes("embeddedInstruction")))
})
