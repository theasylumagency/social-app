import assert from "node:assert/strict"
import test from "node:test"
import { weeklyApprovalFixture } from "./weekly-approval-fixture"
import { scheduleRows, scheduleMutable, scheduleStatus, replacementInputs, type SavedSchedule } from "../src/app/workspace/social-schedule-model"
const saved = (changes: Partial<SavedSchedule> = {}): SavedSchedule => ({ publicationInputId: "old", supersededByInputId: null, approvalId: "approval", postKey: "p1",
  publishingAccountId: "account", schedule: { id: "s", channel: "facebook", publishAt: "2030-01-01T12:00:00Z", draftVersion: 1 }, lifecycle: { status: "scheduled", revision: 0 }, ...changes })
test("incomplete posts stay visible with their concrete blockers", () => {
  const { posts } = weeklyApprovalFixture()
  assert.equal(scheduleRows(posts, [], true)[0]?.reasons.length, 0)
  posts.payload.outline!.posts.push({ ...posts.payload.outline!.posts[0]!, format: "image", visual: { kind: "photo", aspectRatio: "1:1", description: "Photo", frames: ["Photo"] } })
  const rows = scheduleRows(posts, [], true)
  assert.equal(rows.length, 2)
  assert.match(rows[1]!.reasons.join(" "), /ტექსტი მოსამზადებელია/u)
  assert.match(rows[1]!.reasons.join(" "), /ვიზუალი მოსამზადებელია/u)
  assert.match(scheduleRows(posts, [], false)[0]!.reasons.join(" "), /დასამტკიცებელია/u)
})
test("replacement consent includes only explicitly selected post/channel pairs", () => {
  const schedules = [saved(), saved({ publicationInputId: "p2", postKey: "p2" }), saved({ publicationInputId: "superseded", supersededByInputId: "new" })]
  assert.deepEqual(replacementInputs(schedules, "new", [{ postKey: "p1", channel: "facebook" }]), ["old"])
  assert.deepEqual(replacementInputs(schedules, "approval", [{ postKey: "p1", channel: "facebook" }]), [])
})
test("delivery evidence takes precedence over a historical cancelled label and locks changes", () => {
  for (const state of ["inProgress", "published", "unknown", "failed"] as const) {
    const item = saved({ delivery: { state, attemptCount: 1 } })
    assert.equal(scheduleMutable(item), false)
  }
  assert.equal(scheduleMutable(saved()), true)
  assert.equal(scheduleMutable(saved({ lifecycle: { status: "cancelled", revision: 1 } })), false)
  assert.equal(scheduleStatus(saved({ lifecycle: { status: "cancelled", revision: 1 }, delivery: { state: "published", attemptCount: 1 } })), "გამოქვეყნებულია")
  assert.equal(scheduleStatus(saved({ lifecycle: { status: "cancelled", revision: 1 }, delivery: { state: "unknown", attemptCount: 1 } })), "შედეგი ჯერ უცნობია")
})
