type Status = { revision: string; working: boolean }
type Options = {
  status(signal: AbortSignal): Promise<Status>
  refresh(signal: AbortSignal): Promise<void>
  visible(): boolean
  onError(): void
  delay?(working: boolean): number
}

/** One request chain for polling, visibility and note changes; disposal rejects stale results. */
export function startPlanningPolling(options: Options) {
  const controller = new AbortController()
  let timer: ReturnType<typeof setTimeout> | undefined
  let pending = false
  let forced = false
  let revision: string | null = null
  let working = false
  const schedule = () => {
    clearTimeout(timer)
    if (!controller.signal.aborted && options.visible()) timer = setTimeout(() => { void poll() }, options.delay?.(working) ?? (working ? 3500 : 15000))
  }
  async function poll() {
    clearTimeout(timer)
    if (controller.signal.aborted || !options.visible() || pending) return
    pending = true
    const force = forced
    forced = false
    try {
      const latest = await options.status(controller.signal)
      if (controller.signal.aborted) return
      working = latest.working
      if (force || latest.revision !== revision) {
        await options.refresh(controller.signal)
        if (!controller.signal.aborted) revision = latest.revision
      }
    } catch { if (!controller.signal.aborted) options.onError() }
    finally {
      pending = false
      if (forced && !controller.signal.aborted && options.visible()) void poll()
      else schedule()
    }
  }
  const refresh = () => { forced = true; void poll() }
  const visibilityChanged = () => {
    clearTimeout(timer)
    if (options.visible()) void poll()
  }
  void poll()
  return { refresh, visibilityChanged, stop() { controller.abort(); clearTimeout(timer) } }
}
