import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import test from "node:test"
import { socialDeliveryFixture, unknownResult } from "./social-delivery-fixture"
import { persistApprovalFixture } from "./weekly-approval-fixture"
import { scheduleApprovedWeek } from "../src/application/publishing/schedule-approved-post"
import { PostgresSocialPublishStore } from "../src/infrastructure/postgres/social-publish-store"
import { assembleSocialContentPublishAttempt } from "../src/blueprints/social/content-publish-attempt"
import { resolveSocialContentPublishEligibility } from "../src/blueprints/social/content-publish-eligibility"
import { createIsoDateTime } from "../src/core/domain/primitives"
import { cancelSocialContentSchedule } from "../src/blueprints/social/content-schedule-lifecycle"
import type { DueSocialPublication } from "../src/application/publishing/publication-store"
const timeContext = { timeZone: "Asia/Tbilisi", localDateTime: "2030-01-07T12:00", disambiguation: null }
const later = { ...timeContext, localDateTime: "2030-01-08T12:00" }
const now = "2030-01-07T08:01:00.000Z"
const scope = { ownerId: "owner", brandId: "brand" }
async function twoPosts(pool: Parameters<typeof persistApprovalFixture>[0]) {
  const f = await persistApprovalFixture(pool)
  f.posts.payload.outline!.posts.push({ ...structuredClone(f.posts.payload.outline!.posts[0]!), title: "Second checklist", dayOffset: 1 })
  f.posts.payload.copies.p2 = structuredClone(f.posts.payload.copies.p1!)
  f.posts.payload.copies.p2.variants[0]!.caption = "Sort small pieces into labelled containers. Keep the labels legible so each piece can be matched later."
  f.renew(); await f.persist()
  const selections = ["p1", "p2"].map(postKey => ({ postKey, channel: "facebook" as const, publishingAccountId: "account", timeContext }))
  const save = (changes: Partial<Parameters<typeof scheduleApprovedWeek>[0]> = {}) => scheduleApprovedWeek({ ...scope, actorId: "owner", run: f.run, posts: f.posts,
    assets: [], now: new Date().toISOString(), approvalId: f.posts.approvalEvidence!.id, selections, ...changes }, f.store)
  return { ...f, selections, save }
}
function proposed(item: DueSocialPublication) {
  const eligibility = resolveSocialContentPublishEligibility({ draft: item.bundle.draft, contentExecutionSpec: item.bundle.contentExecutionSpec,
    schedule: item.schedule, scheduleState: item.lifecycle, publishingAccount: item.publishingAccount, now: createIsoDateTime(now) })
  assert.equal(eligibility.eligible, true)
  if (!eligibility.eligible) throw Error("Fixture not due")
  return assembleSocialContentPublishAttempt({ id: item.attemptId, attemptNumber: item.attemptNumber, eligibility, attemptedAt: createIsoDateTime(now) })
}
test("weekly batch saves all selected posts atomically and concurrent identical retries create no duplicates", async t => {
  const { pool } = await socialDeliveryFixture(t), f = await twoPosts(pool)
  const groups = await Promise.all([f.save(), f.save()])
  assert.equal(groups[0]!.length, 2)
  assert.deepEqual(groups[0]!.map(s => s.schedule.id), groups[1]!.map(s => s.schedule.id))
  assert.equal((await pool.query("SELECT count(*)::int n FROM social_content_schedules")).rows[0].n, 2)
  const loaded = await f.store.listSchedules({ ...scope, sourceRunId: f.run.id })
  assert.deepEqual(loaded[0]!.timeContext, timeContext)
  assert.equal(loaded[0]!.schedule.publishAt, "2030-01-07T08:00:00.000Z")
  assert.deepEqual(loaded[0]!.delivery, { state: "notStarted", attemptCount: 0 })
  assert.equal((await pool.query("SELECT count(*)::int n FROM social_publish_attempts")).rows[0].n, 0)
})
test("an invalid final account rolls back earlier posts and publication inputs", async t => {
  const { pool } = await socialDeliveryFixture(t), f = await twoPosts(pool)
  await assert.rejects(f.save({ selections: [f.selections[0]!, { ...f.selections[1]!, publishingAccountId: "disconnected" }] }), /account/i)
  assert.equal((await pool.query("SELECT count(*)::int n FROM social_content_schedules")).rows[0].n, 0)
  assert.equal((await pool.query("SELECT count(*)::int n FROM social_publication_inputs")).rows[0].n, 0)
})
test("missing final media inside the transaction cannot leave a partial group", async t => {
  const { pool } = await socialDeliveryFixture(t), f = await twoPosts(pool)
  f.posts.payload.outline!.posts[1]!.format = "image"
  f.posts.payload.outline!.posts[1]!.visual = { kind: "photo", aspectRatio: "1:1", description: "Detail", frames: ["Detail"] }
  f.renew(); await f.persist()
  await assert.rejects(f.save({ assets: [{ id: randomUUID(), postKey: "p2", slot: 0, width: 10, height: 10, name: "missing.webp" }] }), /mediaManifestIncomplete/)
  assert.equal((await pool.query("SELECT count(*)::int n FROM social_content_schedules")).rows[0].n, 0)
  assert.equal((await pool.query("SELECT count(*)::int n FROM social_publication_inputs")).rows[0].n, 0)
})
test("invalid replacement group preserves every old schedule and immutable input", async t => {
  const { pool } = await socialDeliveryFixture(t), f = await twoPosts(pool), previous = await f.save()
  f.posts.payload.copies.p1!.variants[0]!.caption += " Choose steady light."
  f.posts.payload.copies.p2!.variants[0]!.caption += " Choose a clear background."
  f.renew(); await f.persist()
  const replacements = previous.map(s => s.publicationInputId)
  await assert.rejects(f.save({ replaceInputIds: replacements, selections: [f.selections[0]!, { ...f.selections[1]!, publishingAccountId: "missing" }] }))
  assert.equal((await pool.query("SELECT count(*)::int n FROM social_content_schedule_events")).rows[0].n, 0)
  assert.equal((await pool.query("SELECT count(*)::int n FROM social_publication_inputs WHERE superseded_by_input_id IS NOT NULL")).rows[0].n, 0)
  assert.equal((await pool.query("SELECT count(*)::int n FROM social_content_schedules")).rows[0].n, 2)
  const fresh = await f.save({ replaceInputIds: replacements })
  assert.equal(fresh.length, 2)
  assert.equal((await pool.query("SELECT count(*)::int n FROM social_content_schedule_events")).rows[0].n, 2)
})
test("stale approval, duplicate selections and invalid timezone choice reject the whole group", async t => {
  const { pool } = await socialDeliveryFixture(t), f = await twoPosts(pool)
  await assert.rejects(f.save({ approvalId: "old" }), /დამტკიცება შეიცვალა/u)
  await assert.rejects(f.save({ selections: [f.selections[0]!, f.selections[0]!] }), /მხოლოდ ერთხელ/u)
  await assert.rejects(f.save({ selections: [f.selections[0]!, { ...f.selections[1]!, timeContext: { timeZone: "America/New_York", localDateTime: "2030-11-03T01:30", disambiguation: null } }] }), /ორჯერ/u)
  assert.equal((await pool.query("SELECT count(*)::int n FROM social_content_schedules")).rows[0].n, 0)
})
test("schedule changes require the current revision, persist zone metadata and retry exactly once", async t => {
  const { pool } = await socialDeliveryFixture(t), f = await twoPosts(pool), first = (await f.save())[0]!
  const change = { ...scope, scheduleId: first.schedule.id, operationId: `op:${randomUUID()}`, expectedRevision: 0, action: "reschedule" as const,
    now: new Date().toISOString(), publishAt: "2030-01-08T08:00:00.000Z", timeContext: later }
  await Promise.all([f.store.changeSchedule(change), f.store.changeSchedule(change)])
  const loaded = (await f.store.listSchedules(scope)).find(s => s.schedule.id === first.schedule.id)!
  assert.equal(loaded.lifecycle.revision, 1)
  assert.equal(loaded.lifecycle.status === "scheduled" && loaded.lifecycle.publishAt, change.publishAt)
  assert.deepEqual(loaded.timeContext, later)
  await assert.rejects(f.store.changeSchedule({ ...change, publishAt: "2030-01-09T08:00:00.000Z" }), /სხვა ცვლილებისთვის/u)
  await assert.rejects(f.store.changeSchedule({ ...scope, scheduleId: first.schedule.id, operationId: `op:${randomUUID()}`, expectedRevision: 0, action: "cancel", now: new Date().toISOString() }), /სხვა ჩანართში/u)
  await assert.rejects(f.save(), /შეიცვალა ან გაუქმდა/u)
  assert.equal((await pool.query("SELECT count(*)::int n FROM social_content_schedule_events")).rows[0].n, 1)
})
test("parallel cancel and reschedule cannot overwrite one another; cancellation retries never reactivate", async t => {
  const { pool } = await socialDeliveryFixture(t), f = await twoPosts(pool), first = (await f.save())[0]!
  const cancel = { ...scope, scheduleId: first.schedule.id, operationId: `op:${randomUUID()}`, expectedRevision: 0, action: "cancel" as const, now: new Date().toISOString() }
  const both = await Promise.allSettled([f.store.changeSchedule(cancel), f.store.changeSchedule({ ...cancel, operationId: `op:${randomUUID()}`, action: "reschedule", publishAt: "2030-01-08T08:00:00.000Z", timeContext: later })])
  assert.equal(both.filter(r => r.status === "fulfilled").length, 1)
  const current = (await f.store.listSchedules(scope)).find(s => s.schedule.id === first.schedule.id)!
  if (current.lifecycle.status === "scheduled") await f.store.changeSchedule({ ...cancel, operationId: `op:${randomUUID()}`, expectedRevision: 1 })
  else await f.store.changeSchedule(cancel)
  await assert.rejects(f.save(), /შეიცვალა ან გაუქმდა/u)
  assert.equal((await f.store.listSchedules(scope)).find(s => s.schedule.id === first.schedule.id)!.lifecycle.status, "cancelled")
})
test("a schedule owned by another user cannot be changed or read", async t => {
  const { pool } = await socialDeliveryFixture(t), f = await twoPosts(pool), first = (await f.save())[0]!
  await assert.rejects(f.store.changeSchedule({ ownerId: "intruder", brandId: "brand", scheduleId: first.schedule.id, operationId: "op:foreign", expectedRevision: 0, action: "cancel", now: new Date().toISOString() }), /access denied/i)
  await assert.rejects(f.store.listSchedules({ ownerId: "intruder", brandId: "brand" }), /access denied/i)
})
test("claim versus cancellation is serialized; stale queue selections cannot be sent", async t => {
  const { pool } = await socialDeliveryFixture(t), f = await twoPosts(pool), first = (await f.save())[0]!
  const due = (await f.store.claimDue(now, 3)).find(s => s.schedule.id === first.schedule.id)!, a = proposed(due), publishing = new PostgresSocialPublishStore(pool)
  const cancel = { ...scope, scheduleId: first.schedule.id, operationId: `op:${randomUUID()}`, expectedRevision: 0, action: "cancel" as const, now }
  const results = await Promise.allSettled([f.store.changeSchedule(cancel), publishing.claimAttempt(a)])
  assert.equal(results.filter(r => r.status === "fulfilled").length, 1)
  const n = (await pool.query("SELECT count(*)::int n FROM social_publish_attempts WHERE schedule_id=$1", [first.schedule.id])).rows[0].n
  if (results[0]!.status === "fulfilled") { assert.equal(n, 0); await assert.rejects(publishing.claimAttempt(a), /Schedule changed/i) }
  else { assert.equal(n, 1); assert.equal((await f.store.listSchedules(scope)).find(s => s.schedule.id === first.schedule.id)!.lifecycle.status, "scheduled") }
})
test("prepared, unknown and published attempts all lock changes and expose accurate state", async t => {
  const { pool } = await socialDeliveryFixture(t), f = await twoPosts(pool), schedules = await f.save()
  const publishing = new PostgresSocialPublishStore(pool), due = await f.store.claimDue(now, 3), a = proposed(due.find(s => s.schedule.id === schedules[0]!.schedule.id)!)
  await publishing.claimAttempt(a)
  const cancel = { ...scope, scheduleId: a.scheduleId, operationId: "op:locked", expectedRevision: 0, action: "cancel" as const, now }
  assert.equal((await f.store.listSchedules(scope)).find(s => s.schedule.id === a.scheduleId)!.delivery!.state, "inProgress")
  await assert.rejects(f.store.changeSchedule(cancel), /უკვე დაწყებულია/u)
  await publishing.recordResult({ ...unknownResult(a), recordedAt: now as never })
  assert.equal((await f.store.listSchedules(scope)).find(s => s.schedule.id === a.scheduleId)!.delivery!.state, "unknown")
  await assert.rejects(f.store.changeSchedule({ ...cancel, action: "reschedule", timeContext: later, publishAt: "2030-01-08T08:00:00.000Z" }), /უკვე დაწყებულია/u)
  const b = proposed(due.find(s => s.schedule.id === schedules[1]!.schedule.id)!)
  await publishing.claimAttempt(b)
  await publishing.recordResult({ ...unknownResult(b), status: "published", providerPublicationRef: "published", publishedAt: now, recordedAt: now } as never)
  assert.equal((await f.store.listSchedules(scope)).find(s => s.schedule.id === b.scheduleId)!.delivery!.state, "published")
  await assert.rejects(f.store.changeSchedule({ ...cancel, scheduleId: b.scheduleId }), /უკვე დაწყებულია/u)
})
test("rescheduling invalidates a selected old queue item before an attempt is acquired", async t => {
  const { pool } = await socialDeliveryFixture(t), f = await twoPosts(pool), first = (await f.save())[0]!
  const due = (await f.store.claimDue(now, 3)).find(s => s.schedule.id === first.schedule.id)!
  await f.store.changeSchedule({ ...scope, scheduleId: first.schedule.id, operationId: "op:moved", expectedRevision: 0, action: "reschedule", timeContext: later, publishAt: "2030-01-08T08:00:00.000Z", now })
  await assert.rejects(new PostgresSocialPublishStore(pool).claimAttempt(proposed(due)), /Schedule changed/i)
  assert.equal((await pool.query("SELECT count(*)::int n FROM social_publish_attempts")).rows[0].n, 0)
})

