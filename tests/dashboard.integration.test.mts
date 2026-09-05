import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { readdir, readFile } from "node:fs/promises"
import test from "node:test"
import { Pool } from "pg"
import { ensurePersonalWorkspace } from "../src/infrastructure/postgres/workspace-store"
import { PostgresIngestionStore } from "../src/infrastructure/postgres/ingestion-store"
import { createBrandOnboarding } from "../src/application/onboarding/create-brand"
import { listDashboardBrands, listDashboardSources, readWeeklyBrief, saveWeeklyBrief } from "../src/infrastructure/postgres/dashboard-store"

test("dashboard reads and brief writes remain isolated by owner, brand and week", { skip: !process.env.DATABASE_URL }, async (t) => {
  const admin = new Pool({ connectionString: process.env.DATABASE_URL })
  const schema = `dashboard_test_${randomUUID().replaceAll("-", "")}`
  assert.match(schema, /^dashboard_test_[a-f0-9]{32}$/)
  await admin.query(`CREATE SCHEMA "${schema}"`)
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, options: `-c search_path=${schema}` })
  t.after(async () => { await pool.end(); await admin.query(`DROP SCHEMA "${schema}" CASCADE`); await admin.end() })
  for (const file of (await readdir(new URL("../db/migrations/", import.meta.url))).filter((name) => name.endsWith(".sql")).sort()) {
    await pool.query(await readFile(new URL(`../db/migrations/${file}`, import.meta.url), "utf8"))
  }
  for (const id of ["owner", "other"]) await pool.query('INSERT INTO auth_user (id,name,email,"emailVerified") VALUES ($1,$1,$2,true)', [id, `${id}@example.test`])
  const access = await ensurePersonalWorkspace(pool, "owner")
  await ensurePersonalWorkspace(pool, "other")
  const store = new PostgresIngestionStore(pool, access)
  const first = await createBrandOnboarding({ businessName: "პირველი ბრენდი", language: "ka", services: ["კონსულტაცია"] }, store, {
    websiteCapture: { requestedUrl: "https://example.test", finalUrl: "https://example.test/", knowledge: { identityName: "წყაროს სახელი", offerPrimaryServices: ["კონსულტაცია"] } },
  })
  const second = await createBrandOnboarding({ businessName: "მეორე ბრენდი", language: "ka", services: ["დიზაინი"] }, store)
  const brands = await listDashboardBrands(pool, "owner")
  assert.equal(brands.length, 2)
  assert.equal(brands[0]?.name, "პირველი ბრენდი")
  assert.equal(brands[0]?.ready, true)
  assert.deepEqual(brands[0]?.knowledge.offerPrimaryServices, ["კონსულტაცია"])
  assert.deepEqual(await listDashboardBrands(pool, "other"), [])
  const sources = await listDashboardSources(pool, "owner", first.brandId)
  assert.equal(sources.length, 2)
  assert.equal(sources.find((source) => source.url)?.url, "https://example.test/")
  assert.ok(sources.every((source) => source.capturedAt))
  assert.deepEqual(await listDashboardSources(pool, "other", first.brandId), [])
  assert.equal(await saveWeeklyBrief(pool, "owner", first.brandId, "2026-08-31", "პირველი მიზანი"), true)
  assert.equal(await saveWeeklyBrief(pool, "other", first.brandId, "2026-08-31", "უცხო ცვლილება"), false)
  assert.equal((await readWeeklyBrief(pool, "owner", first.brandId, "2026-08-31"))?.objective, "პირველი მიზანი")
  assert.equal(await readWeeklyBrief(pool, "other", first.brandId, "2026-08-31"), null)
  assert.equal(await readWeeklyBrief(pool, "owner", second.brandId, "2026-08-31"), null)
  assert.equal(await readWeeklyBrief(pool, "owner", first.brandId, "2026-09-07"), null)
  assert.equal(await saveWeeklyBrief(pool, "owner", first.brandId, "2026-08-31", "განახლებული მიზანი"), true)
  assert.equal((await readWeeklyBrief(pool, "owner", first.brandId, "2026-08-31"))?.objective, "განახლებული მიზანი")
  assert.equal((await pool.query("SELECT count(*)::int AS count FROM weekly_briefs")).rows[0].count, 1)
  assert.deepEqual((await listDashboardBrands(pool, "owner"))[0]?.knowledge, brands[0]?.knowledge)
})
