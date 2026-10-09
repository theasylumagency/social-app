import assert from "node:assert/strict"
import test from "node:test"
import { weeklyApprovalFixture } from "./weekly-approval-fixture"
import { knowledgeFixture } from "./public-knowledge-fixture"
import { materializeApprovedPost } from "../src/application/publishing/materialize-approved-post"
import { decodeSocialPublicationBundle } from "../src/application/publishing/publication-bundle-codec"
import { SOCIAL_CONTENT_MODES } from "../src/blueprints/social/tokens"
import { validatePostContentMode } from "../src/blueprints/social/weekly-planning/post-mode"
import { POST_SCHEDULE_V3_SCHEMA } from "../src/blueprints/social/weekly-planning/posts"
import { validateSchema } from "../src/blueprints/social/brand-discovery/validation"

test("post mode is required during planning and cannot be selected after approval", () => {
  const f = weeklyApprovalFixture(), post = f.posts.payload.outline!.posts[0]!
  assert.deepEqual(validateSchema(f.posts.payload.outline, POST_SCHEDULE_V3_SCHEMA), [])
  assert.throws(() => materializeApprovedPost({ ...f, contentMode: SOCIAL_CONTENT_MODES.directOffer }), /mode must match/)
  delete post.contentMode
  assert.ok(validateSchema(f.posts.payload.outline, POST_SCHEDULE_V3_SCHEMA).length)
  assert.throws(() => materializeApprovedPost(f), /current factual/)
})
test("proofLed needs selected, current proof and its actual declared use", () => {
  const f = weeklyApprovalFixture(), post = f.posts.payload.outline!.posts[0]!, copy = f.posts.payload.copies.p1!
  post.contentMode = SOCIAL_CONTENT_MODES.proofLed
  assert.ok(validatePostContentMode(post, undefined, copy).length)
  const facts = knowledgeFixture()
  assert.ok(validatePostContentMode(post, facts, copy).length, "unselected proof grants no authority")
  post.factKeys = ["fact-price"]
  assert.deepEqual(validatePostContentMode(post, facts), [])
  assert.ok(validatePostContentMode(post, facts, copy).length, "available proof must actually be used")
  copy.factualReferences = { factKeys: ["fact-price"], proofKeys: ["proof-price"] }
  assert.deepEqual(validatePostContentMode(post, facts, copy), [])
  post.brief.job = "Show the confirmed consultation price"
  post.brief.takeaway = facts.facts[0]!.statement
  copy.variants[0]!.caption = facts.facts[0]!.statement
  f.run.payload.publicKnowledge = facts
  f.renew()
  const publication = materializeApprovedPost({ ...f, contentMode: SOCIAL_CONTENT_MODES.proofLed })
  assert.equal(publication.bundle.contentBrief.evidenceMode, "proofRequired")
  assert.deepEqual(publication.bundle.contentBrief.evidenceIds, ["evidence"])
  assert.doesNotThrow(() => decodeSocialPublicationBundle(publication.schema, publication.version, publication.bundle))
  facts.proofs[0]!.validUntil = "2026-10-06T10:00:00Z"
  assert.ok(validatePostContentMode(post, facts, copy).length)
})
test("human approval binds the whole batch, reviewer results, rules and repair count", () => {
  for (const mutate of [
    (f: ReturnType<typeof weeklyApprovalFixture>) => { f.posts.approvalEvidence = null },
    (f: ReturnType<typeof weeklyApprovalFixture>) => { f.posts.approvalEvidence!.actorId = "other-owner" },
    (f: ReturnType<typeof weeklyApprovalFixture>) => { f.posts.payload.reviewEvidence!.safety.summary = "Changed assessment" },
    (f: ReturnType<typeof weeklyApprovalFixture>) => { f.posts.payload.repairs++ },
    (f: ReturnType<typeof weeklyApprovalFixture>) => { f.posts.payload.operatingRules = [{ id: "new-rule" } as never] },
  ]) { const f = weeklyApprovalFixture(); mutate(f); assert.throws(() => materializeApprovedPost(f)) }
  const f = weeklyApprovalFixture()
  const sibling = structuredClone(f.posts.payload.outline!.posts[0]!); sibling.title = "Separate useful task"
  f.posts.payload.outline!.posts.push(sibling)
  f.posts.payload.copies.p2 = structuredClone(f.posts.payload.copies.p1!)
  f.posts.payload.copies.p2.variants[0]!.caption = "Mark the original features you want to preserve before describing any damage."
  f.renew()
  assert.doesNotThrow(() => materializeApprovedPost(f))
  f.posts.payload.copies.p2.variants[0]!.caption = "An unapproved sibling edit"
  assert.throws(() => materializeApprovedPost(f), /current factual/)
})
test("publication decoding rejects changed execution and fabricated or incomplete review passes", () => {
  const f = weeklyApprovalFixture(), publication = materializeApprovedPost(f)
  for (const mutate of [
    (b: typeof publication.bundle) => { b.contentExecutionSpec = { ...b.contentExecutionSpec, contentMode: SOCIAL_CONTENT_MODES.trustBuilder } },
    (b: typeof publication.bundle) => { b.contentExecutionSpec = { ...b.contentExecutionSpec, rationale: "Changed execution" } },
    (b: typeof publication.bundle) => { b.contentBrief = { ...b.contentBrief, evidenceIds: ["invented-evidence" as never] } },
    (b: typeof publication.bundle) => { b.contentBrief = { ...b.contentBrief, audienceDirection: { ...b.contentBrief.audienceDirection, bias: "morePractical" } } },
    (b: typeof publication.bundle) => { b.weeklyReview.deterministicIssues.push({ postKey: "p1", severity: "blocking", message: "Missing proof" }) },
    (b: typeof publication.bundle) => { b.weeklyReview.context.language = "ka" },
    (b: typeof publication.bundle) => { b.approval.binding.batchDigest = "f".repeat(64) },
    (b: typeof publication.bundle) => { b.weeklyReview.editorial.posts.pop() },
    (b: typeof publication.bundle) => { b.weeklyReview.modelRuns.pop() },
  ]) { const changed = structuredClone(publication.bundle); mutate(changed); assert.throws(() => decodeSocialPublicationBundle(publication.schema, publication.version, changed)) }
})
