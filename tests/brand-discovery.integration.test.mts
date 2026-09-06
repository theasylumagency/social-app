import assert from "node:assert/strict"
import test from "node:test"
import { randomUUID } from "node:crypto"
import { readFile, readdir } from "node:fs/promises"
import { Pool } from "pg"
import { ensurePersonalWorkspace } from "../src/infrastructure/postgres/workspace-store"
import { saveDiscoveryDraft, startDiscovery, readDiscovery, claimDiscovery, finishDiscoveryStep, failDiscoveryStep, retryDiscovery, reviseDiscovery, confirmDiscovery, readBrandDossier } from "../src/infrastructure/postgres/brand-discovery-store"
import { listDashboardBrands, listDashboardSources } from "../src/infrastructure/postgres/dashboard-store"
import { createBrandOnboarding } from "../src/application/onboarding/create-brand"
import { PostgresIngestionStore } from "../src/infrastructure/postgres/ingestion-store"
import { completeFixture, note } from "./brand-discovery-fixture"
import type { BrandModelCall } from "../src/infrastructure/models/brand-reasoning"

test("discovery persists recovery, independent feedback, ownership and atomic existing-brand confirmation", { skip: !process.env.DATABASE_URL }, async (t) => {
  const admin = new Pool({ connectionString: process.env.DATABASE_URL })
  const schema = `discovery_test_${randomUUID().replaceAll("-", "")}`
  assert.match(schema, /^discovery_test_[a-f0-9]{32}$/)
  await admin.query(`CREATE SCHEMA "${schema}"`)
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, options: `-c search_path=${schema}` })
  t.after(async () => { await pool.end(); await admin.query(`DROP SCHEMA "${schema}" CASCADE`); await admin.end() })
  for (const file of (await readdir(new URL("../db/migrations/", import.meta.url))).filter((f) => f.endsWith(".sql")).sort()) await pool.query(await readFile(new URL(`../db/migrations/${file}`, import.meta.url), "utf8"))
  for (const id of ["owner", "other"]) await pool.query('INSERT INTO auth_user(id,name,email,"emailVerified") VALUES($1,$1,$2,true)', [id, `${id}@example.test`])
  const access = await ensurePersonalWorkspace(pool, "owner")
  await ensurePersonalWorkspace(pool, "other")
  const existing = await createBrandOnboarding({ businessName: "Old Workshop", services: ["bags", "shoes", "and accessories"], language: "ka", avoidTopics: ["Old restriction"] }, new PostgresIngestionStore(pool, access))
  const before = (await listDashboardBrands(pool, "owner"))[0]!
  const input = { website: "", notes: note, language: "ka" as const }
  const id = randomUUID()
  const draft = await saveDiscoveryDraft(pool, "owner", id, input, existing.brandId)
  assert.equal((await saveDiscoveryDraft(pool, "owner", randomUUID(), input, existing.brandId)).id, id)
  assert.equal(await readDiscovery(pool, "other", id), null)
  await assert.rejects(() => startDiscovery(pool, "other", id, 1, input))
  await startDiscovery(pool, "owner", id, draft.revision, input)
  const claims = await Promise.all([claimDiscovery(pool, "owner", id), claimDiscovery(pool, "owner", id)])
  assert.equal(claims.filter(Boolean).length, 1)
  const first = claims.find(Boolean)!
  const ready = await completeFixture(first.session)
  await failDiscoveryStep(pool, first.session, first.token, "Temporary failure")
  await retryDiscovery(pool, "owner", id, 1)
  const second = (await claimDiscovery(pool, "owner", id))!
  assert.equal(await finishDiscoveryStep(pool, first.session, first.token, ready.payload, "ready"), false)
  assert.equal(await finishDiscoveryStep(pool, second.session, second.token, ready.payload, "ready"), true)
  const originalHypothesis = ready.payload.hypotheses[0]!
  await reviseDiscovery(pool, "owner", id, 1, { kind: "audience", stances: [{ audienceHypothesisId: originalHypothesis.id, stance: "disagree", note: "ჩვენთან სარესტავრაციო სტუდიებიც მოდიან" }], founderAudiences: [{ name: "სარესტავრაციო სტუდიები", description: "სტუდიას სჭირდება ძველი ტყავის ნივთის დეტალური სამუშაოს პარტნიორი" }] })
  await assert.rejects(() => confirmDiscovery(pool, "owner", id, 1, ready.payload.goals.map((g) => g.id), "ka"))
  const revised = (await readDiscovery(pool, "owner", id))!
  assert.equal(revised.revision, 2)
  assert.equal(revised.step, "profiles")
  assert.deepEqual(revised.payload.hypotheses[0], originalHypothesis)
  assert.equal(revised.payload.envelope, null)
  const modelCalls: BrandModelCall[] = []
  const ready2 = await completeFixture(revised, modelCalls)
  assert.deepEqual(modelCalls.map((c) => c.step), ["profiles", "envelope", "goals"])
  assert.equal(ready2.payload.landscape?.entries[0]?.influence, "limited")
  assert.equal(ready2.payload.landscape?.entries[1]?.influence, "strong")
  assert.equal(ready2.payload.profiles.length, 2)
  assert.equal(ready2.payload.envelope?.landscapeVersion, 2)
  assert.match(JSON.stringify(modelCalls[1]?.input), /ჩვენთან სარესტავრაციო/)
  const lastClaim = (await claimDiscovery(pool, "owner", id))!
  await finishDiscoveryStep(pool, lastClaim.session, lastClaim.token, ready2.payload, "ready")
  assert.deepEqual((await listDashboardBrands(pool, "owner"))[0], before)
  const goals = [ready2.payload.goals[0]!.id]
  await assert.rejects(() => confirmDiscovery(pool, "other", id, 2, goals, "ka"))
  await assert.rejects(() => confirmDiscovery(pool, "owner", id, 2, ["invented-goal"], "ka"))
  const results = await Promise.all([confirmDiscovery(pool, "owner", id, 2, goals, "ka"), confirmDiscovery(pool, "owner", id, 2, goals, "ka")])
  assert.deepEqual(results, [existing.brandId, existing.brandId])
  const brands = await listDashboardBrands(pool, "owner")
  assert.equal(brands.length, 1)
  assert.equal(brands[0]!.createdAt, before.createdAt)
  assert.deepEqual(brands[0]!.knowledge.offerPrimaryServices, ["Leather bags, shoes, and accessories repair"])
  assert.equal((await pool.query("SELECT count(*)::int n FROM brand_dossiers")).rows[0].n, 1)
  const dossier = (await readBrandDossier(pool, "owner", existing.brandId))!
  assert.deepEqual(dossier.payload.feedback.selectedGoalIds, goals)
  assert.deepEqual(dossier.payload.hypotheses[0], originalHypothesis)
  assert.equal(await readBrandDossier(pool, "other", existing.brandId), null)
  const evidence = await pool.query("SELECT e.excerpt, ss.captured_at FROM evidence e JOIN source_snapshots ss ON ss.id=e.snapshot_id WHERE e.id=$1", [originalHypothesis.evidenceIds[0]])
  assert.equal(evidence.rowCount, 1)
  assert.equal(evidence.rows[0].captured_at.toISOString(), "2026-09-06T10:00:00.000Z")
  assert.ok((await listDashboardSources(pool, "owner", existing.brandId)).length >= 3)
  assert.equal((await pool.query("SELECT count(*)::int n FROM knowledge_claims WHERE brand_id=$1 AND path='constraints.sensitiveTopics' AND lifecycle='active'", [existing.brandId])).rows[0].n, 0)
  assert.equal((await readDiscovery(pool, "owner", id))?.status, "confirmed")
})
