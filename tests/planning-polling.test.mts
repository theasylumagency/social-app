import assert from "node:assert/strict"
import test from "node:test"
import { startPlanningPolling } from "../src/app/workspace/planning-polling"

const settle = async () => { for (let i = 0; i < 12; i++) await Promise.resolve() }

test("polling reads full data only on revision changes and pauses while hidden", async t => {
  t.mock.timers.enable({ apis: ["setTimeout"] })
  let revision = "a", visible = true, reads = 0, full = 0
  const polling = startPlanningPolling({ status: async () => { reads++; return { revision, working: false } }, refresh: async () => { full++ }, visible: () => visible, onError: () => assert.fail(), delay: () => 10 })
  t.after(() => polling.stop())
  await settle()
  assert.equal(full, 1)
  t.mock.timers.tick(10); await settle()
  assert.equal(reads, 2); assert.equal(full, 1)
  revision = "new-media"
  t.mock.timers.tick(10); await settle()
  assert.equal(full, 2)
  visible = false; polling.visibilityChanged()
  t.mock.timers.tick(100); await settle()
  assert.equal(reads, 3)
  visible = true; polling.visibilityChanged(); await settle()
  assert.equal(reads, 4); assert.equal(full, 2)
  polling.refresh(); await settle()
  assert.equal(full, 3)
})

test("one in-flight chain survives duplicate triggers, stops scheduling when hidden, and aborts on disposal", async t => {
  t.mock.timers.enable({ apis: ["setTimeout"] })
  let resolve!: (value: { revision: string; working: boolean }) => void
  let signal!: AbortSignal
  let reads = 0, full = 0, visible = true
  const polling = startPlanningPolling({ status: async s => { signal = s; reads++; return new Promise(r => { resolve = r }) }, refresh: async () => { full++ }, visible: () => visible, onError: () => assert.fail(), delay: () => 10 })
  t.after(() => polling.stop())
  polling.refresh(); polling.refresh()
  assert.equal(reads, 1)
  visible = false; polling.visibilityChanged()
  resolve({ revision: "a", working: true }); await settle()
  t.mock.timers.tick(100); await settle()
  assert.equal(reads, 1)
  visible = true; polling.visibilityChanged()
  assert.equal(reads, 2)
  polling.stop()
  assert.equal(signal.aborted, true)
  resolve({ revision: "b", working: false }); await settle()
  t.mock.timers.tick(100); await settle()
  assert.equal(full, 1); assert.equal(reads, 2)
})
