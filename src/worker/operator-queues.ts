import type { Pool } from "pg"
import { currentWeeklyOperation } from "../infrastructure/postgres/weekly-operation-access"
import { runBrandDiscovery } from "./brand-discovery"
import { runSocialStrategy } from "./social-strategy"
import { runWeeklyPlanning } from "./weekly-planning"
import { runWeeklyPosts } from "./weekly-posts"
import type { WorkerQueue } from "./operator-runtime"

import { runContextualNote } from "./contextual-notes"

import { runPostRevision } from "./post-revisions"

type Job = { id: string; owner_user_id: string }
const authorized = `u."emailVerified"=true AND EXISTS(SELECT 1 FROM workspaces w JOIN workspace_subscriptions sub ON sub.workspace_id=w.id WHERE w.owner_user_id=u.id AND sub.paid_at<=now() AND sub.expires_at>now())`

export function operatorQueues(pool: Pool, concurrency: number): WorkerQueue<Job>[] {
  const definitions = [
    { name: "post-revisions", from: "post_revisions r", pending: "(r.status='queued' OR (r.status='running' AND r.lease_until<now()))", time: "r.updated_at", run: runPostRevision },
    { name: "notes", from: "contextual_notes r", pending: "(r.job_state='queued' OR (r.job_state='running' AND r.lease_until<now()))", time: "r.updated_at", run: runContextualNote },
    { name: "discovery", from: "brand_discovery_sessions r", pending: "(r.status='queued' OR (r.status='running' AND r.lease_until<now()))", time: "r.updated_at", run: runBrandDiscovery },
    { name: "strategy", from: "social_strategies r", pending: "(r.status='queued' OR (r.status='running' AND r.lease_until<now()))", time: "r.updated_at", run: runSocialStrategy },
    { name: "planning", from: "weekly_planning_runs r", pending: `${currentWeeklyOperation} AND (r.status='queued' OR (r.status='running' AND r.lease_until<now()))`, time: "r.updated_at", run: runWeeklyPlanning },
    { name: "posts", from: "weekly_post_batches p JOIN weekly_planning_runs r ON r.id=p.run_id", pending: `${currentWeeklyOperation} AND r.status IN ('ready','approved') AND NOT EXISTS(SELECT 1 FROM weekly_planning_runs n WHERE n.brand_id=r.brand_id AND n.week_start=r.week_start AND n.version>r.version) AND (p.status='queued' OR (p.status='running' AND p.lease_until<now()))`, time: "p.updated_at", run: runWeeklyPosts },
  ]
  return definitions.map(definition => ({ name: definition.name, concurrency, key: job => job.id,
    select: async (limit, activeKeys) => (await pool.query<Job>(`SELECT r.id,r.owner_user_id FROM ${definition.from} JOIN auth_user u ON u.id=r.owner_user_id
      WHERE ${authorized} AND ${definition.pending} AND r.id::text <> ALL($2::text[])
      ORDER BY ROW_NUMBER() OVER (PARTITION BY COALESCE(r.brand_id::text,r.id::text) ORDER BY ${definition.time},r.id),${definition.time},r.id LIMIT $1`, [limit, activeKeys])).rows,
    run: job => definition.run(pool, job.owner_user_id, job.id),
  }))
}
