import { Pool } from "pg"
import { runVisualGenerationTick } from "../src/worker/visuals"
import { socialPublishingTasks } from "../src/worker/social-publishing"
import { runSocialWebhookTick } from "../src/worker/social-webhooks"
import { runSocialAnalyticsTick } from "../src/worker/social-analytics"
import { readZernioEnvironment } from "../src/infrastructure/zernio/environment"
import { operatorQueues } from "../src/worker/operator-queues"
import { runWorkerQueue, runWorkerTicks, workerInteger } from "../src/worker/operator-runtime"

// --role=ai|delivery|analytics isolates resources/processes; omitted runs all independent loops.
const role = process.argv.find(value => value.startsWith("--role="))?.slice(7) ?? "all"
if (!["all", "ai", "delivery", "analytics"].includes(role)) throw Error("Invalid operator worker role")
if (!process.env.DATABASE_URL) throw Error("DATABASE_URL is required")
const controller = new AbortController()
process.once("SIGTERM", () => controller.abort())
process.once("SIGINT", () => controller.abort())
const options = { signal: controller.signal, once: process.argv.includes("--once"),
  intervalMs: workerInteger(process.env.OPERATOR_POLL_INTERVAL_MS, 3000, 60_000),
  onError: (queue: string, error: unknown) => console.error("Operator worker failed", { queue, error: error instanceof Error ? error.name : "unknown" }) }
const concurrency = workerInteger(process.env.OPERATOR_QUEUE_CONCURRENCY, 2, 8)
const socialEnvironment = readZernioEnvironment()
const pools: Pool[] = []
const pool = (max: number) => {
  const value = new Pool({ connectionString: process.env.DATABASE_URL, max })
  pools.push(value)
  return value
}
const loops: Promise<unknown>[] = []
const ai = role === "all" || role === "ai"
const delivery = role === "all" || role === "delivery"
const analytics = role === "all" || role === "analytics"
try {
  if (ai) {
    const aiPool = pool(workerInteger(process.env.OPERATOR_AI_DATABASE_POOL_MAX, 10, 64))
    for (const queue of operatorQueues(aiPool, concurrency)) loops.push(runWorkerQueue(queue, { ...options,
      onEvent: event => console.info("Operator job", event) }))
    loops.push(runWorkerTicks("visuals", () => runVisualGenerationTick(aiPool), options))
  }
  // AI cannot exhaust delivery connections; analytics also has its own bounded pool.
  const analyticsPool = delivery || analytics ? pool(workerInteger(process.env.OPERATOR_ANALYTICS_DATABASE_POOL_MAX, 2, 16)) : null
  let analyticsFlight: ReturnType<typeof runSocialAnalyticsTick> | null = null
  const refreshAnalytics = async (triggered = false): ReturnType<typeof runSocialAnalyticsTick> => {
    if (analyticsFlight) {
      const result = await analyticsFlight
      if (triggered && result.status === "notDue") return refreshAnalytics(true)
      return result
    }
    const current = runSocialAnalyticsTick(analyticsPool!, socialEnvironment, triggered)
    analyticsFlight = current
    try { return await current } finally { if (analyticsFlight === current) analyticsFlight = null }
  }
  if (delivery) {
    const deliveryPool = pool(workerInteger(process.env.OPERATOR_DELIVERY_DATABASE_POOL_MAX, 4, 32))
    const tasks = socialPublishingTasks(deliveryPool, socialEnvironment)
    loops.push(runWorkerTicks("publishing", tasks.publish, options))
    loops.push(runWorkerTicks("publish-recovery", tasks.recover, options))
    loops.push(runWorkerTicks("publish-reconciliation", tasks.reconcile, options))
    loops.push(runWorkerTicks("webhooks", () => runSocialWebhookTick(deliveryPool, socialEnvironment, async () => {
      if (!socialEnvironment.analyticsEnabled) throw Error("Social analytics is disabled")
      await refreshAnalytics(true)
    }), options))
  }
  if (analytics) loops.push(runWorkerTicks("analytics", () => refreshAnalytics(), options))
  await Promise.all(loops)
} finally {
  controller.abort()
  await Promise.allSettled(loops)
  await Promise.allSettled(pools.map(value => value.end()))
}
