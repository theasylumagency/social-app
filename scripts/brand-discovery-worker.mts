import { Pool } from "pg"
import { setTimeout } from "node:timers/promises"
import { runWeeklyPlanning } from "../src/worker/weekly-planning"
import { runWeeklyPosts } from "../src/worker/weekly-posts"
import { runBrandDiscovery } from "../src/worker/brand-discovery"

// Run continuously under the host's process manager. Leases allow multiple replicas.
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required")
const pool = new Pool({ connectionString: process.env.DATABASE_URL })
let stopping = false
process.once("SIGTERM", () => { stopping = true })
process.once("SIGINT", () => { stopping = true })
try {
  do {
    const pending = await pool.query<{ id: string; owner_user_id: string }>(`SELECT s.id,s.owner_user_id FROM brand_discovery_sessions s JOIN auth_user u ON u.id=s.owner_user_id WHERE u."emailVerified"=true AND (s.status='queued' OR (s.status='running' AND s.lease_until<now())) ORDER BY s.updated_at LIMIT 2`)
    const weekly = await pool.query<{ id: string; owner_user_id: string }>(`SELECT r.id,r.owner_user_id FROM weekly_planning_runs r JOIN auth_user u ON u.id=r.owner_user_id WHERE u."emailVerified"=true AND (r.status='queued' OR (r.status='running' AND r.lease_until<now())) ORDER BY r.updated_at LIMIT 2`)
    const posts = await pool.query<{ id: string; owner_user_id: string }>(`SELECT r.id,r.owner_user_id FROM weekly_post_batches p JOIN weekly_planning_runs r ON r.id=p.run_id JOIN auth_user u ON u.id=r.owner_user_id WHERE u."emailVerified"=true AND r.status IN ('ready','approved') AND (p.status='queued' OR (p.status='running' AND p.lease_until<now())) ORDER BY p.updated_at LIMIT 2`)
    const results = await Promise.allSettled([...pending.rows.map((job) => runBrandDiscovery(pool, job.owner_user_id, job.id, 300_000)), ...weekly.rows.map((job) => runWeeklyPlanning(pool, job.owner_user_id, job.id, 300_000)), ...posts.rows.map((job) => runWeeklyPosts(pool, job.owner_user_id, job.id, 300_000))])
    for (const result of results) if (result.status === "rejected") console.error("Operator worker failed", { error: result.reason instanceof Error ? result.reason.name : "unknown" })
    if (process.argv.includes("--once")) break
    if (!stopping) await setTimeout(3000)
  } while (!stopping)
} finally { await pool.end() }
