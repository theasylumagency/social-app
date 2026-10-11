import assert from "node:assert/strict"
import test from "node:test"
import type { PoolClient } from "pg"
import { weeklyPostsDiagnostics } from "../src/application/evaluation/weekly-posts-diagnostics"

const id = "c7979442-689f-46ac-aee8-9794dd03aa53"
function client(receipts: unknown[] = [], failReceipts = false, telemetry = true) {
  const calls: { sql: string; parameters: unknown[] | undefined }[] = []
  const value = { query: async (sql: string, parameters?: unknown[]) => {
    calls.push({ sql, parameters })
    if (sql === "SHOW transaction_read_only") return { rows: [{ transaction_read_only: "on" }], rowCount: 1 }
    if (sql.includes("information_schema.columns")) return { rows: [], rowCount: telemetry ? 1 : 0 }
    if (sql.includes("FROM weekly_planning_model_runs")) {
      if (failReceipts) throw Error("controlled query failure")
      return { rows: receipts, rowCount: receipts.length }
    }
    return { rows: [], rowCount: 0 }
  } } as unknown as Pick<PoolClient, "query">
  return { value, calls }
}

test("diagnostics is read-only, limited to the supplied run and excludes raw content", async () => {
  const fake = client(Array.from({ length: 21 }, (_, i) => ({ model: "test", request_ordinal: i + 1 })))
  const result = await weeklyPostsDiagnostics(fake.value, id)
  assert.equal(result.readOnly, true); assert.equal(result.providerRequests, 0)
  assert.equal(result.attempts.length, 20); assert.equal(result.attemptsTruncated, true)
  assert.equal(fake.calls[0]!.sql, "BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY")
  assert.equal(fake.calls.at(-1)!.sql, "ROLLBACK")
  for (const call of fake.calls.filter(c => /FROM weekly_(planning_runs|post_batches|planning_model_runs)/.test(c.sql))) assert.deepEqual(call.parameters, [id])
  const receiptQuery = fake.calls.find(c => c.sql.includes("FROM weekly_planning_model_runs"))!.sql
  assert.match(receiptQuery, /LIMIT 21/); assert.match(receiptQuery, /LIMIT 12/)
  assert.doesNotMatch(receiptQuery, /SELECT \*|instructions|input_hash|prompt_text|output_text/i)
})

test("diagnostics rolls back failed reads and rejects invalid IDs before any access", async () => {
  const fake = client([], true)
  await assert.rejects(() => weeklyPostsDiagnostics(fake.value, id), /controlled query failure/)
  assert.equal(fake.calls.at(-1)!.sql, "ROLLBACK")
  const invalid = client()
  await assert.rejects(() => weeklyPostsDiagnostics(invalid.value, "invalid' OR 1=1"), /VALID_RUN_ID_REQUIRED/)
  assert.equal(invalid.calls.length, 0)
  const legacy = client([], false, false)
  assert.equal((await weeklyPostsDiagnostics(legacy.value, id)).telemetryAvailable, false)
})
