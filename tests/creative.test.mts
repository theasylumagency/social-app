import assert from "node:assert/strict"
import test from "node:test"
import { compileCreativeInput } from "../src/blueprints/social/creative/context"
import { CREATIVE_EXPLORATION_SCHEMA, CREATIVE_REVIEW_SCHEMA, selectedCreativeDirection, validateCreativeProposal, validateCreativeReview } from "../src/blueprints/social/creative/model"
import { validateSchema } from "../src/blueprints/social/brand-discovery/validation"
import { exploreCreativeDirections } from "../src/application/weekly-planning/creative"
import { createPostSchedule, writePost, reviewPosts, creativeReviewInput, postChannels } from "../src/application/weekly-planning/posts"
import { applyPostReview, creativePostScheduleSchema, POST_SCHEDULE_SCHEMA, type PostsPayload } from "../src/blueprints/social/weekly-planning/posts"
import { resizePostSchedule } from "../src/blueprints/social/weekly-planning/cadence"
import { creativeExplorationEnabled, creativeStageModel } from "../src/infrastructure/models/runtime-policy"
import type { BrandReasoner, BrandModelCall } from "../src/infrastructure/models/brand-reasoning"
import { planningFixture, completePlanningFixture } from "./weekly-planning-fixture"
import { scheduleFixture, copyFixture, editorialFixture } from "./weekly-posts-fixture"
import { creativeFixture, creativeProposal, creativeReviewFixture } from "./creative-fixture"

const payloadFixture = (): PostsPayload => {
  const outline = scheduleFixture()
  outline.posts.forEach((p, i) => { p.creativeDirectionKey = `c${i + 1}` })
  const copies = Object.fromEntries(outline.posts.map((_, i) => {
    const copy = copyFixture()
    copy.variants.forEach(v => { v.caption = ["რა ჩანს ნივთის ფოტოზე და რა რჩება კადრს მიღმა?", "ნივთის სრული ხედის შემდეგ დაზიანება ახლოდან გადაიღეთ.", "დატოვებდით ძველ ნაკაწრს თუ ზედაპირს მთლიანად შეცვლიდით?"][i]! })
    return [`p${i + 1}`, copy]
  }))
  return { outline, copies, creative: creativeFixture(), review: null, repairs: 0 }
}
const mockReasoner = (output: (call: BrandModelCall) => unknown): BrandReasoner => async <T,>(call: BrandModelCall) => {
  const result = output(call)
  assert.deepEqual(validateSchema(result, call.schema), [])
  assert.deepEqual(call.validate?.(result) ?? [], [])
  return result as T
}

test("exploration works before strategy and excludes voice, rules, proof and founder notes", async () => {
  const run = await planningFixture()
  const input = compileCreativeInput(run.payload.basis, ["facebook", "instagram"])
  const changed = structuredClone(run.payload.basis)
  changed.payload.input.notes = "private restriction"
  changed.payload.understanding!.voice.traits = ["secret voice"]
  changed.payload.understanding!.constraints = ["secret constraint"]
  changed.payload.envelope = { ...changed.payload.envelope!, avoid: ["secret envelope"] }
  changed.payload.sources = []
  changed.payload.evidence = []
  assert.deepEqual(compileCreativeInput(changed, input.platforms), input)
  assert.deepEqual(Object.keys(input).sort(), ["audiences", "business", "platforms"])
  const exploration = await exploreCreativeDirections(input, mockReasoner(call => {
    assert.equal(call.step, "creative_exploration")
    assert.deepEqual(call.input, input)
    return creativeProposal()
  }))
  assert.equal(exploration.directions.length, 4)
  assert.match(exploration.id, /^[a-f0-9-]{36}$/)
  assert.deepEqual(exploration.directions.map(d => d.key), ["c1", "c2", "c3", "c4"])
})

test("concept contracts reject duplicates, unknown platforms and incomplete reviews", async () => {
  const pool = creativeFixture(), proposal = creativeProposal()
  assert.deepEqual(validateSchema(proposal, CREATIVE_EXPLORATION_SCHEMA), [])
  proposal.directions[1]!.mechanism = proposal.directions[0]!.mechanism
  assert.ok(validateCreativeProposal(proposal, pool.input).some(e => e.includes("mechanism")))
  assert.ok(validateCreativeProposal(creativeProposal(), { ...pool.input, platforms: ["facebook"] }).length)
  const run = await completePlanningFixture(await planningFixture()), payload = payloadFixture()
  const input = creativeReviewInput(run, payload), review = creativeReviewFixture()
  assert.deepEqual(validateSchema(review, CREATIVE_REVIEW_SCHEMA), [])
  assert.deepEqual(validateCreativeReview(review, input), [])
  review.posts.pop()
  assert.ok(validateCreativeReview(review, input).length)
  review.posts.push(review.posts[0]!)
  assert.ok(validateCreativeReview(review, input).some(e => e.includes("duplicate")))
  const weak = creativeReviewFixture(); weak.posts[0]!.assessment = "lost"
  assert.ok(validateCreativeReview(weak, input).some(e => e.includes("repair direction")))
  const strong = creativeReviewFixture(); strong.posts[0]!.repairDirection = "unnecessary rewrite"
  assert.ok(validateCreativeReview(strong, input).length)
})

