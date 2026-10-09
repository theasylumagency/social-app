import test from "node:test"
import assert from "node:assert/strict"
import { estimateCost, reserveCost } from "../evals/model-comparison/cost"
import { comparisonCases, captureCalls } from "../evals/model-comparison/cases"
import { digest } from "../evals/performance/corpus"

test("standard cost counts cache writes separately and reasoning output is already included", () => {
  const value = estimateCost("gpt-6.1-sol", { input_tokens: 1000, output_tokens: 200, input_tokens_details: { cached_tokens: 300, cache_write_tokens: 500 }, output_tokens_details: { reasoning_tokens: 150 } })
  assert.ok(Math.abs(value.usd! - 0.00368) < 1e-10)
  assert.equal(value.lowerUsd, value.upperUsd)
  assert.ok(reserveCost("gpt-6.1-sol", 4000, 10000) > value.usd!)
})
test("missing usage and missing cache-write counts never become exact zero cost", () => {
  assert.equal(estimateCost("gpt-6.1-sol", null).usd, null)
  const missingWrites = estimateCost("gpt-6.1-sol", { input_tokens: 1000, output_tokens: 200, input_tokens_details: { cached_tokens: 300 } })
  assert.equal(missingWrites.usd, null); assert.ok(missingWrites.upperUsd! > missingWrites.lowerUsd!)
  assert.equal(estimateCost("gpt-5.4-nano", { input_tokens: 1000, output_tokens: 200, input_tokens_details: { cached_tokens: 0 } }).usd, 0.00045)
  assert.equal(estimateCost("gpt-6.1-sol", { input_tokens: 300000, output_tokens: 200 }).usd, null)
})
test("controlled comparison freezes eight distinct current tasks without provider calls", async () => {
  const cases = await comparisonCases()
  assert.equal(cases.length, 8); assert.equal(new Set(cases.map(item => item.id)).size, 8)
  const first = await Promise.all(cases.map(captureCalls)), second = await Promise.all(cases.map(captureCalls))
  assert.equal(digest(first), digest(second)); assert.ok(first.every(calls => calls.length > 0))
  assert.equal(first[cases.findIndex(item => item.id === "review-valid-price")]!.length, 2)
  const voice = first[cases.findIndex(item => item.id === "writer-voice")]!
  assert.ok(JSON.stringify(voice).includes("ძალაუფლებრივი დაძაბულობა"))
})
