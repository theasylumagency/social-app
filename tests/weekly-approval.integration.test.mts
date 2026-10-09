import assert from "node:assert/strict"
import test from "node:test"
import { socialDeliveryFixture } from "./social-delivery-fixture"
import { persistApprovalFixture } from "./weekly-approval-fixture"
import { PostgresSocialPublishStore } from "../src/infrastructure/postgres/social-publish-store"
import { runSocialPublishQueue } from "../src/application/publishing/run-publish-queue"
import { assembleSocialContentPublishAttempt } from "../src/blueprints/social/content-publish-attempt"
import { resolveSocialContentPublishEligibility } from "../src/blueprints/social/content-publish-eligibility"
import { createIsoDateTime } from "../src/core/domain/primitives"
import type { DueSocialPublication } from "../src/application/publishing/publication-store"
import { recheckWeeklyPosts } from "../src/infrastructure/postgres/weekly-posts-repair"
import { SOCIAL_CONTENT_MODES } from "../src/blueprints/social/tokens"
import { scheduleApprovedPost } from "../src/application/publishing/schedule-approved-post"

function proposed(item: DueSocialPublication, now: string) {
  const eligibility = resolveSocialContentPublishEligibility({ draft: item.bundle.draft, contentExecutionSpec: item.bundle.contentExecutionSpec,
    schedule: item.schedule, scheduleState: item.lifecycle, publishingAccount: item.publishingAccount, now: createIsoDateTime(now) })
  assert.equal(eligibility.eligible, true)
  if (!eligibility.eligible) throw Error("Fixture is not due")
  return assembleSocialContentPublishAttempt({ id: item.attemptId, attemptNumber: item.attemptNumber, eligibility, attemptedAt: createIsoDateTime(now) })
}
async function changed(f: Awaited<ReturnType<typeof persistApprovalFixture>>) {
  f.posts.payload.copies.p1!.variants[0]!.caption = "Place the item in steady light before taking a full view and a separate detail photograph."
  f.renew(); await f.persist()
}
test("replacement is explicit, atomic, idempotent and preserves the old immutable bundle", async t => {
  const { pool } = await socialDeliveryFixture(t), f = await persistApprovalFixture(pool)
  const original = (await f.schedule())[0]!, oldId = original.publicationInputId
  const oldBundle = (await pool.query("SELECT bundle FROM social_publication_inputs WHERE id=$1", [oldId])).rows[0].bundle
  const oldDue = await f.store.claimDue(f.publishAt, 3)
  await changed(f)
  await assert.rejects(f.schedule(), /ვერსია შეიცვალა/)
  await assert.rejects(f.schedule(["foreign-input"]), /ვერსია შეიცვალა/)
  assert.equal((await pool.query("SELECT count(*)::int n FROM social_publication_inputs")).rows[0].n, 1)
  assert.equal((await pool.query("SELECT count(*)::int n FROM social_content_schedule_events")).rows[0].n, 0)
  const replacement = (await f.schedule([oldId]))[0]!
  assert.notEqual(replacement.publicationInputId, oldId)
  const historical = (await pool.query("SELECT bundle,superseded_by_input_id FROM social_publication_inputs WHERE id=$1", [oldId])).rows[0]
  assert.deepEqual(historical.bundle, oldBundle)
  assert.equal(historical.superseded_by_input_id, replacement.publicationInputId)
  const rows = await f.store.listSchedules({ ownerId: "owner", brandId: "brand", sourceRunId: f.run.id })
  assert.equal(rows.find(row => row.publicationInputId === oldId)!.lifecycle.status, "cancelled")
  assert.equal(rows.filter(row => row.lifecycle.status === "scheduled").length, 1)
  const retry = (await f.schedule([oldId]))[0]!
  assert.equal(retry.schedule.id, replacement.schedule.id)
  assert.equal((await pool.query("SELECT count(*)::int n FROM social_content_schedule_events")).rows[0].n, 1)
  assert.deepEqual((await f.store.claimDue(f.publishAt, 3)).map(row => row.publicationInputId), [replacement.publicationInputId])
  let calls = 0
  const result = await runSocialPublishQueue({ publications: { claimDue: async () => oldDue } as never,
    attempts: new PostgresSocialPublishStore(pool), publisherFor: () => async () => { calls++; throw Error("Unexpected provider call") },
    now: () => createIsoDateTime(f.publishAt), maxAttempts: 3, unresolvedAttemptGraceMs: 60000 })
  assert.equal(result[0]!.status, "rejected")
  assert.equal(calls, 0)
  assert.equal((await pool.query("SELECT count(*)::int n FROM social_publish_attempts")).rows[0].n, 0)
  await changed(f)
  await assert.rejects(f.schedule([oldId]), /ვერსია შეიცვალა/, "a stale confirmation cannot replace a newer active version")
  assert.equal((await pool.query("SELECT count(*)::int n FROM social_publication_inputs")).rows[0].n, 2)
})
test("a failed destination rolls back input supersession and every cancellation event", async t => {
  const { pool } = await socialDeliveryFixture(t), f = await persistApprovalFixture(pool)
  const original = (await f.schedule())[0]!
  await changed(f)
  await assert.rejects(scheduleApprovedPost({ ownerId: "owner", actorId: "owner", run: f.run, posts: f.posts, assets: [], postKey: "p1",
    now: new Date().toISOString(), replaceInputIds: [original.publicationInputId], destinations: [
      { channel: "facebook", publishingAccountId: "account", publishAt: f.publishAt, contentMode: SOCIAL_CONTENT_MODES.educational },
      { channel: "facebook", publishingAccountId: "unconnected-account", publishAt: f.publishAt, contentMode: SOCIAL_CONTENT_MODES.educational },
    ] }, f.store), /not connected/)
  const row = (await pool.query("SELECT superseded_by_input_id FROM social_publication_inputs WHERE id=$1", [original.publicationInputId])).rows[0]
  assert.equal(row.superseded_by_input_id, null)
  assert.equal((await pool.query("SELECT count(*)::int n FROM social_publication_inputs")).rows[0].n, 1)
  assert.equal((await pool.query("SELECT count(*)::int n FROM social_content_schedule_events")).rows[0].n, 0)
  assert.equal((await f.store.listSchedules({ ownerId: "owner", brandId: "brand" }))[0]!.lifecycle.status, "scheduled")
})
test("any started attempt blocks replacement, including preparation without provider dispatch", async t => {
  const { pool } = await socialDeliveryFixture(t), f = await persistApprovalFixture(pool)
  const original = (await f.schedule())[0]!, due = (await f.store.claimDue(f.publishAt, 3))[0]!
  const attempts = new PostgresSocialPublishStore(pool), a = proposed(due, f.publishAt)
  assert.equal((await attempts.claimAttempt(a)).status, "acquired")
  await changed(f)
  await assert.rejects(f.schedule([original.publicationInputId]), /მცდელობა უკვე/)
  assert.equal((await pool.query("SELECT count(*)::int n FROM social_publication_inputs")).rows[0].n, 1)
  assert.equal((await pool.query("SELECT state FROM social_provider_publish_requests")).rows[0].state, "prepared")
  assert.equal((await attempts.claimAttempt(a)).status, "alreadyRecorded", "the existing canonical intent still owns retries")
})
test("replacement and attempt claim serialize so exactly one can win", async t => {
  const { pool } = await socialDeliveryFixture(t), f = await persistApprovalFixture(pool)
  const original = (await f.schedule())[0]!, due = (await f.store.claimDue(f.publishAt, 3))[0]!
  await changed(f)
  const outcomes = await Promise.allSettled([f.schedule([original.publicationInputId]), new PostgresSocialPublishStore(pool).claimAttempt(proposed(due, f.publishAt))])
  assert.equal(outcomes.filter(result => result.status === "fulfilled").length, 1)
  const state = (await pool.query(`SELECT (SELECT count(*) FROM social_publish_attempts)::int attempts,
    (SELECT count(*) FROM social_publication_inputs WHERE superseded_by_input_id IS NOT NULL)::int replaced`)).rows[0]
  assert.equal(state.attempts + state.replaced, 1)
})
test("historical review upgrade requires explicit modes and clears approval without regenerating copy", async t => {
  const { pool } = await socialDeliveryFixture(t), f = await persistApprovalFixture(pool)
  const historical = structuredClone(f.posts.payload)
  delete historical.outline!.posts[0]!.contentMode
  delete historical.reviewEvidence
  await pool.query("UPDATE weekly_post_batches SET payload=$2::jsonb WHERE run_id=$1", [f.run.id, JSON.stringify(historical)])
  await assert.rejects(recheckWeeklyPosts(pool, "other", f.run.id, 1))
  await assert.rejects(recheckWeeklyPosts(pool, "owner", f.run.id, 1), /აირჩიეთ/)
  await assert.rejects(recheckWeeklyPosts(pool, "owner", f.run.id, 1, {}), /აირჩიეთ/)
  await recheckWeeklyPosts(pool, "owner", f.run.id, 1, { p1: SOCIAL_CONTENT_MODES.educational })
  const row = (await pool.query("SELECT * FROM weekly_post_batches WHERE run_id=$1", [f.run.id])).rows[0]
  assert.deepEqual(row.payload.copies, historical.copies)
  assert.equal(row.payload.outline.posts[0].contentMode, SOCIAL_CONTENT_MODES.educational)
  assert.equal(row.status, "queued"); assert.equal(row.step, "review")
  assert.equal(row.approved_at, null); assert.equal(row.approval_evidence, null)
  assert.equal(row.payload.reviewEvidence, undefined)
})
