import assert from "node:assert/strict"
import test from "node:test"
import { validateExecutionCapabilities } from "../src/blueprints/social/weekly-planning/execution-capabilities"
import { scheduleFixture } from "./weekly-posts-fixture"

test("a new weekly plan must use completable media formats on each channel", () => {
  const schedule = scheduleFixture()
  assert.deepEqual(validateExecutionCapabilities(schedule), [])
  schedule.posts[0]!.format = "reel"
  assert.ok(validateExecutionCapabilities(schedule).length)
  schedule.posts[0]!.format = "text"
  schedule.posts[0]!.channels = [{ channel: "instagram", reason: "Fixture" }]
  assert.ok(validateExecutionCapabilities(schedule).length)
  schedule.posts[0]!.channels = [{ channel: "facebook", reason: "Fixture" }]
  assert.deepEqual(validateExecutionCapabilities(schedule), [])
})
