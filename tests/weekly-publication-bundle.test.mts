import { captureWeeklyApproval } from "../src/application/weekly-planning/approval-evidence"
import assert from "node:assert/strict"
import test from "node:test"
import { materializeApprovedPost } from "../src/application/publishing/materialize-approved-post"
import { decodeSocialPublicationBundle } from "../src/application/publishing/publication-bundle-codec"
import { approvedPublicationFixture } from "./publication-bundle-fixture"
import { reviewFixture } from "./weekly-review-fixture"
import type { PlanningRun } from "../src/blueprints/social/weekly-planning/model"
import type { PostsBatch } from "../src/blueprints/social/weekly-planning/posts"
import { SOCIAL_CONTENT_MODES } from "../src/blueprints/social/tokens"
import { knowledgeFixture } from "./public-knowledge-fixture"

function fixture() {
  const old = approvedPublicationFixture()
  const run = { id: old.sourceWeeklyRunId, version: 1, brandId: old.brandId, status: "approved", payload: { basis: { sessionId: "basis", revision: 1, payload: { input: { language: "ka" } } }, plan: { id: "plan", state: "approved", contentDirections: [{ id: "direction", audienceDirection: old.bundle.contentBrief.audienceDirection }] } } } as unknown as PlanningRun
  const post = { contentMode: SOCIAL_CONTENT_MODES.educational, dayOffset: 0, title: "Post", directionKey: "d1", format: "image", channels: [{ channel: "facebook", reason: "Fits" }], why: "Useful", brief: { job: "Explain", takeaway: "Clear", points: ["One", "Two"], mustNotSay: [] }, visual: { kind: "photo", aspectRatio: "1:1", frames: ["Product"], description: "Product" } }
  const posts = { runId: run.id, status: "ready", approvedAt: "2026-10-07T10:01:00.000Z", approvedByUserId: "owner", payload: { outline: { posts: [post] }, copies: { p1: { variants: [{ channel: "facebook", caption: "Reviewed text", script: "", frames: [], onScreenText: [] }] } }, review: { summary: "Reviewed", issues: [] }, repairs: 0 } } as unknown as PostsBatch
  posts.payload.reviewEvidence = reviewFixture(run, posts.payload, "2026-10-07T10:00:00.000Z")
  posts.approvalEvidence = captureWeeklyApproval(run, posts.payload, "owner", posts.approvedAt!)
  return { run, posts, postKey: "p1", channel: "facebook" as const, contentMode: SOCIAL_CONTENT_MODES.educational }
}
test("version three binds actual reviews and approval to the exact post and channel text", () => {
  const input = fixture()
  const publication = materializeApprovedPost(input)
  assert.equal(publication.version, 3)
  assert.ok(!("evaluationAudit" in publication.bundle))
  assert.deepEqual(decodeSocialPublicationBundle(publication.schema, publication.version, publication.bundle), publication.bundle)
  const changed = structuredClone(publication.bundle)
  assert.equal(changed.draft.format, "staticPost")
  if (changed.draft.format === "staticPost") changed.draft = { ...changed.draft, text: "Unreviewed text" }
  assert.throws(() => decodeSocialPublicationBundle(publication.schema, 3, changed), /differs/)
  const missing = structuredClone(publication.bundle); missing.weeklyReview.modelRuns.pop()
  assert.throws(() => decodeSocialPublicationBundle(publication.schema, 3, missing), /provenance/)
  const unsupported = structuredClone(publication.bundle)
  unsupported.contentExecutionSpec = { ...unsupported.contentExecutionSpec, contentMode: "unknown" as never }
  assert.throws(() => decodeSocialPublicationBundle(publication.schema, 2, unsupported), /lineage/)
  input.posts.payload.copies.p1!.variants[0]!.caption = "Unreviewed edit"
  assert.throws(() => materializeApprovedPost(input), /current factual/)
})
test("historical approval needs a fresh review before a new publication is materialized", () => {
  const input = fixture(); delete input.posts.payload.reviewEvidence
  assert.throws(() => materializeApprovedPost(input), /current factual/)
  const current = fixture(); current.posts.payload.reviewEvidence!.editorial.posts[0]!.dimensions[0]!.rating = "weak"
  assert.throws(() => materializeApprovedPost(current), /blocking/)
  const incomplete = fixture(); incomplete.posts.payload.review = null
  assert.throws(() => materializeApprovedPost(incomplete), /approved weekly/)
})
test("review evidence cannot substitute a different public-facts snapshot", () => {
  const input = fixture()
  input.run.payload.publicKnowledge = knowledgeFixture(input.run.brandId)
  input.posts.payload.copies.p1!.factualReferences = { factKeys: [], proofKeys: [] }
  input.posts.payload.reviewEvidence = reviewFixture(input.run, input.posts.payload, "2026-10-07T10:00:00.000Z")
  input.posts.approvalEvidence = captureWeeklyApproval(input.run, input.posts.payload, "owner", input.posts.approvedAt!)
  assert.doesNotThrow(() => materializeApprovedPost(input))
  input.posts.payload.reviewEvidence.publicKnowledge!.facts[0]!.statement = "A different price."
  assert.throws(() => materializeApprovedPost(input), /current factual/)
})
