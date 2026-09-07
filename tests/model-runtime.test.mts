import assert from "node:assert/strict"
import test from "node:test"
import { readFile } from "node:fs/promises"
import { createBrandReasoner, BRAND_REASONING_TIMEOUT_MS, type BrandModelCall, type BrandModelRun } from "../src/infrastructure/models/brand-reasoning"
import { postStageModel, modelFailure, MODEL_CALL_MAX_MS, MODEL_STAGE_RESERVE_MS, OPERATOR_LEASE_MS, OPERATOR_WORKER_BUDGET_MS } from "../src/infrastructure/models/runtime-policy"

const call: BrandModelCall = { step: "post_schedule", version: "test", prompt: "test", input: { privateNote: "private-source-must-not-be-logged" }, schema: { type: "object", additionalProperties: false, properties: { ok: { type: "boolean" } }, required: ["ok"] } }
const answer = (value: unknown = { ok: true }, status = "completed") => new Response(JSON.stringify({ status, output: [{ content: [{ type: "output_text", text: JSON.stringify(value) }] }] }))

test("post stages have independent model routing and safe absent/blank fallbacks", () => {
  assert.equal(postStageModel("outline", {}), "gpt-5.6-terra")
  assert.equal(postStageModel("writing", {}), "gpt-5.6-sol")
  assert.equal(postStageModel("review", {}), "gpt-5.6-terra")
  const env = { OPENAI_POST_PLANNER_MODEL: "planner", OPENAI_POST_WRITER_MODEL: "writer", OPENAI_POST_REVIEW_MODEL: "reviewer", OPENAI_PLANNING_MODEL: "strategy" }
  assert.deepEqual([postStageModel("outline", env), postStageModel("writing", env), postStageModel("review", env)], ["planner", "writer", "reviewer"])
  assert.equal(postStageModel("outline", { ...env, OPENAI_POST_PLANNER_MODEL: " " }), "strategy")
  assert.equal(postStageModel("writing", { OPENAI_PLANNING_MODEL: "strategy" }), "gpt-5.6-sol")
})

test("timeouts, temporary network failures and specified HTTP statuses retry once with identical input", async () => {
  for (const failure of [new DOMException("sensitive timeout detail", "TimeoutError"), new TypeError("fetch failed", { cause: { code: "ECONNRESET" } }), ...[429, 500, 502, 503, 504].map((status) => new Response("private-provider-body", { status }))]) {
    const records: BrandModelRun[] = [], requests: string[] = [], delays: number[] = []
    const reason = createBrandReasoner(async (row) => { records.push(row) }, { apiKey: "test-only", model: "test-model", sleep: async (ms) => { delays.push(ms) }, fetch: async (_url, init) => {
      requests.push(String(init?.body)); assert.ok(init?.signal instanceof AbortSignal)
      if (requests.length === 1) { if (failure instanceof Error) throw failure; return failure }
      return answer()
    } })
    assert.deepEqual(await reason(call), { ok: true })
    assert.equal(requests.length, 2); assert.equal(requests[0], requests[1]); assert.deepEqual(delays, [1000])
    assert.equal(records.length, 2)
    assert.doesNotMatch(JSON.stringify(records), /private-provider-body|sensitive timeout detail|private-source-must-not-be-logged|test-only/)
  }
})

test("permanent errors and incomplete output do not consume transport retries", async () => {
  for (const status of [400, 401, 403, 404, 422]) {
    let count = 0
    const reason = createBrandReasoner(async () => {}, { apiKey: "test-only", sleep: async () => { assert.fail("permanent error backoff") }, fetch: async () => { count++; return new Response("private-body", { status }) } })
    await assert.rejects(() => reason(call), new RegExp(`MODEL_HTTP_${status}`)); assert.equal(count, 1)
  }
  let count = 0
  const reason = createBrandReasoner(async () => {}, { apiKey: "test-only", fetch: async () => { count++; return answer({ ok: true }, "incomplete") } })
  await assert.rejects(() => reason(call), /MODEL_INCOMPLETE/); assert.equal(count, 1)
})

