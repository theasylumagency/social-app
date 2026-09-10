import { currentWeeklyOperation } from "../src/infrastructure/postgres/weekly-operation-access"
import { runSocialStrategy } from "../src/worker/social-strategy"
import { Pool } from "pg"
import { setTimeout } from "node:timers/promises"
import { runWeeklyPlanning } from "../src/worker/weekly-planning"
import { runWeeklyPosts } from "../src/worker/weekly-posts"
import { runVisualGenerationTick } from "../src/worker/visuals"
import { runBrandDiscovery } from "../src/worker/brand-discovery"
import { runSocialPublishingTick } from "../src/worker/social-publishing"
import { runSocialWebhookTick } from "../src/worker/social-webhooks"
import { runSocialAnalyticsTick } from "../src/worker/social-analytics"
import { readZernioEnvironment } from "../src/infrastructure/zernio/environment"

// Run continuously under the host's process manager. Leases allow multiple replicas.
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required")
const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const socialEnvironment = readZernioEnvironment()
let stopping = false
process.once("SIGTERM", () => { stopping = true })
process.once("SIGINT", () => { stopping = true })
try {
  do {
    const pending = await pool.query<{ id: string; owner_user_id: string }>(`SELECT s.id,s.owner_user_id FROM brand_discovery_sessions s JOIN auth_user u ON u.id=s.owner_user_id WHERE u."emailVerified"=true AND EXISTS(SELECT 1 FROM workspaces w JOIN workspace_subscriptions sub ON sub.workspace_id=w.id WHERE w.owner_user_id=u.id AND sub.paid_at<=now() AND sub.expires_at>now()) AND (s.status='queued' OR (s.status='running' AND s.lease_until<now())) ORDER BY s.updated_at LIMIT 2`)
    const weekly = await pool.query<{ id: string; owner_user_id: string }>(`SELECT r.id,r.owner_user_id FROM weekly_planning_runs r JOIN auth_user u ON u.id=r.owner_user_id WHERE ${currentWeeklyOperation} AND u."emailVerified"=true AND EXISTS(SELECT 1 FROM workspaces w JOIN workspace_subscriptions sub ON sub.workspace_id=w.id WHERE w.owner_user_id=u.id AND sub.paid_at<=now() AND sub.expires_at>now()) AND (r.status='queued' OR (r.status='running' AND r.lease_until<now())) ORDER BY r.updated_at LIMIT 2`)
    const posts = await pool.query<{ id: string; owner_user_id: string }>(`SELECT r.id,r.owner_user_id FROM weekly_post_batches p JOIN weekly_planning_runs r ON r.id=p.run_id JOIN auth_user u ON u.id=r.owner_user_id WHERE ${currentWeeklyOperation} AND u."emailVerified"=true AND EXISTS(SELECT 1 FROM workspaces w JOIN workspace_subscriptions sub ON sub.workspace_id=w.id WHERE w.owner_user_id=u.id AND sub.paid_at<=now() AND sub.expires_at>now()) AND r.status IN ('ready','approved') AND NOT EXISTS(SELECT 1 FROM weekly_planning_runs n WHERE n.brand_id=r.brand_id AND n.week_start=r.week_start AND n.version>r.version) AND (p.status='queued' OR (p.status='running' AND p.lease_until<now())) ORDER BY p.updated_at LIMIT 2`)
    const strategies = await pool.query<{ id: string; owner_user_id: string }>(`SELECT s.id,s.owner_user_id FROM social_strategies s JOIN auth_user u ON u.id=s.owner_user_id WHERE u."emailVerified"=true AND EXISTS(SELECT 1 FROM workspaces w JOIN workspace_subscriptions sub ON sub.workspace_id=w.id WHERE w.owner_user_id=u.id AND sub.paid_at<=now() AND sub.expires_at>now()) AND (s.status='queued' OR (s.status='running' AND s.lease_until<now())) ORDER BY s.updated_at LIMIT 2`)
    const results = await Promise.allSettled([...strategies.rows.map((job) => runSocialStrategy(pool, job.owner_user_id, job.id)), ...pending.rows.map((job) => runBrandDiscovery(pool, job.owner_user_id, job.id)), ...weekly.rows.map((job) => runWeeklyPlanning(pool, job.owner_user_id, job.id)), ...posts.rows.map((job) => runWeeklyPosts(pool, job.owner_user_id, job.id)), runVisualGenerationTick(pool), runSocialPublishingTick(pool, socialEnvironment), (async () => { await runSocialWebhookTick(pool, socialEnvironment, async () => {
      if (!socialEnvironment.analyticsEnabled) throw new Error("Social analytics is disabled")
      await runSocialAnalyticsTick(pool, socialEnvironment, true)
    }); return runSocialAnalyticsTick(pool, socialEnvironment) })()])
    for (const result of results) if (result.status === "rejected") console.error("Operator worker failed", { error: result.reason instanceof Error ? result.reason.name : "unknown" })
    if (process.argv.includes("--once")) break
    if (!stopping) await setTimeout(3000)
  } while (!stopping)
} finally { await pool.end() }
