import { readdir, readFile, stat } from "node:fs/promises"
import { execFileSync } from "node:child_process"
import { Client } from "pg"

const root = new URL("../../", import.meta.url)
const files = (await readdir(new URL("db/migrations/", root))).filter((f) => f.endsWith(".sql")).sort()
console.log("Release feature: weekly cadence + content workspace (v2)")
try { console.log("Checkout:", execFileSync("git", ["rev-parse", "--short", "HEAD"], { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim()) } catch { console.log("Checkout: Git metadata unavailable") }
try {
  const build = await readFile(new URL(".next/BUILD_ID", root), "utf8")
  const info = await stat(new URL(".next/BUILD_ID", root))
  console.log("Production build:", build.trim(), "created", info.mtime.toISOString())
} catch { console.log("Production build: missing; run npm run build") }
if (!process.env.DATABASE_URL) throw Error("DATABASE_URL is required")
const client = new Client({ connectionString: process.env.DATABASE_URL })
await client.connect()
try {
  const table = await client.query("SELECT to_regclass('schema_migrations') AS name")
  const applied = table.rows[0].name ? (await client.query("SELECT name FROM schema_migrations ORDER BY name")).rows.map((r) => r.name) : []
  const pending = files.filter((f) => !applied.includes(f))
  console.log("Migration files:", files.length, "Latest:", files.at(-1))
  console.log("Pending migrations:", pending.length ? pending.join(", ") : "none")
  const tables = await client.query("SELECT to_regclass('weekly_planning_runs') AS planning, to_regclass('weekly_post_batches') AS posts")
  console.log("Weekly tables:", tables.rows[0].planning && tables.rows[0].posts ? "present" : "missing")
  if (tables.rows[0].posts) {
    const jobs = await client.query("SELECT p.status,p.step,count(*)::int AS jobs,min(p.updated_at) AS oldest_update FROM weekly_post_batches p JOIN weekly_planning_runs r ON r.id=p.run_id WHERE r.status IN ('ready','approved') GROUP BY p.status,p.step ORDER BY p.status,p.step")
    console.log("Post jobs (all accounts; counts only):", JSON.stringify(jobs.rows))
    console.log("Queued jobs or expired running jobs need worker:operator. This check does not prove that the worker or web process was restarted.")
  }
  if (pending.length) process.exitCode = 1
} finally { await client.end() }
