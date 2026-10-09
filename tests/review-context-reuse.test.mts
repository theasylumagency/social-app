import assert from "node:assert/strict"
import test from "node:test"
import { completePlanningFixture, planningFixture } from "./weekly-planning-fixture"
import { currentScheduleFixture, copyFixture, editorialFixture } from "./weekly-posts-fixture"
import { compilePostGenerationContext, compilePostEditorialContext } from "../src/blueprints/social/weekly-planning/post-context"
import { reviewPosts } from "../src/application/weekly-planning/posts"
import type { BrandModelCall } from "../src/infrastructure/models/brand-reasoning"
import type { PostsPayload } from "../src/blueprints/social/weekly-planning/posts"

test("both independent reviewers receive byte-identical inputs after sharing context compilation", async () => {
  const run = await completePlanningFixture(await planningFixture())
  const payload: PostsPayload = { outline: currentScheduleFixture(), copies: { p1: copyFixture(), p2: copyFixture(), p3: copyFixture() }, review: null, repairs: 0 }
  const previousSafety = { postContexts: payload.outline!.posts.map((post, i) => ({ postKey: `p${i + 1}`, ...compilePostGenerationContext(run, post) })), weeklyOutline: payload.outline, drafts: payload.copies }
  const previousEditorial = { posts: payload.outline!.posts.map((post, i) => ({ postKey: `p${i + 1}`, ...compilePostEditorialContext(run, post), draft: payload.copies[`p${i + 1}`]! })) }
  const calls: BrandModelCall[] = []
  await reviewPosts(run, payload, async <T,>(call: BrandModelCall) => { calls.push(call); return (call.step === "post_review" ? { summary: "Checked", issues: [] } : editorialFixture()) as T })
  assert.equal(calls.length, 2)
  assert.equal(JSON.stringify(calls.find(call => call.step === "post_review")!.input), JSON.stringify(previousSafety))
  assert.equal(JSON.stringify(calls.find(call => call.step === "post_editorial")!.input), JSON.stringify(previousEditorial))
})
