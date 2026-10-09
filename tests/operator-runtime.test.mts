import assert from "node:assert/strict"
import test from "node:test"
import { runWorkerQueue, runWorkerTicks, workerInteger } from "../src/worker/operator-runtime"

function deferred() { let resolve!: () => void; const promise = new Promise<void>(done => { resolve = done }); return { promise, resolve } }

test("a free slot starts the next job while a slow sibling remains active; shutdown drains work", async () => {
  const controller = new AbortController(), slow = deferred(), third = deferred()
  const jobs = ["slow", "fast", "next"], started: string[] = [], excluded: string[][] = []
  const loop = runWorkerQueue<string>({ name: "ai", concurrency: 2, key: job => job,
    select: async (limit, active) => { excluded.push([...active]); return jobs.splice(0, limit) },
    run: async job => { started.push(job); if (job === "slow") await slow.promise; if (job === "next") third.resolve() },
  }, { signal: controller.signal, intervalMs: 60_000 })
  await third.promise
  assert.deepEqual(started, ["slow", "fast", "next"])
  assert.ok(excluded.some(keys => keys.includes("slow")))
  controller.abort()
  let drained = false; void loop.then(() => { drained = true })
  await Promise.resolve(); assert.equal(drained, false)
  slow.resolve(); await loop; assert.equal(drained, true)
})

test("delivery ticks run independently of a blocked AI queue and abort stops future selection", async () => {
  const controller = new AbortController(), slow = deferred(), entered = deferred(), delivered = deferred()
  let selections = 0
  const ai = runWorkerQueue<string>({ name: "ai", concurrency: 1, key: job => job, select: async () => { selections++; return ["job"] },
    run: async () => { entered.resolve(); await slow.promise },
  }, { signal: controller.signal })
  await entered.promise
  await runWorkerTicks("delivery", async () => { delivered.resolve() }, { signal: controller.signal, once: true })
  await delivered.promise; controller.abort(); slow.resolve(); await ai
  assert.equal(selections, 1)
})

test("failed jobs release slots, duplicate active IDs cannot run twice, and once is bounded", async () => {
  const failures: string[] = [], started: string[] = []
  await runWorkerQueue<string>({ name: "once", concurrency: 2, select: async () => ["same", "same", "extra"], key: job => job,
    run: async job => { started.push(job); throw Error("controlled") },
  }, { signal: new AbortController().signal, once: true, onError: name => { failures.push(name) } })
  assert.deepEqual(started, ["same"]); assert.deepEqual(failures, ["once"])
  assert.equal(workerInteger(undefined, 2, 8), 2)
  for (const value of ["0", "9", "1.5", "bad"]) assert.throws(() => workerInteger(value, 2, 8))
})
