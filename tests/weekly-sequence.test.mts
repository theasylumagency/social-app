import assert from "node:assert/strict"
import test from "node:test"
import { applySequenceReview, recentEditorialWork, sequenceIssues, validateSequenceReview, SEQUENCE_REVIEW_SCHEMA } from "../src/blueprints/social/weekly-planning/sequence"
import { summarizePlan } from "../src/blueprints/social/weekly-planning/model"
import { emptyPosts, validatePostSchedule } from "../src/blueprints/social/weekly-planning/posts"
import { validateSchema } from "../src/blueprints/social/brand-discovery/validation"
import { compilePlanningContext } from "../src/application/weekly-planning/advance"
import { createPostSchedule, reviewPostSequence } from "../src/application/weekly-planning/posts"
import { completePlanningFixture, planningFixture } from "./weekly-planning-fixture"
import { scheduleFixture, copyFixture } from "./weekly-posts-fixture"
import { distinctSequence, ordinaryPosts, suppliedWeek } from "./weekly-sequence-fixture"

test("supplied consecutive Georgian weeks expose different titles doing related reader work", () => {
  const first = suppliedWeek(1), second = suppliedWeek(2)
  assert.equal(first.length, 3); assert.equal(second.length, 3)
  assert.equal(new Set([...first, ...second].map((p) => p.title)).size, 6)
  assert.match(first[0]!.brief.takeaway, /სტატუსის/)
  assert.match(second[0]!.brief.job, /ოთხნაწილიანი/)
  assert.match(second[1]!.brief.points.join(" "), /ავტომატიზაციის/)
})

test("identical jobs and takeaways are rejected deterministically despite different titles", () => {
  const schedule = scheduleFixture()
  schedule.posts[1]!.brief = { ...schedule.posts[0]!.brief, job: `  ${schedule.posts[0]!.brief.job}  ` }
  assert.ok(validatePostSchedule(schedule, ["d1", "d2", "d3"]).some((e) => e.includes("Duplicate post job")))
})

test("recent memory preserves post jobs, bounds recency, deduplicates weeks and supports legacy history", async () => {
  const run = await completePlanningFixture(await planningFixture())
  const posts = { ...emptyPosts(), outline: { ...scheduleFixture(), posts: suppliedWeek(1) } }
  const summary = summarizePlan(run.payload.plan!, posts, "ready")
  summary.week = "2026-09-14"
  run.week = "2026-09-21"
  run.payload.priorWeeks = [summary, { ...summary, objective: "duplicate version" }, { week: "2026-09-07", objective: "old", directions: ["legacy direction"], experiment: null }, { ...summary, week: "2026-08-17" }, { ...summary, week: run.week }, { ...summary, week: "2026-09-28" }]
  const recent = recentEditorialWork(run.payload, run.week)
  assert.equal(recent.length, 4)
  assert.deepEqual(recent[0]!.points, posts.outline.posts[0]!.brief.points)
  assert.equal(recent[0]!.status, "ready")
  assert.equal(recent[3]!.job, "legacy direction")
  assert.equal(recent[3]!.status, "unknown")
  assert.deepEqual(compilePlanningContext(run).recentEditorialWork, recent)
  assert.deepEqual(compilePlanningContext(run).recentResults, [])
  assert.deepEqual(compilePlanningContext(run).eligibleProof, [])
})

