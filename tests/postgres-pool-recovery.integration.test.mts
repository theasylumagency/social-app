import assert from "node:assert/strict"
import test from "node:test"
import { Client } from "pg"
import { randomUUID } from "node:crypto"
import { createPostgresPool } from "../src/infrastructure/postgres/pool"
import { weeklyPostsDiagnostics } from "../src/application/evaluation/weekly-posts-diagnostics"

test("an idle connection terminated on the local database is replaced on the next query", { skip: !process.env.DATABASE_URL, timeout: 15000 }, async () => {
  const url = new URL(process.env.DATABASE_URL!)
  assert.ok(["localhost", "127.0.0.1", "[::1]"].includes(url.hostname), "Local database required")
  const admin = new Client({ connectionString: url.href, connectionTimeoutMillis: 3000 })
  let received!: (value: { code: string }) => void
  const failed = new Promise<{ code: string }>(resolve => { received = resolve })
  const pool = createPostgresPool({ connectionString: url.href, max: 1, onIdleError: received })
  try {
    await admin.connect()
    const before = (await pool.query("SELECT pg_backend_pid() AS pid")).rows[0].pid
    // Terminate only the idle connection created above, not the server or other work.
    assert.equal((await admin.query("SELECT pg_terminate_backend($1) AS stopped", [before])).rows[0].stopped, true)
    assert.deepEqual(await failed, { code: "57P01" })
    const after = (await pool.query("SELECT pg_backend_pid() AS pid,1 AS ok")).rows[0]
    assert.notEqual(after.pid, before); assert.equal(after.ok, 1)
  } finally { await pool.end(); await admin.end() }
})

test("real SQL diagnostics reads only one run's metadata from an isolated local schema", { skip: !process.env.DATABASE_URL, timeout: 15000 }, async () => {
  const url = new URL(process.env.DATABASE_URL!)
  assert.ok(["localhost", "127.0.0.1", "[::1]"].includes(url.hostname), "Local database required")
  const schema = `posts_diag_${randomUUID().replaceAll("-", "")}`, id = randomUUID(), other = randomUUID()
  const admin = new Client({ connectionString: url.href, connectionTimeoutMillis: 3000 })
  const client = new Client({ connectionString: url.href, options: `-c search_path=${schema}`, connectionTimeoutMillis: 3000 })
  await admin.connect()
  try {
    await admin.query(`CREATE SCHEMA "${schema}"`)
    await client.connect()
    await client.query("CREATE TABLE weekly_planning_runs(id uuid,week_start date,version int,status text,step text,updated_at timestamptz,payload jsonb)")
    await client.query("CREATE TABLE weekly_post_batches(run_id uuid,status text,step text,updated_at timestamptz,lease_until timestamptz,payload jsonb)")
    await client.query("CREATE TABLE weekly_planning_model_runs(id uuid,run_id uuid,created_at timestamptz,step text,prompt_version text,model text,duration_ms int,usage jsonb,validation_errors jsonb,telemetry jsonb)")
    await client.query("INSERT INTO weekly_planning_runs VALUES($1,'2026-10-05',1,'ready','ready',now(),$2)", [id, { directions: [{ private: "do-not-export" }], cadence: { facebook: 2, instagram: 1 }, publicKnowledge: {} }])
    await client.query("INSERT INTO weekly_post_batches VALUES($1,'failed','outline',now(),null,$2)", [id, { outline: null, copies: {}, private: "do-not-export" }])
    for (const runId of [id, other]) await client.query("INSERT INTO weekly_planning_model_runs VALUES($1,$2,now(),'post_schedule','test','test-model',10,$3,$4,$5)", [randomUUID(), runId, { input_tokens: 10, output_tokens: 2 }, JSON.stringify(["posts[0]: unknown direction"]), { reasoningEffort: "medium", outcome: "validation_failure", requestOrdinal: 1 }])
    const result = await weeklyPostsDiagnostics(client, id)
    assert.equal(result.telemetryAvailable, true); assert.equal(result.attempts.length, 1)
    assert.deepEqual(result.attempts[0].validation_errors, ["posts[0]: unknown direction"])
    assert.equal(result.attempts[0].reasoning_effort, "medium")
    assert.equal(result.posts.outline_post_count, 0); assert.equal(result.planning.direction_count, 1)
    assert.doesNotMatch(JSON.stringify(result), /do-not-export/)
    assert.equal((await client.query("SHOW transaction_read_only")).rows[0].transaction_read_only, "off")
  } finally {
    await client.end()
    await admin.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`)
    await admin.end()
  }
})
