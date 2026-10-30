import assert from "node:assert/strict"
import test from "node:test"
import { runCreativePair, repairCreativePair } from "../evals/creative/run"
import { creativeEvaluationCases } from "../evals/creative/cases"
import type { BrandModelCall, BrandReasoner } from "../src/infrastructure/models/brand-reasoning"
import { validateSchema } from "../src/blueprints/social/brand-discovery/validation"
import { creativeProposal, creativeFixture } from "./creative-fixture"

test("blind comparison hides treatment, holds Writer context fixed and tests real-brand mappings", async () => {
  for (const item of creativeEvaluationCases) {
    for (const swap of [false, true]) {
      const calls: BrandModelCall[] = []
      const reason: BrandReasoner = async <T,>(call: BrandModelCall) => {
        calls.push(call)
        const proposal = creativeProposal(); proposal.directions.forEach(d => { d.platforms = item.creativeInput.platforms })
        const draft = { variants: item.post.channels.map(c => ({ channel: c.channel, caption: call.step === "baseline_eval_writer" ? "შეფასების კითხვები" : "სხვა პერსპექტივა", frames: item.post.visual.frames.map(body => ({ heading: "", body })), script: "", onScreenText: [] })) }
        const result = call.step === "creative_exploration" ? proposal : call.step === "creative_eval_selection" ? { key: "c2" } : call.step === "creative_critic" ? { posts: item.post.channels.map(c => ({ postKey: "p1", channel: c.channel, assessment: "acceptable", reason: "მექანიზმი ჩანს", repairDirection: "" })) } : draft
        assert.deepEqual(validateSchema(result, call.schema), [])
        assert.deepEqual(call.validate?.(result) ?? [], [])
        return result as T
      }
      const result = await runCreativePair(item, { creative: reason, writer: reason, critic: reason }, swap)
      const baseline = calls.find(c => c.step === "baseline_eval_writer")!, treatment = calls.find(c => c.step === "creative_eval_writer")!
      const { creativeDirection, plannedVisual, ...unchanged } = treatment.input as Record<string, unknown>
      assert.ok(creativeDirection && plannedVisual)
      assert.deepEqual(unchanged, baseline.input)
      assert.equal(treatment.prompt, baseline.prompt)
      assert.equal(JSON.stringify(result.blind).includes("creativeDirection"), false)
      assert.equal(JSON.stringify(result.blind).includes("assessment"), false)
      assert.equal(result.reveal.A, swap ? "creative" : "baseline")
      assert.equal(result.blind.A.variants[0]!.caption, swap ? "სხვა პერსპექტივა" : "შეფასების კითხვები")
    }
  }
})

test("saved-pair repair keeps the original baseline and stops after one Writer call even if diluted", async () => {
  const item = creativeEvaluationCases[0]!
  const draft = { variants: [{ channel: "facebook" as const, caption: "საწყისი მონახაზი", frames: [], script: "", onScreenText: [] }] }
  const critique = { posts: [{ postKey: "p1", channel: "facebook" as const, assessment: "diluted" as const, reason: "კონტრასტი დასუსტებულია", repairDirection: "შეაპირისპირეთ ორი ყოველდღიური სიტუაცია არსებულ ტექსტში" }] }
  const pair = { blind: { caseId: item.id, business: item.creativeInput.business, audiences: item.creativeInput.audiences, platforms: item.creativeInput.platforms, job: item.post.brief.job, A: draft, B: draft }, reveal: { caseId: item.id, A: "baseline", B: "creative", source: item.source, exploration: creativeFixture(), selectedDirectionKey: "c1", critique } }
  const calls: string[] = []
  const reason: BrandReasoner = async <T,>(call: BrandModelCall) => {
    calls.push(call.step)
    const value = call.step === "creative_critic" ? critique : { variants: [{ ...draft.variants[0]!, caption: "აღდგენილი კონტრასტი" }] }
    if (call.step === "creative_eval_repair") {
      assert.deepEqual((call.input as { previousDraft: unknown }).previousDraft, draft)
      assert.deepEqual((call.input as { repairInstructions: string[] }).repairInstructions, [critique.posts[0]!.repairDirection])
    }
    assert.deepEqual(validateSchema(value, call.schema), [])
    assert.deepEqual(call.validate?.(value) ?? [], [])
    return value as T
  }
  const result = await repairCreativePair(item, pair, { writer: reason, critic: reason })
  assert.deepEqual(calls, ["creative_critic", "creative_eval_repair", "creative_critic"])
  assert.equal(result.reveal.repairApplied, true)
  assert.deepEqual(result.blind.A, pair.blind.A)
  assert.equal(result.blind.B.variants[0]!.caption, "აღდგენილი კონტრასტი")
  assert.equal(pair.blind.B.variants[0]!.caption, "საწყისი მონახაზი")
})
