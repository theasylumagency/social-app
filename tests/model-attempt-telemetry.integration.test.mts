import assert from "node:assert/strict"
import test from "node:test"
import { randomUUID } from "node:crypto"
import { readFile, readdir } from "node:fs/promises"
import { Pool } from "pg"
import { recordDiscoveryModelRun } from "../src/infrastructure/postgres/brand-discovery-store"
import { recordPlanningModelRun } from "../src/infrastructure/postgres/weekly-planning-store"
import { createBrandReasoner, type BrandModelRun } from "../src/infrastructure/models/brand-reasoning"
import { emptyDiscovery, type DiscoverySession } from "../src/blueprints/social/brand-discovery/model"

test("migration preserves legacy receipts and both flattened stores persist complete attempt telemetry", { skip: !process.env.DATABASE_URL }, async t => {
  const admin = new Pool({ connectionString: process.env.DATABASE_URL }), schema = `telemetry_test_${randomUUID().replaceAll("-", "")}`
  assert.match(schema, /^telemetry_test_[a-f0-9]{32}$/)
  await admin.query(`CREATE SCHEMA "${schema}"`)
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, options: `-c search_path=${schema}` })
  t.after(async () => { await pool.end(); await admin.query(`DROP SCHEMA "${schema}" CASCADE`); await admin.end() })
  const migrations = (await readdir(new URL("../db/migrations/", import.meta.url))).filter(file => file.endsWith(".sql")).sort()
  for (const file of migrations.filter(file => file < "0026")) await pool.query(await readFile(new URL(`../db/migrations/${file}`, import.meta.url), "utf8"))
  await pool.query('INSERT INTO auth_user(id,name,email,"emailVerified") VALUES(\'owner\',\'Owner\',\'owner@example.test\',true)')
  await pool.query("INSERT INTO brands(id,created_at) VALUES('brand',now())")
  const planningId = randomUUID(), discoveryId = randomUUID(), legacyId = randomUUID()
  await pool.query("INSERT INTO weekly_planning_runs(id,owner_user_id,brand_id,week_start,version,status,step,payload) VALUES($1,'owner','brand','2026-10-05',1,'ready','ready','{}')", [planningId])
  const session: DiscoverySession = { id: discoveryId, ownerId: "owner", brandId: "brand", revision: 1, status: "draft", step: "sources", error: null, leaseUntil: null, updatedAt: new Date().toISOString(), payload: emptyDiscovery({ website: "", notes: "", language: "ka" }) }
  await pool.query("INSERT INTO brand_discovery_sessions(id,owner_user_id,brand_id,payload) VALUES($1,'owner','brand',$2)", [discoveryId, session.payload])
  await pool.query("INSERT INTO weekly_planning_model_runs(id,run_id,step,prompt_version,model,input_hash,duration_ms,usage,validation_errors) VALUES($1,$2,'post_review','legacy','old-model','hash',1,'{}','[]')", [legacyId, planningId])
  await pool.query(await readFile(new URL("../db/migrations/0026_model_attempt_telemetry.sql", import.meta.url), "utf8"))
  assert.equal((await pool.query("SELECT telemetry FROM weekly_planning_model_runs WHERE id=$1", [legacyId])).rows[0].telemetry, null)
  let captured: BrandModelRun | undefined
  const reason = createBrandReasoner(async row => { captured = row; await recordPlanningModelRun(pool, planningId, row) }, {
    apiKey: "test", fetch: async () => new Response(JSON.stringify({ usage: { input_tokens: 10, output_tokens: 5 }, output: [{ content: [{ type: "output_text", text: '{"ok":true}' }] }] })) })
  await reason({ step: "post_review", version: "current", prompt: "Test", input: { message: "private" }, schema: { type: "object", additionalProperties: false, required: ["ok"], properties: { ok: { type: "boolean" } } } })
  assert.ok(captured?.telemetry)
  const stored = (await pool.query("SELECT telemetry,usage FROM weekly_planning_model_runs WHERE id=$1", [captured.id])).rows[0]
  assert.deepEqual(stored.telemetry, captured.telemetry); assert.deepEqual(stored.usage, captured.usage)
  const discoveryReceipt = { ...captured, id: randomUUID() }
  await recordDiscoveryModelRun(pool, session, discoveryReceipt)
  assert.deepEqual((await pool.query("SELECT telemetry FROM brand_discovery_model_runs WHERE id=$1", [discoveryReceipt.id])).rows[0].telemetry, captured.telemetry)
  const { telemetry: omitted, ...legacy } = captured
  void omitted
  await recordPlanningModelRun(pool, planningId, { ...legacy, id: randomUUID() })
})