test("planner selects real compatible concepts; Writer receives selected idea with normal constraints", async () => {
  const run = await completePlanningFixture(await planningFixture()), payload = payloadFixture()
  const pool = payload.creative!
  const scheduled = await createPostSchedule(run, mockReasoner(call => {
    assert.equal((call.input as { creativeDirections: unknown[] }).creativeDirections.length, 4)
    const invalid = structuredClone(payload.outline!); invalid.posts[0]!.creativeDirectionKey = "unknown"
    assert.ok(call.validate!(invalid).length)
    pool.directions[0]!.platforms = ["facebook"]
    assert.ok(call.validate!(payload.outline).some(e => e.includes("channel")))
    pool.directions[0]!.platforms = ["facebook", "instagram"]
    return payload.outline
  }), { ...payload, outline: null })
  assert.equal(scheduled.posts[0]!.creativeDirectionKey, "c1")
  assert.deepEqual(validateSchema(scheduleFixture(), POST_SCHEDULE_SCHEMA), [])
  assert.ok(validateSchema(scheduleFixture(), creativePostScheduleSchema(pool.directions)).length)
  await writePost(run, payload, "p1", mockReasoner(call => {
    const input = call.input as Record<string, unknown>
    assert.deepEqual(input.creativeDirection, pool.directions[0])
    assert.ok(input.voice && input.constraints && input.operatingRules)
    assert.deepEqual(input.publicFacts, [])
    assert.deepEqual(input.eligibleProof, [])
    const leaked = copyFixture(); leaked.variants[0]!.caption = "კონცეფცია c1"
    assert.ok(call.validate!(leaked).length)
    return payload.copies.p1
  }))
  payload.outline!.posts[0]!.creativeDirectionKey = "missing"
  assert.throws(() => selectedCreativeDirection(payload, payload.outline!.posts[0]!))
})

test("independent critic feeds one shared repair without new approval blockers or extra loops", async () => {
  const run = await completePlanningFixture(await planningFixture()), payload = payloadFixture()
  const review = creativeReviewFixture()
  review.posts[0] = { ...review.posts[0]!, assessment: "diluted", reason: "დაიკარგა ორი ხედის დაპირისპირება", repairDirection: "კადრში ხილული დეტალი შეაპირისპირეთ გამოტოვებულ კონტექსტს" }
  const calls: string[] = []
  const reason = mockReasoner(call => {
    calls.push(call.step)
    if (call.step === "creative_critic") {
      const input = call.input as { posts: Record<string, unknown>[] }
      assert.deepEqual(Object.keys(input.posts[0]!).sort(), ["audiences", "concept", "draft", "plannedVisual", "platform", "postKey"])
      assert.equal(JSON.stringify(input).includes("operatingRules"), false)
      return review
    }
    if (call.step === "post_editorial") return editorialFixture()
    return { summary: "შემოწმებულია", issues: [{ postKey: "p2", severity: "blocking", message: "ფაქტის დაზუსტება" }] }
  })
  const combined = await reviewPosts(run, payload, reason)
  assert.deepEqual(calls.sort(), ["creative_critic", "post_editorial", "post_review"])
  assert.equal(combined.issues.find(i => i.postKey === "p1")!.severity, "advisory")
  const before = structuredClone(payload.copies)
  assert.equal(applyPostReview(payload, combined), "writing")
  assert.deepEqual(Object.keys(payload.copies), ["p3"])
  assert.deepEqual(payload.repairDrafts!.p1, before.p1)
  assert.ok(payload.repairFeedback!.p1!.instructions.includes(review.posts[0]!.repairDirection))
  assert.equal(payload.repairs, 1)
  payload.copies = before
  assert.equal(applyPostReview(payload, combined), "ready")
  assert.equal(payload.repairs, 1)
  assert.deepEqual(payload.copies, before)
  await writePost(run, payload, "p1", mockReasoner(call => {
    assert.ok((call.input as { repairInstructions: string[] }).repairInstructions.includes(review.posts[0]!.repairDirection))
    return before.p1
  }))
})

test("legacy posts skip the critic; failed creative reviews are not silently marked successful", async () => {
  const run = await completePlanningFixture(await planningFixture()), payload = payloadFixture()
  const reason = mockReasoner(call => {
    assert.notEqual(call.step, "creative_critic")
    return call.step === "post_editorial" ? editorialFixture() : { summary: "შემოწმებულია", issues: [] }
  })
  await assert.rejects(() => reviewPosts(run, payload, reason, async () => { throw Error("critic unavailable") }), /critic unavailable/)
  payload.outline = scheduleFixture(); delete payload.creative
  const result = await reviewPosts(run, payload, reason)
  assert.equal(result.creative, undefined)
})

test("resizing preserves concept identity and model routing has an independent opt-out", async () => {
  const payload = payloadFixture()
  const resized = resizePostSchedule(payload, { facebook: 4, instagram: 0 })
  assert.deepEqual(resized.payload.creative, payload.creative)
  assert.equal(resized.payload.outline!.posts[0]!.creativeDirectionKey, "c1")
  assert.deepEqual(resized.payload.copies.p1!.variants.map(v => v.channel), ["facebook"])
  const run = await completePlanningFixture(await planningFixture()); run.payload.cadence = { facebook: 3, instagram: 0 }
  assert.deepEqual(postChannels(run), ["facebook"])
  assert.deepEqual(postChannels(run, true), ["facebook", "instagram"])
  assert.equal(creativeExplorationEnabled({}), true)
  assert.equal(creativeExplorationEnabled({ SOCIAL_CREATIVE_ENABLED: " FALSE " }), false)
  assert.equal(creativeStageModel("exploration", { OPENAI_POST_WRITER_MODEL: "writer" }), "writer")
  assert.equal(creativeStageModel("critic", { OPENAI_POST_REVIEW_MODEL: "review" }), "review")
  assert.equal(creativeStageModel("exploration", { OPENAI_CREATIVE_MODEL: "creative" }), "creative")
})
