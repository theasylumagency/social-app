import assert from "node:assert/strict"
import test from "node:test"
import { createPostSchedule } from "../src/application/weekly-planning/posts"
import { validateSchema } from "../src/blueprints/social/brand-discovery/validation"
import { POST_SCHEDULE_V3_SCHEMA, type PostChannel } from "../src/blueprints/social/weekly-planning/posts"
import { createBrandReasoner, type BrandModelCall, type BrandModelRun } from "../src/infrastructure/models/brand-reasoning"
import { completePlanningFixture, planningFixture } from "./weekly-planning-fixture"
import { currentScheduleFixture } from "./weekly-posts-fixture"
import { knowledgeFixture } from "./public-knowledge-fixture"

function schedule(channels: PostChannel[]) {
  const value = currentScheduleFixture()
  for (const post of value.posts) post.channels = post.channels.filter(c => channels.includes(c.channel))
  return value
}

test("post generation constrains channels from strategy, disabled policies and zero-count cadence", async () => {
  const base = await completePlanningFixture(await planningFixture())
  base.payload.publicKnowledge = knowledgeFixture(base.brandId)
  const schemaBefore = structuredClone(POST_SCHEDULE_V3_SCHEMA)
  for (const scenario of ["strategy-facebook", "strategy-instagram", "disabled-policy", "zero-cadence", "both", "legacy"] as const) {
    const run = structuredClone(base)
    let allowed: PostChannel[] = ["facebook"]
    if (scenario.startsWith("strategy")) {
      const excluded = scenario === "strategy-facebook" ? "instagram" : "facebook"
      run.payload.socialStrategy!.payload.proposal!.channels.find(c => c.channel === excluded)!.action = "doNotUse"
      if (excluded === "facebook") allowed = ["instagram"]
    } else if (scenario === "disabled-policy") {
      // Both channels are recommended by strategy; the model must see the policy exclusion.
      run.payload.channelPolicies = [{ channel: "instagram", active: false, revision: 1, updatedAt: "2026-10-11T04:00:00Z" }]
    } else if (scenario === "zero-cadence") run.payload.cadence = { facebook: 3, instagram: 0 }
    else {
      allowed = ["facebook", "instagram"]
      if (scenario === "legacy") delete run.payload.socialStrategy
      else run.payload.socialStrategy!.payload.proposal!.channels[1]!.action = "deprioritize"
    }
    const before = structuredClone(run)
    let calls = 0
    const result = await createPostSchedule(run, async <T,>(call: BrandModelCall) => {
      calls++
      assert.deepEqual((call.input as { allowedPostChannels: string[] }).allowedPostChannels, allowed, scenario)
      const valid = schedule(allowed)
      assert.deepEqual(validateSchema(valid, call.schema), [], scenario)
      assert.deepEqual(call.validate!(valid), [], scenario)
      if (allowed.length === 1) {
        const invalid = currentScheduleFixture()
        // Stored historical plans still use the general schema; only generation is narrowed.
        assert.deepEqual(validateSchema(invalid, POST_SCHEDULE_V3_SCHEMA), [])
        assert.ok(validateSchema(invalid, call.schema).some(e => e.includes("channels")), scenario)
        assert.ok(call.validate!(invalid).some(e => e.includes(`Allowed post channels: ${allowed[0]}`)), scenario)
      }
      const unknownFact = structuredClone(valid)
      unknownFact.posts[0]!.factKeys = ["unknown-public-fact"]
      assert.ok(call.validate!(unknownFact).some(e => e.includes("public fact")))
      const invalidImage = structuredClone(valid)
      invalidImage.posts[0]!.visual.frames = []
      assert.ok(call.validate!(invalidImage).some(e => e.includes("Image post requires")))
      return valid as T
    })
    assert.equal(calls, 1)
    assert.ok(result.posts.every(post => post.channels.every(c => allowed.includes(c.channel))))
    assert.deepEqual(run, before)
  }
  assert.deepEqual(POST_SCHEDULE_V3_SCHEMA, schemaBefore)
})

