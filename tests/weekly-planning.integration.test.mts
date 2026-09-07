import assert from "node:assert/strict"
import test from "node:test"
import { randomUUID } from "node:crypto"
import { readdir, readFile } from "node:fs/promises"
import { Pool } from "pg"
import { ensurePersonalWorkspace } from "../src/infrastructure/postgres/workspace-store"
import { saveDiscoveryDraft, startDiscovery, claimDiscovery, finishDiscoveryStep, confirmDiscovery } from "../src/infrastructure/postgres/brand-discovery-store"
import { readPlanningRun, readPlanningView, beginWeeklyPlanning, claimPlanningRun, finishPlanningStep, failPlanningStep, retryPlanningRun, approvePlanningRun } from "../src/infrastructure/postgres/weekly-planning-store"
import { readWeeklyBrief } from "../src/infrastructure/postgres/dashboard-store"
import { advanceWeeklyPlanning } from "../src/application/weekly-planning/advance"
import { completePlanningFixture, discoveryFixture, planningReasoner } from "./weekly-planning-fixture"

test("weekly planning is owner-scoped, durable, revisioned, foundation-bound and atomically approved", { skip: !process.env.DATABASE_URL }, async (t) => {
  const admin = new Pool({ connectionString: process.env.DATABASE_URL })
  const schema = `planning_test_${randomUUID().replaceAll("-", "")}`
  assert.match(schema, /^planning_test_[a-f0-9]{32}$/)
  await admin.query(`CREATE SCHEMA "${schema}"`)
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, options: `-c search_path=${schema}` })
  t.after(async () => { await pool.end(); await admin.query(`DROP SCHEMA "${schema}" CASCADE`); await admin.end() })
  for (const file of (await readdir(new URL("../db/migrations/", import.meta.url))).filter((f) => f.endsWith(".sql")).sort()) await pool.query(await readFile(new URL(`../db/migrations/${file}`, import.meta.url), "utf8"))
  for (const id of ["owner", "other"]) { await pool.query('INSERT INTO auth_user(id,name,email,"emailVerified") VALUES($1,$1,$2,true)', [id, `${id}@example.test`]); await ensurePersonalWorkspace(pool, id) }
  const discovery = await discoveryFixture()
  await saveDiscoveryDraft(pool, "owner", discovery.id, discovery.payload.input, null)
  await startDiscovery(pool, "owner", discovery.id, 1, discovery.payload.input)
  const d = (await claimDiscovery(pool, "owner", discovery.id))!
  await finishDiscoveryStep(pool, d.session, d.token, discovery.payload, "ready")
  const brandId = await confirmDiscovery(pool, "owner", discovery.id, 1, [discovery.payload.goals[0]!.id], "ka")
  const originalBrand = (await pool.query("SELECT payload FROM brand_dossiers WHERE brand_id=$1", [brandId])).rows[0].payload
  const input = { id: randomUUID(), brandId, week: "2026-09-07", priority: "" }
  await assert.rejects(() => beginWeeklyPlanning(pool, "other", input))
  await assert.rejects(() => beginWeeklyPlanning(pool, "owner", { ...input, week: "2026-09-08" }))
  const [first, duplicate] = await Promise.all([beginWeeklyPlanning(pool, "owner", input), beginWeeklyPlanning(pool, "owner", { ...input, id: randomUUID() })])
  assert.equal(first.id, duplicate.id)
  assert.equal(await readPlanningRun(pool, "other", first.id), null)
  assert.equal((await readPlanningView(pool, "other", brandId, input.week)).run, null)
  assert.equal(await readWeeklyBrief(pool, "owner", brandId, input.week), null)
  const claims = await Promise.all([claimPlanningRun(pool, "owner", first.id), claimPlanningRun(pool, "owner", first.id)])
  assert.equal(claims.filter(Boolean).length, 1)
  const one = claims.find(Boolean)!
  const objective = await advanceWeeklyPlanning(one.run, planningReasoner())
  await finishPlanningStep(pool, one.run, one.token, objective.payload, objective.step)
  const failure = (await claimPlanningRun(pool, "owner", first.id))!
  await failPlanningStep(pool, failure.run, failure.token, "Test outage")
  await retryPlanningRun(pool, "owner", first.id, 1)
  const recovered = (await claimPlanningRun(pool, "owner", first.id))!
  assert.equal(recovered.run.step, "focus")
  assert.deepEqual(recovered.run.payload.objective, objective.payload.objective)
  assert.equal(await finishPlanningStep(pool, failure.run, failure.token, failure.run.payload, "focus"), false)
  const ready = await completePlanningFixture(recovered.run)
  await finishPlanningStep(pool, recovered.run, recovered.token, ready.payload, "ready")
  await assert.rejects(() => approvePlanningRun(pool, "other", first.id, 1))
  await assert.rejects(() => approvePlanningRun(pool, "owner", first.id, 2))
  await Promise.all([approvePlanningRun(pool, "owner", first.id, 1), approvePlanningRun(pool, "owner", first.id, 1)])
  assert.equal((await readPlanningView(pool, "owner", brandId, input.week)).approved?.id, first.id)
  assert.equal((await pool.query("SELECT count(*)::int n FROM weekly_planning_events WHERE run_id=$1 AND kind='approved'", [first.id])).rows[0].n, 1)
  assert.deepEqual((await pool.query("SELECT payload FROM brand_dossiers WHERE brand_id=$1", [brandId])).rows[0].payload, originalBrand)

  const revision = await beginWeeklyPlanning(pool, "owner", { ...input, id: randomUUID(), parentId: first.id, parentVersion: 1, revisionNote: "ჯერ მხოლოდ ფოტოების შეფასების შესაძლებლობა ავხსნათ", priority: "დაზიანების ფოტოების მომზადება" })
  assert.equal(revision.version, 2)
  assert.equal(revision.payload.previousVersion?.objective, ready.payload.objective!.objective)
  assert.match(revision.payload.revisionNote, /ფოტოების/)
  assert.equal((await readPlanningView(pool, "owner", brandId, input.week)).approved?.id, first.id)
  assert.equal((await readWeeklyBrief(pool, "owner", brandId, input.week))?.objective, revision.payload.priority)
  await assert.rejects(() => beginWeeklyPlanning(pool, "owner", { ...input, id: randomUUID(), parentId: first.id, parentVersion: 1, revisionNote: "Obsolete revision from another tab" }))
  const two = (await claimPlanningRun(pool, "owner", revision.id))!
  const ready2 = await completePlanningFixture(two.run)
  ready2.payload.review!.concerns = [{ severity: "blocking", message: "Test contradictory priority", directionKeys: ["d1"] }]
  await finishPlanningStep(pool, two.run, two.token, ready2.payload, "ready")
  await assert.rejects(() => approvePlanningRun(pool, "owner", revision.id, 2))
  ready2.payload.review!.concerns = []
  await pool.query("UPDATE weekly_planning_runs SET payload=$2::jsonb WHERE id=$1", [revision.id, JSON.stringify(ready2.payload)])
  // A forced failure during the new approval must also roll back superseding the old one.
  await pool.query("CREATE FUNCTION reject_test_approval() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.status='approved' THEN RAISE EXCEPTION 'test approval failure'; END IF; RETURN NEW; END $$")
  await pool.query("CREATE TRIGGER test_approval_failure BEFORE UPDATE ON weekly_planning_runs FOR EACH ROW EXECUTE FUNCTION reject_test_approval()")
  await assert.rejects(() => approvePlanningRun(pool, "owner", revision.id, 2))
  assert.equal((await readPlanningRun(pool, "owner", first.id))?.status, "approved")
  assert.equal((await readPlanningRun(pool, "owner", revision.id))?.status, "ready")
  await pool.query("DROP TRIGGER test_approval_failure ON weekly_planning_runs")
  await approvePlanningRun(pool, "owner", revision.id, 2)
  assert.equal((await readPlanningRun(pool, "owner", first.id))?.payload.plan?.state, "superseded")
  assert.equal((await readPlanningView(pool, "owner", brandId, input.week)).approved?.id, revision.id)
  const following = await beginWeeklyPlanning(pool, "owner", { ...input, id: randomUUID(), week: "2026-09-14" })
  assert.equal(following.payload.priorWeeks[0]?.objective, ready2.payload.objective?.objective)
  const three = (await claimPlanningRun(pool, "owner", following.id))!
  const ready3 = await completePlanningFixture(three.run)
  await finishPlanningStep(pool, three.run, three.token, ready3.payload, "ready")
  // Simulate a new confirmed foundation version, leaving the run's captured basis untouched.
  await pool.query("UPDATE brand_dossiers SET revision=revision+1 WHERE brand_id=$1", [brandId])
  assert.equal((await readPlanningView(pool, "owner", brandId, "2026-09-14")).stale, true)
  await assert.rejects(() => approvePlanningRun(pool, "owner", following.id, 1))
  assert.equal((await readPlanningRun(pool, "owner", following.id))?.payload.basis.revision, 1)
})
