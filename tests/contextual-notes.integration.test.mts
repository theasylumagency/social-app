import assert from "node:assert/strict"
import test from "node:test"
import { randomUUID } from "node:crypto"
import { readFile, readdir } from "node:fs/promises"
import { Pool } from "pg"
import { subscribeFixture, strategicBrandFixture } from "./strategic-integration-fixture"
import { ensurePersonalWorkspace } from "../src/infrastructure/postgres/workspace-store"
import { beginWeeklyPlanning, claimPlanningRun, finishPlanningStep, readPlanningView } from "../src/infrastructure/postgres/weekly-planning-store"
import { completePlanningFixture } from "./weekly-planning-fixture"
import { copyFixture, scheduleFixture } from "./weekly-posts-fixture"
import { currentWeek } from "../src/application/dashboard/model"
import { applyNote, listNotes, resolveNote, submitNote } from "../src/infrastructure/postgres/contextual-notes-store"
import { readBrandDossier } from "../src/infrastructure/postgres/brand-discovery-store"
import { type Interpretation, type NoteContext } from "../src/application/contextual-notes/model"
import type { BrandReasoner } from "../src/infrastructure/models/brand-reasoning"
import { emptyPosts } from "../src/blueprints/social/weekly-planning/posts"

test("notes persist with tenant isolation, idempotent execution, review, conflict checks and rollback", { skip: !process.env.DATABASE_URL }, async t => {
  const admin = new Pool({ connectionString: process.env.DATABASE_URL })
  const schema = `notes_test_${randomUUID().replaceAll("-", "")}`
  await admin.query(`CREATE SCHEMA "${schema}"`)
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, options: `-c search_path=${schema}` })
  t.after(async () => { await pool.end(); await admin.query(`DROP SCHEMA "${schema}" CASCADE`); await admin.end() })
  for (const file of (await readdir(new URL("../db/migrations/", import.meta.url))).filter(f => f.endsWith(".sql")).sort()) await pool.query(await readFile(new URL(`../db/migrations/${file}`, import.meta.url), "utf8"))
  for (const id of ["owner", "other"]) { await pool.query('INSERT INTO auth_user(id,name,email,"emailVerified") VALUES($1,$1,$2,true)', [id, `${id}@example.test`]); await ensurePersonalWorkspace(pool, id); await subscribeFixture(pool, id) }
  const brandId = await strategicBrandFixture(pool)
  const run = await beginWeeklyPlanning(pool, "owner", { id: randomUUID(), brandId, week: currentWeek(), priority: "" })
  const claim = (await claimPlanningRun(pool, "owner", run.id))!
  const ready = await completePlanningFixture(claim.run)
  await finishPlanningStep(pool, claim.run, claim.token, ready.payload, "ready")
  const payload = { ...emptyPosts(), outline: scheduleFixture(), copies: { p1: copyFixture(), p2: copyFixture(), p3: copyFixture() }, review: { summary: "შემოწმებულია", issues: [] } }
  await pool.query("UPDATE weekly_post_batches SET status='ready',step='ready',payload=$2::jsonb WHERE run_id=$1", [run.id, JSON.stringify(payload)])
  const context: NoteContext = { brandId, section: "content", week: currentWeek(), postKey: "p1", channel: "facebook", runId: run.id }
  const interpretation: Interpretation = { statements: [{ quote: "მოკლე.", meaning: "მხოლოდ ამ პოსტის ტექსტის შემოკლება", kind: "draft_correction", scope: "post", actionable: true }], response: "არჩეულ ტექსტს განვიხილავ.", clarification: "", action: "revise_post", instruction: "შეამოკლე მხოლოდ არჩეული პოსტის Facebook-ის ტექსტი.", ambiguous: false }
  const newCopy = copyFixture(); newCopy.variants[0]!.caption = "გამოგვიგზავნეთ დაზიანების ფოტო შეფასებისთვის."
  let calls = 0
  const reason: BrandReasoner = async <T,>(call: { step: string }) => { calls++; return (call.step === "contextual_notes" ? interpretation : newCopy) as T }
  const input = { id: randomUUID(), text: "მოკლე.", source: "text" as const, context }
  await assert.rejects(() => submitNote(pool, "other", input, reason))
  const applied = await submitNote(pool, "owner", input, reason)
  assert.equal(applied.status, "applied", applied.message)
  assert.equal(applied.canUndo, true)
  assert.equal((await submitNote(pool, "owner", input, reason)).id, applied.id)
  assert.equal(calls, 2, "duplicate submission never calls model again")
  await assert.rejects(() => applyNote(pool, "other", applied.id, true))
  await assert.rejects(() => listNotes(pool, "other", context))
  let posts = (await readPlanningView(pool, "owner", brandId, currentWeek())).posts!
  assert.equal(posts.step, "review")
  assert.equal(posts.status, "queued")
  assert.equal(posts.payload.copies.p1!.variants[0]!.caption, newCopy.variants[0]!.caption)
  assert.deepEqual(posts.payload.copies.p1!.variants[1], payload.copies.p1.variants[1], "other channel preserved")
  assert.deepEqual(posts.payload.copies.p2, payload.copies.p2, "other post preserved")
  assert.equal((await resolveNote(pool, "owner", applied.id, "undo")).status, "reverted")
  assert.equal((await resolveNote(pool, "owner", applied.id, "undo")).status, "reverted", "undo is idempotent")
  posts = (await readPlanningView(pool, "owner", brandId, currentWeek())).posts!
  assert.deepEqual(posts.payload.copies.p1, payload.copies.p1)
  await pool.query("UPDATE weekly_post_batches SET status='ready',step='ready' WHERE run_id=$1", [run.id])
  const second = await submitNote(pool, "owner", { ...input, id: randomUUID() }, reason)
  await pool.query("UPDATE weekly_post_batches SET payload=jsonb_set(payload,'{copies,p1,variants,0,caption}', '\"Later manual edit\"'::jsonb) WHERE run_id=$1", [run.id])
  await assert.rejects(() => resolveNote(pool, "owner", second.id, "undo"), /მოგვიანებით შეიცვალა/)

  const brandContext: NoteContext = { ...context, section: "brand", postKey: null, channel: null, runId: null }
  const before = await readBrandDossier(pool, "owner", brandId)
  const brandMeaning: Interpretation = { ...interpretation, action: "revise_brand", statements: [{ quote: "ახალი ოფისი გვაქვს.", meaning: "ახალი ოფისი", kind: "fact", scope: "brand", actionable: true }], instruction: "ბრენდს ახალი ოფისი აქვს თბილისში." }
  const brandReason: BrandReasoner = async <T,>() => brandMeaning as T
  const proposed = await submitNote(pool, "owner", { id: randomUUID(), text: "ახალი ოფისი გვაქვს.", source: "voice", context: brandContext }, brandReason)
  assert.equal(proposed.status, "proposed")
  await assert.rejects(() => applyNote(pool, "owner", proposed.id, false))
  const draft = await applyNote(pool, "owner", proposed.id, true)
  assert.equal(draft.status, "applied")
  assert.match(draft.targetUrl!, /^\/onboarding\?brand=/)
  assert.deepEqual(await readBrandDossier(pool, "owner", brandId), before, "preparing a draft never changes confirmed brand knowledge")
  assert.equal((await resolveNote(pool, "owner", draft.id, "undo")).status, "reverted")

  const weekMeaning: Interpretation = { ...interpretation, action: "revise_plan", instruction: "ამ კვირაში ვიდეოს გადაღება შეუძლებელია. თავიდან შეაფასე მიზნის მიღწევის სხვა გზები.", statements: [{ quote: "ამ კვირაში ვიდეოს ვერ გადავიღებთ.", meaning: "მხოლოდ ამ კვირის საწარმოო შეზღუდვა", kind: "constraint", scope: "week", actionable: true }] }
  const weekContext: NoteContext = { ...brandContext, section: "week" }
  const revision = await submitNote(pool, "owner", { id: randomUUID(), text: weekMeaning.statements[0]!.quote, source: "text", context: weekContext }, async <T,>() => weekMeaning as T)
  assert.equal(revision.status, "applied", revision.message)
  const next = await readPlanningView(pool, "owner", brandId, currentWeek())
  assert.equal(next.run!.version, run.version + 1)
  assert.equal(next.run!.payload.priority, run.payload.priority)
  assert.ok(next.history.some(h => h.id === run.id), "prior plan remains in history")
  assert.deepEqual(await readBrandDossier(pool, "owner", brandId), before, "temporary constraints never become brand knowledge")

  const noChange: Interpretation = { ...weekMeaning, action: "revise_plan", statements: [{ quote: "ჩემი ტრაქტარისგაყიდვა მინდა", meaning: "მიზანია ტრაქტორის გაყიდვა", kind: "objective_reminder", scope: "week", actionable: true }] }
  const answer = await submitNote(pool, "owner", { id: randomUUID(), text: noChange.statements[0]!.quote, source: "text", context: weekContext }, async <T,>() => noChange as T)
  assert.equal(answer.status, "answered")
  assert.equal((await readPlanningView(pool, "owner", brandId, currentWeek())).run!.id, next.run!.id)
  assert.equal((await listNotes(pool, "owner", weekContext)).length, 2)
  const ledger = (await pool.query("SELECT confirmed_at,snapshot,result FROM contextual_notes WHERE id=$1", [draft.id])).rows[0]
  assert.ok(ledger.confirmed_at && ledger.snapshot && ledger.result)
})