test("the real reasoner retains channel restrictions through a contract repair", async () => {
  const run = await completePlanningFixture(await planningFixture())
  run.payload.channelPolicies = [{ channel: "instagram", active: false, revision: 1, updatedAt: "2026-10-11T04:00:00Z" }]
  const requests: { input: string; prompt_cache_key: string; text: { format: { strict: boolean; schema: BrandModelCall["schema"] } } }[] = []
  const receipts: BrandModelRun[] = []
  const reason = createBrandReasoner(async receipt => { receipts.push(receipt) }, {
    apiKey: "offline-test", model: "offline-model", reasoningEffort: "medium",
    fetch: async (_url, init) => {
      requests.push(JSON.parse(String(init?.body)))
      // Deliberately violate strict output to exercise the application's defensive repair.
      const proposal = requests.length === 1 ? currentScheduleFixture() : schedule(["facebook"])
      return new Response(JSON.stringify({ status: "completed", output: [{ content: [{ type: "output_text", text: JSON.stringify(proposal) }] }] }))
    },
  })
  const result = await createPostSchedule(run, reason)
  assert.equal(requests.length, 2)
  const first = JSON.parse(requests[0]!.input)
  const repair = JSON.parse(requests[1]!.input)
  assert.deepEqual(first.allowedPostChannels, ["facebook"])
  assert.deepEqual(repair.originalInput.allowedPostChannels, ["facebook"])
  assert.ok(repair.validationFailures.some((message: string) => message.includes("channels")))
  assert.deepEqual(requests[0]!.text.format, requests[1]!.text.format)
  assert.equal(requests[0]!.text.format.strict, true)
  assert.match(requests[0]!.prompt_cache_key, /post-schedule-v8/)
  assert.deepEqual(receipts.map(receipt => receipt.telemetry?.outcome), ["validation_failure", "accepted"])
  assert.ok(result.posts.every(post => post.channels.length === 1 && post.channels[0]!.channel === "facebook"))
})

test("impossible channel requests and incompatible retained posts fail before any provider call", async () => {
  const base = await completePlanningFixture(await planningFixture())
  for (const scenario of ["no-channel", "conflicting-cadence", "zero-cadence", "retained"] as const) {
    const run = structuredClone(base)
    run.payload.socialStrategy!.payload.proposal!.channels[1]!.action = "doNotUse"
    if (scenario === "no-channel") run.payload.socialStrategy!.payload.proposal!.channels[0]!.action = "doNotUse"
    if (scenario === "conflicting-cadence") run.payload.cadence = { facebook: 3, instagram: 1 }
    if (scenario === "zero-cadence") run.payload.cadence = { facebook: 0, instagram: 0 }
    const existing = scenario === "retained" ? { outline: currentScheduleFixture(), copies: {}, review: null, repairs: 0 } : undefined
    await assert.rejects(() => createPostSchedule(run, async () => { assert.fail("No provider call for an impossible request") }, existing))
  }
})

test("a repeated forbidden channel is rejected after the existing single repair allowance", async () => {
  const run = await completePlanningFixture(await planningFixture())
  run.payload.socialStrategy!.payload.proposal!.channels[1]!.action = "doNotUse"
  let requests = 0
  const reason = createBrandReasoner(async () => {}, { apiKey: "offline-test", model: "offline-model", fetch: async () => {
    requests++
    return new Response(JSON.stringify({ status: "completed", output: [{ content: [{ type: "output_text", text: JSON.stringify(currentScheduleFixture()) }] }] }))
  } })
  await assert.rejects(() => createPostSchedule(run, reason), /MODEL_CONTRACT/)
  assert.equal(requests, 2)
})

test("one-channel additions preserve retained jobs and satisfy the whole week's exact cadence", async () => {
  const run = await completePlanningFixture(await planningFixture())
  run.payload.cadence = { facebook: 4, instagram: 0 }
  const existing = { outline: schedule(["facebook"]), copies: {}, review: null, repairs: 0 }
  const before = structuredClone(existing)
  const result = await createPostSchedule(run, async <T,>(call: BrandModelCall) => {
    assert.deepEqual((call.input as { retainedPosts: unknown[] }).retainedPosts, existing.outline.posts)
    const extra = schedule(["facebook"])
    extra.posts = [{ ...extra.posts[0]!, title: "მოვლის შემდეგი ნაბიჯი", brief: { ...extra.posts[0]!.brief, job: "ნივთის მოვლის მოლოდინის განსაზღვრა", takeaway: "შეფასებას მოვლის კითხვაც დაუმატეთ" } }]
    assert.deepEqual(validateSchema(extra, call.schema), [])
    assert.deepEqual(call.validate!(extra), [])
    return extra as T
  }, existing)
  assert.equal(result.posts.length, 4)
  assert.deepEqual(result.posts.slice(0, 3).map(p => p.title), before.outline.posts.map(p => p.title))
  assert.ok(result.posts.every(p => p.channels.length === 1 && p.channels[0]!.channel === "facebook"))
  assert.deepEqual(existing, before)
})
