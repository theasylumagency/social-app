import assert from "node:assert/strict"
import test from "node:test"
import { nearVerbatim, duplicateCopyIssues } from "../src/blueprints/social/weekly-planning/duplicate-hygiene"
import { recentEditorialWork } from "../src/blueprints/social/weekly-planning/sequence"
import { emptyPosts } from "../src/blueprints/social/weekly-planning/posts"
import { planningFixture } from "./weekly-planning-fixture"
import { copyFixture, scheduleFixture } from "./weekly-posts-fixture"

test("same strategic idea in different copy is allowed across weeks", () => {
  assert.equal(nearVerbatim("დაზიანების ფოტო საწყისი შეფასებისთვის გამოგვიგზავნეთ.", "პირველი ნაბიჯი ნივთის სურათით იწყება; საბოლოო შესაძლებლობას ადგილზე განვიხილავთ."), false)
})
test("exact and near-verbatim copy is caught, including unicode punctuation", () => {
  assert.ok(nearVerbatim("ფოტო — შეფასებისთვის!", "ფოტო შეფასებისთვის"))
  const text = Array.from({ length: 40 }, (_, i) => `word${i}`).join(" ")
  assert.ok(nearVerbatim(text, text.replace("word15", "changed")))
  assert.equal(nearVerbatim(text, "unrelated useful post"), false)
})
test("cross-channel variants of one post are allowed; separate duplicate posts are blocked", () => {
  const payload = { ...emptyPosts(), outline: scheduleFixture(), copies: { p1: copyFixture() } }
  assert.deepEqual(duplicateCopyIssues(payload), [])
  assert.deepEqual(duplicateCopyIssues({ ...payload, copies: { ...payload.copies, p2: copyFixture() } }).map((i) => i.postKey), ["p2"])
})
test("legacy title-only history stays readable and does not imply publication", async () => {
  const run = await planningFixture()
  run.payload.priorWeeks = [{ week: "2026-08-31", objective: "old", directions: ["ძველი მიმართულება"], experiment: null }]
  const history = recentEditorialWork(run.payload, run.week)
  assert.equal(history[0]?.status, "unknown")
  assert.equal(history[0]?.job, "ძველი მიმართულება")
})
