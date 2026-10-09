export type WorkerEvent = { queue: string; key?: string; phase: "started" | "finished" | "failed"; durationMs?: number; active?: number }
export type WorkerQueue<T> = {
  name: string
  concurrency: number
  select: (limit: number, activeKeys: readonly string[]) => Promise<readonly T[]>
  key: (job: T) => string
  run: (job: T) => Promise<unknown>
}
type RuntimeOptions = { signal: AbortSignal; intervalMs?: number; once?: boolean; onError?: (queue: string, error: unknown) => void; onEvent?: (event: WorkerEvent) => void }

/** Each queue refills its own free slots; neither another queue nor a slow sibling is awaited. */
export async function runWorkerQueue<T>(queue: WorkerQueue<T>, options: RuntimeOptions) {
  if (!Number.isSafeInteger(queue.concurrency) || queue.concurrency < 1) throw Error("Invalid worker concurrency")
  const active = new Map<string, Promise<void>>()
  let wake: (() => void) | undefined
  const emit = (event: WorkerEvent) => { try { options.onEvent?.(event) } catch { /* Telemetry cannot fail work. */ } }
  const report = (error: unknown) => { try { options.onError?.(queue.name, error) } catch { /* Error sinks cannot fail the loop. */ } }
  try {
    while (!options.signal.aborted) {
      const capacity = queue.concurrency - active.size
      if (capacity > 0) {
        try {
          const jobs = await queue.select(capacity, [...active.keys()])
          for (const job of jobs.slice(0, capacity)) {
            if (options.signal.aborted) break
            const key = queue.key(job)
            if (active.has(key)) continue
            const started = Date.now()
            const work = Promise.resolve().then(async () => {
              emit({ queue: queue.name, key, phase: "started", active: active.size })
              await queue.run(job)
              emit({ queue: queue.name, key, phase: "finished", durationMs: Date.now() - started })
            }).catch(error => {
              emit({ queue: queue.name, key, phase: "failed", durationMs: Date.now() - started })
              report(error)
            }).finally(() => { active.delete(key); wake?.() })
            active.set(key, work)
          }
        } catch (error) { report(error) }
      }
      if (options.once) break
      await new Promise<void>(resolve => {
        const done = () => { clearTimeout(timer); options.signal.removeEventListener("abort", done); wake = undefined; resolve() }
        const timer = setTimeout(done, options.intervalMs ?? 3000)
        wake = done
        options.signal.addEventListener("abort", done, { once: true })
        if (options.signal.aborted) done()
      })
    }
  } finally {
    // Stop selecting first, then finish already claimed work before the pool is closed.
    await Promise.allSettled([...active.values()])
  }
}

/** Tick loops never overlap their own work and have independent polling/error budgets. */
export async function runWorkerTicks(name: string, tick: () => Promise<unknown>, options: RuntimeOptions) {
  const report = (error: unknown) => { try { options.onError?.(name, error) } catch { /* Error sinks cannot stop a tick loop. */ } }
  do {
    if (options.signal.aborted) return
    const started = Date.now()
    try {
      await tick()
      try { options.onEvent?.({ queue: name, phase: "finished", durationMs: Date.now() - started }) } catch { /* Telemetry cannot fail work. */ }
    } catch (error) { report(error) }
    if (options.once || options.signal.aborted) return
    await new Promise<void>(resolve => {
      const done = () => { clearTimeout(timer); options.signal.removeEventListener("abort", done); resolve() }
      const timer = setTimeout(done, options.intervalMs ?? 3000)
      options.signal.addEventListener("abort", done, { once: true })
      if (options.signal.aborted) done()
    })
  } while (!options.signal.aborted)
}

export function workerInteger(value: string | undefined, fallback: number, maximum: number) {
  if (!value?.trim()) return fallback
  const parsed = Number(value)
  if (!Number.isSafeInteger(parsed) || parsed < 1 || parsed > maximum) throw Error("Invalid operator worker configuration")
  return parsed
}
