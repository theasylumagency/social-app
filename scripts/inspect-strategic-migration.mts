import { Pool } from "pg"
const pool = new Pool({ connectionString: process.env.DATABASE_URL })
try {
  const counts = await pool.query(`SELECT (SELECT count(*)::int FROM brands) AS brands,
    (SELECT count(*)::int FROM brand_dossiers) AS dossiers,
    (SELECT count(*)::int FROM weekly_planning_runs) AS weekly_plans,
    (SELECT count(*)::int FROM weekly_planning_runs WHERE NOT(payload ? 'socialStrategy') AND status IN ('queued','running')) AS legacy_pending_plans,
    (SELECT count(*)::int FROM weekly_post_batches p JOIN weekly_planning_runs r ON r.id=p.run_id WHERE NOT(r.payload ? 'socialStrategy') AND p.status IN ('queued','running')) AS legacy_pending_posts,
    (SELECT count(*)::int FROM workspace_subscriptions) AS subscriptions,
    (SELECT count(*)::int FROM social_strategies) AS strategies`)
  console.log(JSON.stringify(counts.rows[0]))
} finally { await pool.end() }