test("known retryable failure remains visible and cannot be mislabeled a cancelled publication", async t => {
  const { pool } = await socialDeliveryFixture(t), f = await twoPosts(pool)
  await f.save()
  const due = (await f.store.claimDue(now, 3))[0]!, a = proposed(due), publishing = new PostgresSocialPublishStore(pool)
  await publishing.claimAttempt(a)
  await publishing.recordResult({ ...unknownResult(a), status: "retryableFailure", errorCode: "temporaryFailure", recordedAt: now } as never)
  const row = (await f.store.listSchedules(scope)).find(s => s.schedule.id === a.scheduleId)!
  assert.equal(row.delivery!.state, "failed")
  assert.equal(row.lifecycle.status, "scheduled")
  await assert.rejects(f.store.changeSchedule({ ...scope, scheduleId: a.scheduleId, operationId: "op:failed", expectedRevision: 0, action: "cancel", now }), /უკვე დაწყებულია/u)
})

test("the lower-level event API cannot accept forged lineage or a changed retry payload", async t => {
  const { pool } = await socialDeliveryFixture(t), f = await twoPosts(pool), first = (await f.save())[0]!
  const event = cancelSocialContentSchedule({ id: "op:canonical-event" as never, schedule: first.schedule, currentState: first.lifecycle,
    changedBy: "owner" as never, changedAt: createIsoDateTime(new Date().toISOString()) }).event
  await assert.rejects(f.store.appendScheduleEvent(scope, { ...event, draftId: "foreign" } as never), /არ ემთხვევა/u)
  assert.equal((await pool.query("SELECT count(*)::int n FROM social_content_schedule_events")).rows[0].n, 0)
  await f.store.appendScheduleEvent(scope, event)
  await f.store.appendScheduleEvent(scope, event)
  await assert.rejects(f.store.appendScheduleEvent(scope, { ...event, previousPublishAt: "2030-01-09T08:00:00.000Z" } as never), /არ ემთხვევა/u)
  assert.equal((await pool.query("SELECT count(*)::int n FROM social_content_schedule_events")).rows[0].n, 1)
})

