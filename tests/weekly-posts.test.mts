import assert from "node:assert/strict"
import test from "node:test"
import { validatePostSchedule, validatePostCopy, POST_SCHEDULE_SCHEMA, POST_COPY_SCHEMA, IMAGE_GENERATION_POLICY, isPostCadence, countPostChannels, type PostsPayload } from "../src/blueprints/social/weekly-planning/posts"
import { resizePostSchedule, spreadPostDays, validateCadence } from "../src/blueprints/social/weekly-planning/cadence"
import { createPostSchedule } from "../src/application/weekly-planning/posts"
import { validateSchema } from "../src/blueprints/social/brand-discovery/validation"
import { planningFixture, completePlanningFixture } from "./weekly-planning-fixture"
import { postsContext } from "../src/application/weekly-planning/posts"
import { displayDate } from "../src/application/dashboard/model"

import { scheduleFixture, copyFixture } from "./weekly-posts-fixture"

test("post contracts enforce channel, format, frame and reference coherence", () => {
  const schedule = scheduleFixture(); const copy = copyFixture()
  assert.deepEqual(validateSchema(schedule, POST_SCHEDULE_SCHEMA), [])
  assert.deepEqual(validateSchema(copy, POST_COPY_SCHEMA), [])
  assert.deepEqual(validatePostSchedule(schedule, ["d1", "d2", "d3"]), [])
  assert.deepEqual(validatePostCopy(copy, schedule.posts[0]!), [])
  const invalid = structuredClone(schedule); invalid.posts[0]!.format = "text"
  assert.ok(validatePostSchedule(invalid, ["d1", "d2", "d3"]).length)
  invalid.posts[0]!.directionKey = "d99"; invalid.posts[1]!.channels.push(invalid.posts[1]!.channels[0]!)
  assert.ok(validatePostSchedule(invalid, ["d1", "d2", "d3"]).length >= 3)
  const carousel = { ...schedule.posts[0]!, format: "carousel" as const, visual: { ...schedule.posts[0]!.visual, kind: "slides" as const, frames: ["პირველი", "მეორე"] } }
  assert.ok(validatePostCopy(copy, carousel).length)
  copy.variants[1]!.caption = "ა".repeat(2201)
  assert.ok(validatePostCopy(copy, schedule.posts[0]!).some((e) => e.includes("2200")))
})
test("compact strategy preserves canonical decisions with only two model steps", async () => {
  const run = await planningFixture(); run.payload.founderPosts = true
  const calls: import("../src/infrastructure/models/brand-reasoning").BrandModelCall[] = []
  const ready = await completePlanningFixture(run, calls)
  assert.deepEqual(calls.map((c) => c.step), ["weekly_strategy", "weekly_review"])
  assert.equal(ready.payload.plan!.contentDirections.length, 3)
  assert.equal(ready.payload.plan!.audienceFocus.primary.id, run.payload.basis.payload.hypotheses[0]!.id)
  assert.equal(postsContext(ready).executionPolicy.publishingEnabled, false)
  assert.deepEqual(postsContext(ready).recentResults, [])
})
test("image generation stays disabled in testing and excluded from trial", () => {
  assert.equal(IMAGE_GENERATION_POLICY.enabled, false)
  assert.equal(IMAGE_GENERATION_POLICY.mode, "testing")
  assert.equal(IMAGE_GENERATION_POLICY.trialIncluded, false)
  assert.equal(IMAGE_GENERATION_POLICY.paidPlanned, true)
})

test("Georgian dates remain deterministic without Georgian browser ICU support", () => {
  assert.match(displayDate("2026-09-07"), /7 სექტემბერი/)
  assert.match(displayDate("2026-09-06T21:05:00Z", { year: "numeric", hour: "2-digit" }), /7 სექტემბერი, 2026, 01:05/)
})

test("cadence edits retain exact channel copy, remap assets and never duplicate jobs", () => {
  const previous: PostsPayload = { outline: scheduleFixture(), copies: { p1: copyFixture(), p2: copyFixture(), p3: copyFixture() }, review: { summary: "შემოწმებულია", issues: [] }, repairs: 0 }
  for (let facebook = 0; facebook <= 5; facebook++) for (let instagram = 0; instagram <= 5; instagram++) {
    const { payload, mapping, needsAdditions } = resizePostSchedule(previous, { facebook, instagram })
    const actual = countPostChannels(payload.outline!.posts)
    assert.deepEqual(actual, { facebook: Math.min(facebook, 3), instagram: Math.min(instagram, 3) })
    assert.equal(needsAdditions, facebook > 3 || instagram > 3)
    for (const m of mapping) {
      const post = payload.outline!.posts[Number(m.to.slice(1)) - 1]!
      assert.deepEqual(validatePostCopy(payload.copies[m.to]!, post), [])
      for (const v of payload.copies[m.to]!.variants) assert.deepEqual(v, previous.copies[m.from]!.variants.find((old) => old.channel === v.channel))
    }
  }
  const flagged = structuredClone(previous)
  flagged.review!.issues = [{ postKey: "p1", severity: "blocking", message: "მაგალითი მონიშნეთ" }]
  const repaired = resizePostSchedule(flagged, { facebook: 1, instagram: 0 }).payload
  assert.equal(repaired.copies.p1, undefined)
  assert.equal(repaired.repairDrafts?.p1?.variants.length, 1)
  assert.equal(previous.copies.p1!.variants.length, 2)
  for (const value of [null, {}, { facebook: -1, instagram: 2 }, { facebook: 1.5, instagram: 0 }, { facebook: 6, instagram: 0 }, { facebook: "2", instagram: 1 }, { facebook: 1, instagram: 1, extra: true }]) assert.equal(isPostCadence(value), false)
  assert.equal(isPostCadence({ facebook: 0, instagram: 0 }), true)
})

test("schedule additions enforce exact counts and preserve retained post positions and copy keys", async () => {
  const run = await completePlanningFixture(await planningFixture())
  run.payload.cadence = { facebook: 4, instagram: 2 }
  const original: PostsPayload = { outline: scheduleFixture(), copies: { p1: copyFixture() }, review: null, repairs: 0 }
  const seed = resizePostSchedule(original, run.payload.cadence).payload
  let calls = 0
  const result = await createPostSchedule(run, async <T,>(call: import("../src/infrastructure/models/brand-reasoning").BrandModelCall) => {
    calls++
    assert.equal((call.input as { retainedPosts: unknown[] }).retainedPosts.length, 3)
    const value = scheduleFixture()
    value.posts = [{ ...value.posts[0]!, title: "დამატებითი განსხვავებული კითხვა", channels: [value.posts[0]!.channels[0]!] }]
    assert.deepEqual(validateSchema(value, call.schema), [])
    assert.deepEqual(call.validate!(value), [])
    assert.ok(call.validate!({ ...value, posts: [] }).length)
    return value as T
  }, seed)
  assert.equal(calls, 1)
  assert.deepEqual(validateCadence(result.posts, run.payload.cadence), [])
  assert.deepEqual(result.posts.slice(0, 3).map((p) => p.title), seed.outline!.posts.map((p) => p.title))
  assert.deepEqual(spreadPostDays(result.posts, "2026-09-07", "2026-09-10").map((p) => p.dayOffset), [3, 4, 5, 6])
  assert.deepEqual(spreadPostDays(result.posts, "2026-09-07", "2026-09-20").map((p) => p.dayOffset), [6, 6, 6, 6])
})
