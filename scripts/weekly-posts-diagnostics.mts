import { createPostgresPool, postgresFailure } from "../src/infrastructure/postgres/pool"
import { postModelConfiguration } from "../src/infrastructure/models/runtime-policy"
import { weeklyPostsDiagnostics } from "../src/application/evaluation/weekly-posts-diagnostics"

const [runId, ...extra] = process.argv.slice(2)
if (!runId || extra.length || !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(runId)) throw Error("USE_EXACT_WEEKLY_RUN_ID")
const cliPostConfiguration = postModelConfiguration()
const pool = createPostgresPool({ connectionString: process.env.DATABASE_URL, max: 1 })
try {
  const client = await pool.connect()
  try { console.log(JSON.stringify({ ...await weeklyPostsDiagnostics(client, runId), cliPostConfiguration }, null, 2)) }
  finally { client.release() }
} catch (error) {
  console.error("Weekly posts diagnostics failed", postgresFailure(error))
  process.exitCode = 1
} finally { await pool.end() }