test("historical later failures cannot hide a proven publication on an earlier attempt", async t => {
  const { pool } = await socialDeliveryFixture(t), f = await twoPosts(pool)
  await f.save()
  const due = (await f.store.claimDue(now, 3))[0]!, a = proposed(due), publishing = new PostgresSocialPublishStore(pool)
  await publishing.claimAttempt(a)
  await publishing.recordResult({ ...unknownResult(a), status: "published", providerPublicationRef: "confirmed-post", publishedAt: now, recordedAt: now } as never)
  // Model historical rows from a prior publisher; the current queue would not select a published intent again.
  const b = { ...a, id: "historical-later-attempt" as never, attemptNumber: 2 }
  await publishing.claimAttempt(b)
  await publishing.recordResult({ ...unknownResult(b), status: "retryableFailure", errorCode: "temporaryFailure", recordedAt: now } as never)
  const row = (await f.store.listSchedules(scope)).find(s => s.schedule.id === a.scheduleId)!
  assert.equal(row.delivery!.attemptCount, 2)
  assert.equal(row.delivery!.state, "published")
  await assert.rejects(f.store.changeSchedule({ ...scope, scheduleId: a.scheduleId, operationId: "op:historical", expectedRevision: 0, action: "cancel", now }), /უკვე დაწყებულია/u)
})
