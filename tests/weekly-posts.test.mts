import assert from "node:assert/strict"
import test from "node:test"
import { validatePostSchedule, validatePostCopy, POST_SCHEDULE_SCHEMA, POST_COPY_SCHEMA, IMAGE_GENERATION_POLICY } from "../src/blueprints/social/weekly-planning/posts"
import { validateSchema } from "../src/blueprints/social/brand-discovery/validation"
import { planningFixture, completePlanningFixture } from "./weekly-planning-fixture"
import { postsContext } from "../src/application/weekly-planning/posts"

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
