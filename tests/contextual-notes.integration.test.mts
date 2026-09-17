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
import { targetHash, type Interpretation, type NoteContext } from "../src/application/contextual-notes/model"
import type { BrandReasoner } from "../src/infrastructure/models/brand-reasoning"
import { emptyPosts } from "../src/blueprints/social/weekly-planning/posts"
import { listChannelPolicies, listOperatingRules } from "../src/infrastructure/postgres/operating-policy-store"

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
  const postTargetData = { postKey: "p1", channel: "facebook", title: payload.outline!.posts[0]!.title }
  const context: NoteContext = { brandId, section: "content", week: currentWeek(), postKey: "p1", channel: "facebook", runId: run.id, postVersion: (await readPlanningView(pool, "owner", brandId, currentWeek())).posts!.updatedAt, target: { type: "post", id: "p1:facebook", label: payload.outline!.posts[0]!.title, version: (await readPlanningView(pool, "owner", brandId, currentWeek())).posts!.updatedAt, hash: targetHash(postTargetData), data: postTargetData } }
  const interpretation: Interpretation = { statements: [{ quote: "მოკლე.", meaning: "მხოლოდ ამ პოსტის ტექსტის შემოკლება", kind: "draft_correction", scope: "post", actionable: true }], response: "არჩეულ ტექსტს განვიხილავ.", clarification: "", action: "revise_post", instruction: "შეამოკლე მხოლოდ არჩეული პოსტის Facebook-ის ტექსტი.", ambiguous: false }
  const newCopy = copyFixture(); newCopy.variants[0]!.caption = "გამოგვიგზავნეთ დაზიანების ფოტო შეფასებისთვის."
  let calls = 0
  const reason: BrandReasoner = async <T,>(call: { step: string }) => { calls++; return (call.step === "contextual_notes" ? interpretation : newCopy) as T }
  const input = { id: randomUUID(), text: "მოკლე.", source: "text" as const, context }
  await assert.rejects(() => submitNote(pool, "other", input, reason))
  const forgedData = { ...postTargetData, title: "სერვერისგან განსხვავებული, თვითშეთანხმებული სათაური" }
  const forgedContext: NoteContext = { ...context, target: { ...context.target!, data: forgedData, hash: targetHash(forgedData) } }
  const forged = await submitNote(pool, "owner", { ...input, id: randomUUID(), context: forgedContext }, reason)
  assert.equal(forged.status, "failed")
  assert.match(forged.message, /არჩეული ობიექტი შეიცვალა/)
  assert.equal(calls, 0, "canonical stale-target rejection happens before model execution")
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
  context.postVersion = posts.updatedAt
  context.target!.version = posts.updatedAt
  await pool.query("UPDATE weekly_post_batches SET status='ready',step='ready' WHERE run_id=$1", [run.id])
  const second = await submitNote(pool, "owner", { ...input, id: randomUUID() }, reason)
  await pool.query("UPDATE weekly_post_batches SET payload=jsonb_set(payload,'{copies,p1,variants,0,caption}', '\"Later manual edit\"'::jsonb) WHERE run_id=$1", [run.id])
  await assert.rejects(() => resolveNote(pool, "owner", second.id, "undo"), /მოგვიანებით შეიცვალა/)

  const brandContext: NoteContext = { ...context, section: "brand", postKey: null, channel: null, runId: null, postVersion: null, target: null }
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
  assert.equal((await resolveNote(pool, "owner", revision.id, "undo")).status, "reverted")
  assert.equal((await readPlanningView(pool, "owner", brandId, currentWeek())).run!.id, run.id, "candidate-only plan revision restores prior version")

  const noChange: Interpretation = { ...weekMeaning, action: "revise_plan", statements: [{ quote: "ჩემი ტრაქტარისგაყიდვა მინდა", meaning: "მიზანია ტრაქტორის გაყიდვა", kind: "objective_reminder", scope: "week", actionable: true }] }
  const answer = await submitNote(pool, "owner", { id: randomUUID(), text: noChange.statements[0]!.quote, source: "text", context: weekContext }, async <T,>() => noChange as T)
  assert.equal(answer.status, "answered")
  assert.equal((await readPlanningView(pool, "owner", brandId, currentWeek())).run!.id, run.id)
  assert.equal((await listNotes(pool, "owner", weekContext)).length, 2)
  assert.equal((await pool.query("SELECT snapshot FROM contextual_notes WHERE id=$1", [answer.id])).rows[0].snapshot, null, "no-op note keeps no domain snapshot")

  const ruleMeaning: Interpretation = { ...interpretation, action: "set_operating_rule", instruction: "ამიერიდან ემოჯი საერთოდ არ გამოიყენოთ.", statements: [{ quote: "ამიერიდან ემოჯი საერთოდ არ გამოიყენოთ.", meaning: "მომავალ კონტენტში ემოჯის აკრძალვა", kind: "standing_rule", scope: "ongoing", actionable: true }] }
  const ruleProposal = await submitNote(pool, "owner", { id: randomUUID(), text: ruleMeaning.statements[0]!.quote, source: "text", context: weekContext }, async <T,>() => ruleMeaning as T)
  assert.equal(ruleProposal.status, "proposed")
  const activeRule = await applyNote(pool, "owner", ruleProposal.id, true)
  assert.equal((await listOperatingRules(pool, "owner", brandId)).length, 1)
  assert.equal(activeRule.canUndo, true)
  const exceptionMeaning: Interpretation = { ...ruleMeaning, instruction: "Instagram-ზე ერთი ემოჯი შეიძლება გამოვიყენოთ.", statements: [{ quote: "Instagram-ზე ერთი ემოჯი შეიძლება გამოვიყენოთ.", meaning: "Instagram-ზე ერთი ემოჯის დაშვება", kind: "standing_rule", scope: "ongoing", actionable: true }] }
  const exceptionProposal = await submitNote(pool, "owner", { id: randomUUID(), text: exceptionMeaning.statements[0]!.quote, source: "text", context: weekContext }, async <T,>() => exceptionMeaning as T)
  const exception = await applyNote(pool, "owner", exceptionProposal.id, true)
  const effective = await listOperatingRules(pool, "owner", brandId)
  assert.deepEqual(effective.filter(rule => rule.effect === "allow")[0]!.scope.channels.include, ["instagram"])
  assert.deepEqual(effective.filter(rule => rule.effect === "forbid")[0]!.scope.channels.exclude, ["instagram"], "specific exception narrows the global rule without leaving overlap")
  assert.equal((await listOperatingRules(pool, "owner", brandId, false)).length, 3, "superseded source and derived narrowed rule remain in history")
  await resolveNote(pool, "owner", exception.id, "undo")
  assert.equal((await listOperatingRules(pool, "owner", brandId))[0]!.effect, "forbid", "undo restores superseded rule")
  const advertisingMeaning: Interpretation = { ...ruleMeaning, instruction: "სარეკლამო კონტენტში ერთი ემოჯი შეიძლება გამოვიყენოთ.", statements: [{ quote: "სარეკლამო კონტენტში ერთი ემოჯი შეიძლება გამოვიყენოთ.", meaning: "სარეკლამო კონტენტში ერთი ემოჯის დაშვება", kind: "standing_rule", scope: "ongoing", actionable: true }] }
  const advertisingProposal = await submitNote(pool, "owner", { id: randomUUID(), text: advertisingMeaning.statements[0]!.quote, source: "text", context: weekContext }, async <T,>() => advertisingMeaning as T)
  const advertising = await applyNote(pool, "owner", advertisingProposal.id, true)
  const narrowed = await listOperatingRules(pool, "owner", brandId)
  assert.deepEqual(narrowed.find(rule => rule.effect === "allow")!.scope.contentTypes.include, ["advertising"])
  assert.deepEqual(narrowed.find(rule => rule.effect === "forbid")!.scope.contentTypes.exclude, ["advertising"])
  await resolveNote(pool, "owner", advertising.id, "undo")
  assert.equal((await listOperatingRules(pool, "owner", brandId))[0]!.scope.contentTypes.include, "all", "undo restores the prior broader content-type rule")
  await resolveNote(pool, "owner", activeRule.id, "undo")
  assert.equal((await listOperatingRules(pool, "owner", brandId)).length, 0)

  const channelMeaning: Interpretation = { ...interpretation, action: "set_channel_policy", instruction: "Instagram-ს აღარ ვიყენებთ.", statements: [{ quote: "Instagram-ს არ ვენდობი. მოდი ამოვიღოთ.", meaning: "Instagram ოპერაციულად გაითიშოს", kind: "channel_policy", scope: "channel", actionable: true }] }
  const channelProposal = await submitNote(pool, "owner", { id: randomUUID(), text: channelMeaning.statements[0]!.quote, source: "text", context: weekContext }, async <T,>() => channelMeaning as T)
  assert.equal(channelProposal.status, "proposed")
  const disabled = await applyNote(pool, "owner", channelProposal.id, true)
  assert.equal((await listChannelPolicies(pool, "owner", brandId)).find(policy => policy.channel === "instagram")!.active, false)
  assert.equal((await pool.query("SELECT count(*)::int n FROM social_provider_account_bindings")).rows[0].n, 0, "policy never creates/deletes provider bindings")
  await resolveNote(pool, "owner", disabled.id, "undo")
  assert.equal((await listChannelPolicies(pool, "owner", brandId)).find(policy => policy.channel === "instagram")!.active, true)
  const unsafeRevision = await submitNote(pool, "owner", { id: randomUUID(), text: weekMeaning.statements[0]!.quote, source: "text", context: weekContext }, async <T,>() => weekMeaning as T)
  const unsafeResult = (await pool.query<{ result: { targetId: string } }>("SELECT result FROM contextual_notes WHERE id=$1", [unsafeRevision.id])).rows[0]!.result
  await pool.query("UPDATE weekly_planning_runs SET status='ready',step='ready' WHERE id=$1", [unsafeResult.targetId])
  await pool.query("INSERT INTO weekly_post_batches(run_id,status,step,payload) VALUES($1,'ready','ready',$2::jsonb)", [unsafeResult.targetId, JSON.stringify({ ...emptyPosts(), outline: scheduleFixture(), copies: {} })])
  await assert.rejects(() => resolveNote(pool, "owner", unsafeRevision.id, "undo"), /შეიქმნა კონტენტი/)
  const ledger = (await pool.query("SELECT confirmed_at,snapshot,result FROM contextual_notes WHERE id=$1", [draft.id])).rows[0]
  assert.ok(ledger.confirmed_at && ledger.snapshot && ledger.result)
})
