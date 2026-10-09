import assert from "node:assert/strict"
import test from "node:test"
import { currentFactualBlocker, factBlocker, postAuthorityReferences, publicKnowledgeContext, validateFactualReferences, verbatimSourceSupports } from "../src/blueprints/social/public-knowledge"
import { compilePostGenerationContext, compilePostEditorialContext } from "../src/blueprints/social/weekly-planning/post-context"
import { writePost, reviewPosts, createPostSchedule } from "../src/application/weekly-planning/posts"
import { reviewContextDigest } from "../src/application/weekly-planning/review-evidence"
import { resizePostSchedule } from "../src/blueprints/social/weekly-planning/cadence"
import { deliveryItem } from "../src/application/publishing/delivery-view"
import { knowledgeFixture } from "./public-knowledge-fixture"
import { completePlanningFixture, planningFixture } from "./weekly-planning-fixture"
import { copyFixture, currentScheduleFixture as scheduleFixture } from "./weekly-posts-fixture"
import type { PostsPayload } from "../src/blueprints/social/weekly-planning/posts"
import { POST_EDITORIAL_DIMENSIONS } from "../src/blueprints/social/weekly-planning/post-editorial"

test("public authority requires owner provenance, permission, current validity and correct brand", () => {
  const k = knowledgeFixture()
  assert.equal(factBlocker(k.facts[0]!, k, k.capturedAt), null)
  for (const mutate of [
    () => { k.facts[0]!.permission = "internalGuidance" },
    () => { k.facts[0]!.permission = "blocked" },
    () => { k.facts[0]!.fact = { ...k.facts[0]!.fact, provenance: [] } },
    () => { k.brandId = "another-brand" },
    () => { k.capturedAt = k.facts[0]!.fact.validUntil! },
  ]) { const fresh = knowledgeFixture(); Object.assign(k, fresh); mutate(); assert.ok(factBlocker(k.facts[0]!, k, k.capturedAt)); assert.deepEqual(publicKnowledgeContext(k).publicFacts, []) }
  assert.deepEqual(publicKnowledgeContext().publicFacts, [])
})
test("proof-required facts reject unknown, insufficient, stale, private and unrelated proof", () => {
  const cases = ["unknown", "insufficient", "expired", "private", "unrelated", "broader", "wrongRevision"]
  for (const c of cases) {
    const k = knowledgeFixture(); k.facts[0]!.permission = "publicUseWithProof"
    assert.equal(factBlocker(k.facts[0]!, k, k.capturedAt), null)
    const p = k.proofs[0]!
    if (c === "unknown" || c === "insufficient") p.assessment = { ...p.assessment, supportStatus: c }
    if (c === "expired") p.validUntil = k.capturedAt
    if (c === "private") p.permission = "internalGuidance"
    if (c === "unrelated") p.proof = { ...p.proof, subject: { kind: "businessFact", factId: "other" as never } }
    if (c === "broader") p.source.excerpt = "Every consultation guarantees success."
    if (c === "wrongRevision") p.factRevision++
    assert.ok(factBlocker(k.facts[0]!, k, k.capturedAt), c)
  }
  assert.equal(verbatimSourceSupports("Costs 25 GEL.", "Costs 50 GEL."), false)
})
test("post relevance and factual references cannot broaden supplied authority", () => {
  const k = knowledgeFixture()
  assert.deepEqual(publicKnowledgeContext(k, []).publicFacts, [])
  assert.deepEqual(validateFactualReferences(k, ["fact-price"], { factKeys: ["fact-price"], proofKeys: ["proof-price"] }), [])
  assert.ok(validateFactualReferences(k, [], { factKeys: ["fact-price"], proofKeys: [] }).length)
  assert.ok(validateFactualReferences(k, ["invented"], { factKeys: [], proofKeys: [] }).length)
  assert.ok(validateFactualReferences(k, ["fact-price"], { factKeys: ["fact-price"], proofKeys: ["invented"] }).length)
  k.facts[0]!.permission = "publicUseWithProof"
  assert.ok(validateFactualReferences(k, ["fact-price"], { factKeys: ["fact-price"], proofKeys: [] }).length)
})
test("selected authority is rechecked even when the writer omits usage metadata", () => {
  const saved = knowledgeFixture(), refs = postAuthorityReferences({ factKeys: ["fact-price"] }, { factualReferences: { factKeys: [], proofKeys: [] } }, saved)
  assert.equal(currentFactualBlocker(saved, refs, saved, saved.capturedAt), null)
  const updated = structuredClone(saved); updated.facts[0]!.revision++
  assert.ok(currentFactualBlocker(saved, refs, updated, saved.capturedAt))
  assert.ok(currentFactualBlocker(saved, refs, saved, saved.facts[0]!.fact.validUntil!))
  const unrelated = structuredClone(saved); unrelated.revision++
  assert.equal(currentFactualBlocker(saved, refs, unrelated, saved.capturedAt), null)
})
test("writer and factual reviewer share the scoped snapshot; editorial review gains no authority", async () => {
  const run = await completePlanningFixture(await planningFixture())
  run.payload.publicKnowledge = knowledgeFixture(run.brandId)
  const outline = scheduleFixture(); outline.posts[0]!.factKeys = ["fact-price"]
  const copy = copyFixture(); copy.factualReferences = { factKeys: ["fact-price"], proofKeys: ["proof-price"] }
  const payload: PostsPayload = { outline, copies: Object.fromEntries(outline.posts.map((_, i) => [`p${i+1}`, { ...copy, factualReferences: i ? { factKeys: [], proofKeys: [] } : copy.factualReferences! }])), review: null, repairs: 0 }
  const calls: import("../src/infrastructure/models/brand-reasoning").BrandModelCall[] = []
  await writePost(run, payload, "p1", async call => { calls.push(call); assert.deepEqual(call.validate!(copy), []); return copy as never })
  await reviewPosts(run, payload, async call => { calls.push(call); return (call.step === "post_review" ? { summary: "Reviewed", issues: [] } : { posts: outline.posts.map((_, i) => ({ postKey: `p${i+1}`, dimensions: POST_EDITORIAL_DIMENSIONS.map(dimension => ({ dimension, rating: "acceptable", note: "Reviewed" })), issues: [] })) }) as never })
  const writer = calls[0]!.input as ReturnType<typeof compilePostGenerationContext>, review = calls[1]!.input as { postContexts: typeof writer[] }
  assert.deepEqual(writer.publicFacts, review.postContexts[0]!.publicFacts)
  assert.deepEqual(writer.eligibleProof, review.postContexts[0]!.eligibleProof)
  assert.equal("publicFacts" in compilePostEditorialContext(run, outline.posts[0]!), false)
  const hash = reviewContextDigest(run, payload); run.payload.publicKnowledge.facts[0]!.statement = "Changed price."
  assert.notEqual(reviewContextDigest(run, payload), hash)
})
test("planner rejects an invented fact key and cadence preserves factual metadata", async () => {
  const run = await completePlanningFixture(await planningFixture()); run.payload.publicKnowledge = knowledgeFixture(run.brandId)
  const outline = scheduleFixture(); outline.posts[0]!.factKeys = ["invented"]
  await createPostSchedule(run, async call => { assert.ok(call.validate!(outline).some(e => e.includes("public fact"))); return outline as never })
  const copy = copyFixture(); copy.factualReferences = { factKeys: ["fact-price"], proofKeys: ["proof-price"] }
  const payload: PostsPayload = { outline: scheduleFixture(), copies: { p1: copy, p2: copy, p3: copy }, review: null, repairs: 0 }
  assert.deepEqual(resizePostSchedule(payload, { facebook: 1, instagram: 0 }).payload.copies.p1!.factualReferences, copy.factualReferences)
})
test("fact hold stays visible without hiding an ambiguous or confirmed provider outcome", () => {
  const now = "2026-10-07T10:00:00Z", record = { id: "s", week: "2026-10-05", runId: "r", version: 1, postKey: "p1", channel: "facebook" as const, accountName: "Page", publishAt: now, cancelled: false, canPublish: true, factualBlocker: "Changed fact", attempts: [] }
  const policy = { enabled: true, maxAttempts: 3, graceMs: 60000 }
  assert.equal(deliveryItem(record, policy, now).state, "factBlocked")
  const attempt = { number: 1, attemptedAt: now, requestState: "dispatchStarted" as const, result: "unknownOutcome" as const, recordedAt: now, retryAfter: null, publishedAt: null, reconciliation: null, reconciledAt: null, reconciledPublishedAt: null, failureType: null }
  assert.equal(deliveryItem({ ...record, attempts: [attempt] }, policy, now).state, "confirming")
  assert.equal(deliveryItem({ ...record, attempts: [{ ...attempt, result: "published", publishedAt: now }] }, policy, now).state, "published")
})
