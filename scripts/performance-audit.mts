import { createHash } from "node:crypto"
import { writeFile } from "node:fs/promises"
import { relative } from "node:path"
import { Client } from "pg"
import { summarizeAttempts, type AttemptMetric } from "../src/application/evaluation/performance-report"
import type { ModelAttemptTelemetry } from "../src/infrastructure/models/attempt-telemetry"
import { evaluationReportPath } from "./evaluation-report-path.mjs"

const database = process.env.DATABASE_URL ? new URL(process.env.DATABASE_URL) : null
if (!database || !["localhost", "127.0.0.1", "[::1]"].includes(database.hostname)) throw Error("LOCAL_DATABASE_REQUIRED")
const out = evaluationReportPath("docs/plans/2026-10-09-performance-baseline.json")
const taskRelative = relative(process.cwd(), out)
const fingerprint = (value: string) => createHash("sha256").update(value).digest("hex")
const client = new Client({ connectionString: process.env.DATABASE_URL })
await client.connect()
try {
  await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY")
  await client.query("SET LOCAL statement_timeout='10s'")
  const readOnly = (await client.query("SHOW transaction_read_only")).rows[0].transaction_read_only
  if (readOnly !== "on") throw Error("READ_ONLY_REQUIRED")
  const tables = [
    { table: "brand_discovery_model_runs", workflow: "discovery", parent: "session_id", flattened: true },
    { table: "weekly_planning_model_runs", workflow: "weekly", parent: "run_id", flattened: true },
    { table: "social_strategy_model_runs", workflow: "strategy", parent: "strategy_id", flattened: false },
    { table: "contextual_note_model_runs", workflow: "notes", parent: "note_id", flattened: false },
    { table: "post_revision_model_runs", workflow: "revision", parent: "revision_id", flattened: false },
  ]
  const receipts: AttemptMetric[] = [], collection = []
  for (const source of tables) {
    const exists = (await client.query("SELECT to_regclass($1) AS name", [source.table])).rows[0].name
    if (!exists) { collection.push({ workflow: source.workflow, available: false, selected: 0, truncated: false }); continue }
    const hasTelemetry = (await client.query("SELECT 1 FROM information_schema.columns WHERE table_schema=current_schema() AND table_name=$1 AND column_name='telemetry'", [source.table])).rowCount === 1
    // Only identifiers from the static list above enter SQL. Neither prompts nor generated text are read.
    const columns = source.flattened ? `id,${source.parent} AS parent,step,prompt_version,model,input_hash,duration_ms,usage,validation_errors,${hasTelemetry ? "telemetry" : "NULL::jsonb AS telemetry"}` : `id,${source.parent} AS parent,payload`
    const result = await client.query(`SELECT ${columns} FROM ${source.table} ORDER BY created_at DESC,id DESC LIMIT 1001`)
    const selected = result.rows.slice(0, 1000)
    let excludedMock = 0
    for (const row of selected) {
      const data = source.flattened ? { step: row.step, promptVersion: row.prompt_version, model: row.model, durationMs: row.duration_ms, usage: row.usage, validationErrors: row.validation_errors, telemetry: row.telemetry } : row.payload
      if (/^(mock|fixture|test)(?:$|[-_:])/iu.test(data.model)) { excludedMock++; continue }
      receipts.push({ id: fingerprint(`${source.table}:${row.id}`), workflow: source.workflow, workflowId: fingerprint(`${source.workflow}:${row.parent}`),
        step: data.step, promptVersion: data.promptVersion, model: data.model, durationMs: data.durationMs, usage: data.usage,
        validationErrors: data.validationErrors, telemetry: (data.telemetry ?? null) as ModelAttemptTelemetry | null })
    }
    collection.push({ workflow: source.workflow, available: true, selected: selected.length, excludedMock, truncated: result.rows.length > 1000 })
  }
  const report = { version: 1, capturedAt: new Date().toISOString(), source: "bounded-local-read-only-snapshot", readOnly: true,
    receiptSetHash: fingerprint(JSON.stringify(receipts)), collection, groups: summarizeAttempts(receipts),
    currentPipelineQualityMeasured: false, productionModelChanged: false, databaseWritten: false }
  await client.query("ROLLBACK")
  await writeFile(out, JSON.stringify(report, null, 2) + "\n", { flag: "wx" })
  console.log(JSON.stringify({ report: taskRelative, receipts: receipts.length, groups: report.groups.length, collection, readOnly: true }))
} finally { await client.end() }