test("semantic judgments require every pair and a real recent comparison for every post", async () => {
  const run = await planningFixture()
  run.week = "2026-09-21"
  run.payload.priorWeeks = [{ week: "2026-09-14", objective: "trust", directions: [], experiment: null, posts: suppliedWeek(1).map((p) => ({ title: p.title, ...p.brief })) }]
  const recent = recentEditorialWork(run.payload, run.week)
  const review = distinctSequence(3, recent[0]!.historyKey)
  assert.deepEqual(validateSchema(review, SEQUENCE_REVIEW_SCHEMA), [])
  assert.deepEqual(validateSequenceReview(review, suppliedWeek(2), recent), [])
  const missing = structuredClone(review); missing.pairs.pop()
  assert.ok(validateSequenceReview(missing, suppliedWeek(2), recent).length)
  const wrong = structuredClone(review); wrong.posts[0]!.closestRecentKey = "invented"
  assert.ok(validateSequenceReview(wrong, suppliedWeek(2), recent).length)
  wrong.posts[0]!.closestRecentKey = null
  assert.ok(validateSequenceReview(wrong, suppliedWeek(2), recent).length)
  const duplicate = structuredClone(review); duplicate.pairs[1] = duplicate.pairs[0]!
  assert.ok(validateSequenceReview(duplicate, suppliedWeek(2), recent).length)
  review.posts.forEach((p) => { p.relationship = "repeats" })
  // The deterministic gate consumes semantic findings; it does not claim lexical detection.
  assert.equal(sequenceIssues(review).length, 3)
  const payload = { ...emptyPosts(), outline: { ...scheduleFixture(), posts: suppliedWeek(2) } }
  let calls = 0
  await reviewPostSequence(run, payload, async <T,>(call: import("../src/infrastructure/models/brand-reasoning").BrandModelCall) => {
    calls++; assert.equal(call.step, "post_sequence")
    assert.deepEqual((call.input as { recentEditorialWork: unknown }).recentEditorialWork, recent)
    assert.deepEqual(call.validate!(review), [])
    return review as T
  })
  assert.equal(calls, 1)
})

test("narrow brands need no role quota; substantive continuations and necessary repeats are allowed", () => {
  const review = distinctSequence(3)
  assert.deepEqual(validateSequenceReview(review, ordinaryPosts(), []), [])
  review.pairs[0]!.relationship = "overlap"
  review.posts[0]!.relationship = "advances"
  review.posts[1]!.relationship = "necessaryRepeat"
  assert.deepEqual(sequenceIssues(review), [])
})

test("an overlap or advances label cannot excuse an incidental addition to repeated work", () => {
  const review = distinctSequence(2, "h1p1")
  review.posts[0]!.relationship = "advances"; review.posts[0]!.addedValue = "incidental"
  review.pairs[0]!.relationship = "overlap"; review.pairs[0]!.addedValue = "incidental"
  assert.equal(sequenceIssues(review).length, 2)
  review.posts[0]!.relationship = "necessaryRepeat"
  assert.equal(sequenceIssues(review).length, 1, "only a justified recurrence can waive recent added value, not within-week duplication")
})

test("duplicated jobs receive one persisted outline repair before writing, then block approval", async () => {
  const payload = { ...emptyPosts(), outline: { ...scheduleFixture(), posts: suppliedWeek(2) } }
  const bad = distinctSequence(3); bad.pairs[0]!.relationship = "duplicate"
  assert.equal(applySequenceReview(payload, bad), "outline")
  assert.equal(payload.sequenceRepairs, 1)
  assert.equal(payload.outline!.posts.length, 0)
  assert.equal(payload.sequenceFeedback!.rejectedPosts.length, 3)
  const run = await completePlanningFixture(await planningFixture())
  const next = await createPostSchedule(run, async <T,>(call: import("../src/infrastructure/models/brand-reasoning").BrandModelCall) => {
    assert.deepEqual((call.input as { sequenceFeedback: unknown }).sequenceFeedback, payload.sequenceFeedback)
    return { ...scheduleFixture(), posts: ordinaryPosts() } as T
  }, payload)
  payload.outline = next
  assert.equal(applySequenceReview(payload, bad), "ready")
  assert.ok(payload.review!.issues.some((i) => i.severity === "blocking"))
  assert.deepEqual(payload.copies, {})
  assert.equal(payload.sequenceRepairs, 1)
})

test("sequence repair preserves retained copies and cannot rewrite a legacy written job", () => {
  const payload = { ...emptyPosts(), outline: scheduleFixture(), sequenceRetainedCount: 1, copies: { p1: copyFixture() } }
  const review = distinctSequence(3); review.pairs[0]!.relationship = "duplicate"
  assert.equal(applySequenceReview(payload, review), "outline")
  assert.equal(payload.outline!.posts.length, 1)
  assert.deepEqual(payload.copies.p1, copyFixture())
  const legacy = { ...emptyPosts(), outline: scheduleFixture(), copies: { p2: copyFixture() } }
  assert.equal(applySequenceReview(legacy, review), "ready")
  assert.deepEqual(legacy.copies.p2, copyFixture())
})
