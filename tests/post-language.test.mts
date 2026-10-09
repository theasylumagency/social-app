import assert from "node:assert/strict"
import test from "node:test"
import { completePlanningFixture, planningFixture } from "./weekly-planning-fixture"
import { copyFixture, editorialFixture, currentScheduleFixture as scheduleFixture } from "./weekly-posts-fixture"
import { writePost, reviewPosts } from "../src/application/weekly-planning/posts"
import type { BrandReasoner, BrandModelCall } from "../src/infrastructure/models/brand-reasoning"
import { POST_WRITER_PROMPT } from "../src/blueprints/social/weekly-planning/prompts/posts"

test("English creation and repair use the content language, while independent reviews retain Georgian explanation", async () => {
  const run = await completePlanningFixture(await planningFixture())
  run.payload.basis.payload.input.language = "en"
  const copy = copyFixture()
  for (const variant of copy.variants) variant.caption = "A photograph can support an assessment; it cannot guarantee an outcome."
  const payload = { outline: scheduleFixture(), copies: { p1: copy, p2: copy, p3: copy }, review: null, repairs: 0 }
  const calls: BrandModelCall[] = []
  const reason: BrandReasoner = async <T,>(call: BrandModelCall) => {
    calls.push(call)
    return (call.step === "post_editorial" ? editorialFixture() : call.step === "post_review" ? { summary: "შემოწმებულია", issues: [] } : copy) as T
  }
  await writePost(run, payload, "p1", reason)
  await writePost(run, { ...payload, repairDrafts: { p1: copy } }, "p1", reason)
  for (const call of calls) {
    assert.equal(call.outputLanguage, "en")
    assert.equal((call.input as { contentLanguage: string }).contentLanguage, "en")
  }
  assert.doesNotMatch(POST_WRITER_PROMPT, /finished Georgian|80–180 Georgian words|Natural Georgian/)
  await reviewPosts(run, payload, reason)
  assert.equal(calls.at(-1)!.outputLanguage, undefined)
  assert.equal(((calls.at(-1)!.input as { posts: { contentLanguage: string }[] }).posts[0]!).contentLanguage, "en")
})
