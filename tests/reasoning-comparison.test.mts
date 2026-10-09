import test from "node:test"
import assert from "node:assert/strict"
import { EffortBudget } from "../evals/reasoning-comparison/budget"
import { effortCases, captureEffortCalls } from "../evals/reasoning-comparison/cases"
import { createBrandReasoner, type BrandModelRun } from "../src/infrastructure/models/brand-reasoning"
import { postStageEffort, configuredReasoningEffort } from "../src/infrastructure/models/runtime-policy"
import { strategyProposal } from "./social-strategy-fixture"
import { validateStrategyProposal, type ReconSource } from "../src/blueprints/social/strategy/model"

test("high effort is retained during repair and telemetry records the requested level", async () => {
  const bodies: { reasoning: { effort: string }; input: string }[] = [], rows: BrandModelRun[] = []
  const reason = createBrandReasoner(async row => { rows.push(row) }, { apiKey: "test-only", model: "gpt-6.1-sol", reasoningEffort: "high", fetch: async (_url, init) => {
    bodies.push(JSON.parse(String(init?.body)))
    return new Response(JSON.stringify({ output: [{ content: [{ type: "output_text", text: JSON.stringify(bodies.length === 1 ? { ok: false } : { ok: true }) }] }] }))
  } })
  await reason({ step: "effort_test", version: "v1", prompt: "test", input: {}, schema: { type: "object", properties: { ok: { type: "boolean" } }, required: ["ok"], additionalProperties: false }, validate: value => (value as { ok: boolean }).ok ? [] : ["must be true"] })
  assert.equal(bodies.length, 2); assert.ok(bodies.every(body => body.reasoning.effort === "high")); assert.ok(rows.every(row => row.telemetry?.reasoningEffort === "high"))
})
test("shared budget includes concurrent reservations and retains unknown usage", () => {
  const budget = new EffortBudget(() => 0)
  const first = budget.admit(1000, 10000), second = budget.admit(1000, 10000)
  assert.equal(budget.snapshot().pendingOutputReservation, 20000)
  budget.settle(first, null, null)
  assert.equal(budget.snapshot().unknownOutputReservation, 10000)
  const consumed = budget.spentUpperUsd
  budget.settle(second, { input_tokens: 100, output_tokens: 200, input_tokens_details: { cached_tokens: 0, cache_write_tokens: 0 } }, "default")
  assert.ok(budget.spentUpperUsd > consumed); assert.equal(budget.snapshot().pendingOutputReservation, 0)
  assert.throws(() => budget.settle(second, null, null), /UNKNOWN_RESERVATION/)
  while (true) { try { budget.admit(1000, 10000) } catch { break } }
  assert.throws(() => budget.admit(1000, 10000), /SHARED_BUDGET_EXHAUSTED/)
  let now = 0; const timed = new EffortBudget(() => now); now = 1800001
  assert.throws(() => timed.admit(1000, 10000), /SHARED_BUDGET_EXHAUSTED/)
})
test("effort comparison freezes eight cases including strategy and actual two-reviewer calls", async () => {
  const cases = await effortCases(); assert.equal(cases.length, 8); assert.equal(new Set(cases.map(item => item.id)).size, 8)
  for (const item of cases) {
    const calls = await captureEffortCalls(item)
    assert.equal(calls.length, item.role === "review" ? 2 : 1); assert.equal(item.rubric.length, 4)
    assert.ok(calls.every(call => call.prompt.length && call.schema && call.input))
  }
})

test("stage effort overrides preserve baseline defaults and reject unsupported values", () => {
  assert.equal(postStageEffort("outline", {}), "low")
  assert.equal(postStageEffort("writing", {}), "low")
  const env = { OPENAI_POST_PLANNER_REASONING_EFFORT: " medium ", OPENAI_POST_WRITER_REASONING_EFFORT: "high", OPENAI_POST_REVIEW_REASONING_EFFORT: "low", OPENAI_STRATEGY_REASONING_EFFORT: "medium" }
  assert.deepEqual([postStageEffort("outline", env), postStageEffort("writing", env), postStageEffort("review", env)], ["medium", "high", "low"])
  assert.equal(configuredReasoningEffort("OPENAI_STRATEGY_REASONING_EFFORT", env), "medium")
  assert.throws(() => postStageEffort("writing", { OPENAI_POST_WRITER_REASONING_EFFORT: "none" }), /INVALID_REASONING_EFFORT/)
  assert.throws(() => postStageEffort("writing", { OPENAI_POST_WRITER_REASONING_EFFORT: "HIGH" }), /INVALID_REASONING_EFFORT/)
})
test("unknown-source repair identifies the channel and exact field without relaxing evidence checks", () => {
  const sources: ReconSource[] = ["facebook", "instagram"].map(channel => ({ channel, url: null, capturedAt: "2026-10-05T10:00:00.000Z", availability: "unknown", text: "access unavailable" }))
  const proposal = strategyProposal()
  assert.deepEqual(validateStrategyProposal(proposal, sources), [])
  proposal.reconnaissance[1]!.excerpt = "access unavailable"
  const errors = validateStrategyProposal(proposal, sources)
  assert.equal(errors.length, 1); assert.match(errors[0]!, /instagram.*excerpt null.*observation/)
  proposal.reconnaissance[1]!.excerpt = null
  proposal.reconnaissance[1]!.status = "active"
  assert.match(validateStrategyProposal(proposal, sources)[0]!, /instagram.*status unknown/)
  proposal.reconnaissance[1]!.status = "unknown"
  assert.deepEqual(validateStrategyProposal(proposal, sources), [])
})