test("one transient retry is shared across both validation attempts; malformed JSON is repaired", async () => {
  const requests: Record<string, unknown>[] = []
  const reason = createBrandReasoner(async () => {}, { apiKey: "test-only", sleep: async () => {}, fetch: async (_url, init) => {
    requests.push(JSON.parse(String(init?.body)))
    if (requests.length === 1) return answer({ wrong: true })
    if (requests.length === 2) throw new DOMException("timeout", "TimeoutError")
    return answer()
  } })
  assert.deepEqual(await reason(call), { ok: true }); assert.equal(requests.length, 3)
  assert.equal(requests[1]!.input, requests[2]!.input)
  assert.ok(JSON.parse(String(requests[1]!.input)).validationFailures.length)
  let count = 0
  const failing = createBrandReasoner(async () => {}, { apiKey: "test-only", sleep: async () => {}, fetch: async () => {
    count++; if (count === 2) return answer({ wrong: true }); throw new DOMException("timeout", "TimeoutError")
  } })
  await assert.rejects(() => failing(call), { name: "TimeoutError" }); assert.equal(count, 3)
  let jsonCount = 0
  const malformed = createBrandReasoner(async () => {}, { apiKey: "test-only", fetch: async () => ++jsonCount === 1 ? new Response(JSON.stringify({ output: [{ content: [{ type: "output_text", text: "{bad" }] }] })) : answer() })
  assert.deepEqual(await malformed(call), { ok: true }); assert.equal(jsonCount, 2)
})

test("persistent failure, contract failure and failed audit writes cannot produce unbounded retries", async () => {
  let count = 0
  const failing = createBrandReasoner(async () => {}, { apiKey: "test-only", sleep: async () => {}, fetch: async () => { count++; return new Response("", { status: 503 }) } })
  await assert.rejects(() => failing(call), /MODEL_HTTP_503/); assert.equal(count, 2)
  count = 0
  const contract = createBrandReasoner(async () => {}, { apiKey: "test-only", fetch: async () => { count++; return answer({ wrong: true }) } })
  await assert.rejects(() => contract(call), /MODEL_CONTRACT/); assert.equal(count, 2)
  count = 0
  const audit = createBrandReasoner(async () => { throw new TypeError("fetch failed") }, { apiKey: "test-only", fetch: async () => { count++; return answer() } })
  await assert.rejects(() => audit(call)); assert.equal(count, 1)
  assert.equal(modelFailure(Error("MODEL_LOST_LEASE")).kind, "lost_lease")
  assert.equal(modelFailure(Error("MODEL_CONTRACT: private detail")).kind, "contract")
  assert.doesNotMatch(JSON.stringify(modelFailure(Error("private detail"))), /private/)
  assert.equal(modelFailure(new TypeError("fetch failed", { cause: { code: "CERT_HAS_EXPIRED" } })).transient, false)
})

test("lease and execution reserve cover every allowed request; API cannot launch operator work", async () => {
  assert.equal(BRAND_REASONING_TIMEOUT_MS, 150_000)
  assert.equal(MODEL_CALL_MAX_MS, 451_000)
  assert.ok(MODEL_CALL_MAX_MS < MODEL_STAGE_RESERVE_MS)
  assert.ok(MODEL_STAGE_RESERVE_MS < OPERATOR_WORKER_BUDGET_MS)
  assert.ok(OPERATOR_WORKER_BUDGET_MS < OPERATOR_LEASE_MS)
  for (const route of ["weekly-planning", "brand-discovery"]) {
    const source = await readFile(new URL(`../src/app/api/${route}/route.ts`, import.meta.url), "utf8")
    assert.doesNotMatch(source, /from ["'][^"']*worker\//)
    assert.doesNotMatch(source, /\bafter\s*\(/)
    assert.match(source, /return Response.json/)
  }
})
