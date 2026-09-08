import { subscribeFixture, strategicBrandFixture } from "./strategic-integration-fixture"
import { currentWeek, shiftWeek } from "../src/application/dashboard/model"
import { approveStrategy, proposeStrategy } from "../src/infrastructure/postgres/social-strategy-store"
import { strategyProposal } from "./social-strategy-fixture"
import assert from "node:assert/strict"
import test from "node:test"
import { randomUUID } from "node:crypto"
import { readdir, readFile } from "node:fs/promises"
import { Pool } from "pg"
import { ensurePersonalWorkspace } from "../src/infrastructure/postgres/workspace-store"
import { saveDiscoveryDraft, startDiscovery, claimDiscovery, finishDiscoveryStep, confirmDiscovery } from "../src/infrastructure/postgres/brand-discovery-store"
import { readPlanningRun, readPlanningView, beginWeeklyPlanning, claimPlanningRun, finishPlanningStep, failPlanningStep, retryPlanningRun, approvePlanningRun, changeWeeklyCadence } from "../src/infrastructure/postgres/weekly-planning-store"
import { readWeeklyBrief } from "../src/infrastructure/postgres/dashboard-store"
import { completePlanningFixture, discoveryFixture } from "./weekly-planning-fixture"
import { beginWeeklyPosts, claimWeeklyPosts, readWeeklyPosts, saveWeeklyPosts, savePostCopy, failWeeklyPosts, mutatePostAsset, readPostAsset, listPostAssets } from "../src/infrastructure/postgres/weekly-posts-store"
import { scheduleFixture, copyFixture, editorialFixture } from "./weekly-posts-fixture"
import sharp from "sharp"
import { repairWeeklyPosts } from "../src/infrastructure/postgres/weekly-posts-repair"
import { MODEL_CALL_MAX_MS, OPERATOR_LEASE_MS, MODEL_STAGE_RESERVE_MS } from "../src/infrastructure/models/runtime-policy"
import { runWeeklyPosts } from "../src/worker/weekly-posts"

test("weekly planning is owner-scoped, durable, revisioned, foundation-bound and atomically approved", { skip: !process.env.DATABASE_URL }, async (t) => {
  const admin = new Pool({ connectionString: process.env.DATABASE_URL })
  const schema = `planning_test_${randomUUID().replaceAll("-", "")}`
  assert.match(schema, /^planning_test_[a-f0-9]{32}$/)
  await admin.query(`CREATE SCHEMA "${schema}"`)
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, options: `-c search_path=${schema}` })
  t.after(async () => { await pool.end(); await admin.query(`DROP SCHEMA "${schema}" CASCADE`); await admin.end() })
  for (const file of (await readdir(new URL("../db/migrations/", import.meta.url))).filter((f) => f.endsWith(".sql")).sort()) await pool.query(await readFile(new URL(`../db/migrations/${file}`, import.meta.url), "utf8"))
  for (const id of ["owner", "other"]) { await pool.query('INSERT INTO auth_user(id,name,email,"emailVerified") VALUES($1,$1,$2,true)', [id, `${id}@example.test`]); await ensurePersonalWorkspace(pool, id) }
  await subscribeFixture(pool, "owner")
  const discovery = await discoveryFixture()
  await saveDiscoveryDraft(pool, "owner", discovery.id, discovery.payload.input, null)
  await startDiscovery(pool, "owner", discovery.id, 1, discovery.payload.input)
  const d = (await claimDiscovery(pool, "owner", discovery.id))!
  assert.ok(Date.parse(d.session.leaseUntil!) - Date.now() > MODEL_CALL_MAX_MS)
  await finishDiscoveryStep(pool, d.session, d.token, discovery.payload, "ready")
  const brandId = await confirmDiscovery(pool, "owner", discovery.id, 1, [], "ka")
  const strategy = await proposeStrategy(pool, "owner", { id: randomUUID(), brandId })
  strategy.payload.proposal = strategyProposal(); strategy.payload.sources = []
  await pool.query("UPDATE social_strategies SET status='proposed',payload=$2::jsonb WHERE id=$1", [strategy.id, JSON.stringify(strategy.payload)])
  await approveStrategy(pool, "owner", brandId, strategy.id, 1)
  const originalBrand = (await pool.query("SELECT payload FROM brand_dossiers WHERE brand_id=$1", [brandId])).rows[0].payload
  const input = { id: randomUUID(), brandId, week: currentWeek(), priority: "" }
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
  assert.ok(Date.parse(one.run.leaseUntil!) - Date.now() > MODEL_CALL_MAX_MS)
  await failPlanningStep(pool, one.run, one.token, "Test outage before model completion")
  await retryPlanningRun(pool, "owner", first.id, 1)
  const recovered = (await claimPlanningRun(pool, "owner", first.id))!
  assert.equal(recovered.run.step, "objective")
  assert.equal(await finishPlanningStep(pool, one.run, one.token, one.run.payload, "focus"), false)
  const ready = await completePlanningFixture(recovered.run)
  await finishPlanningStep(pool, recovered.run, recovered.token, ready.payload, "ready")
  await assert.rejects(() => approvePlanningRun(pool, "owner", first.id, 1), /პოსტების/)
  assert.equal((await readWeeklyPosts(pool, "owner", first.id))?.step, "outline")
  assert.equal(await readWeeklyPosts(pool, "other", first.id), null)
  await assert.rejects(() => beginWeeklyPosts(pool, "other", first.id, 1))
  const postClaims = await Promise.all([claimWeeklyPosts(pool, "owner", first.id), claimWeeklyPosts(pool, "owner", first.id)])
  assert.equal(postClaims.filter(Boolean).length, 1)
  const pc = postClaims.find(Boolean)!
  assert.ok(Date.parse(pc.batch.leaseUntil!) - Date.now() > MODEL_CALL_MAX_MS)
  // Simulate the end of the longest legitimate call; a second worker still cannot claim it.
  await pool.query("UPDATE weekly_post_batches SET lease_until=now()+($2 * interval '1 millisecond') WHERE run_id=$1", [first.id, OPERATOR_LEASE_MS - MODEL_CALL_MAX_MS])
  assert.equal(await claimWeeklyPosts(pool, "owner", first.id), null)
  const postPayload = { ...pc.batch.payload, outline: scheduleFixture() }
  await saveWeeklyPosts(pool, first.id, pc.token, postPayload, "writing")
  const wc = (await claimWeeklyPosts(pool, "owner", first.id))!
  await Promise.all([savePostCopy(pool, first.id, wc.token, "p1", copyFixture()), savePostCopy(pool, first.id, wc.token, "p2", copyFixture())])
  await failWeeklyPosts(pool, first.id, wc.token)
  await beginWeeklyPosts(pool, "owner", first.id, 1, true)
  assert.equal(Object.keys((await readWeeklyPosts(pool, "owner", first.id))!.payload.copies).length, 2)
  const resumed = (await claimWeeklyPosts(pool, "owner", first.id))!
  assert.equal(await savePostCopy(pool, first.id, wc.token, "p3", copyFixture()), false)
  const completePosts = { ...resumed.batch.payload, copies: { p1: copyFixture(), p2: copyFixture(), p3: copyFixture() }, review: { summary: "ტექსტები შემოწმებულია", issues: [] } }
  await saveWeeklyPosts(pool, first.id, resumed.token, { ...completePosts, review: { summary: "მეორე პოსტში მაგალითი უნდა მოინიშნოს", issues: [{ postKey: "p2", severity: "blocking", message: "დაამატეთ: მაგალითად" }] } }, "ready")
  await assert.rejects(() => approvePlanningRun(pool, "owner", first.id, 1), /პოსტების/)
  await assert.rejects(() => repairWeeklyPosts(pool, "other", first.id, 1))
  await repairWeeklyPosts(pool, "owner", first.id, 1)
  const repair = (await claimWeeklyPosts(pool, "owner", first.id))!
  assert.deepEqual(Object.keys(repair.batch.payload.copies), ["p1", "p3"])
  assert.deepEqual(repair.batch.payload.repairDrafts?.p2, copyFixture())
  assert.deepEqual(repair.batch.payload.repairFeedback?.p2?.issues, [{ postKey: "p2", severity: "blocking", message: "დაამატეთ: მაგალითად" }])
  await saveWeeklyPosts(pool, first.id, repair.token, { ...repair.batch.payload, copies: completePosts.copies, review: completePosts.review }, "ready")
  const repairedReady = (await readWeeklyPosts(pool, "owner", first.id))!
  assert.deepEqual(repairedReady.payload.repairDrafts?.p2, copyFixture())
  assert.equal(repairedReady.payload.repairFeedback?.p2?.issues[0]?.message, "დაამატეთ: მაგალითად")
  assert.deepEqual(repairedReady.payload.review?.issues, [])
  const content = await sharp({ create: { width: 20, height: 25, channels: 3, background: "#46754a" } }).webp().toBuffer()
  await assert.rejects(() => mutatePostAsset(pool, "other", first.id, "p1", 0, { content, width: 20, height: 25, name: "qa.webp" }))
  await assert.rejects(() => mutatePostAsset(pool, "owner", first.id, "p1", 4, { content, width: 20, height: 25, name: "qa.webp" }))
  await mutatePostAsset(pool, "owner", first.id, "p1", 0, { content, width: 20, height: 25, name: "qa.webp" })
  const asset = (await listPostAssets(pool, "owner", first.id))[0]!
  assert.deepEqual(await readPostAsset(pool, "owner", asset.id), content)
  assert.equal(await readPostAsset(pool, "other", asset.id), null)
  await mutatePostAsset(pool, "owner", first.id, "p1", 0, null)
  assert.equal((await listPostAssets(pool, "owner", first.id)).length, 0)
  await assert.rejects(() => approvePlanningRun(pool, "other", first.id, 1))
  await assert.rejects(() => approvePlanningRun(pool, "owner", first.id, 2))
  await Promise.all([approvePlanningRun(pool, "owner", first.id, 1), approvePlanningRun(pool, "owner", first.id, 1)])
  assert.equal((await readPlanningView(pool, "owner", brandId, input.week)).approved?.id, first.id)
  assert.ok((await readWeeklyPosts(pool, "owner", first.id))?.approvedAt)
  await assert.rejects(() => repairWeeklyPosts(pool, "owner", first.id, 1))
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
  await beginWeeklyPosts(pool, "owner", revision.id, 2)
  const secondPosts = (await claimWeeklyPosts(pool, "owner", revision.id))!
  await saveWeeklyPosts(pool, revision.id, secondPosts.token, completePosts, "ready")
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
  await assert.rejects(() => beginWeeklyPlanning(pool, "owner", { ...input, id: randomUUID(), week: shiftWeek(currentWeek(), 1) }), /მიმდინარე კვირისთვის/)
  // Quantity changes operate on a separate brand's current week, never speculative future weeks.
  const cadenceBrand = await strategicBrandFixture(pool)
  const cadenceBase = await beginWeeklyPlanning(pool, "owner", { ...input, id: randomUUID(), brandId: cadenceBrand })
  const cc = (await claimPlanningRun(pool, "owner", cadenceBase.id))!
  const cadenceReady = await completePlanningFixture(cc.run)
  await finishPlanningStep(pool, cc.run, cc.token, cadenceReady.payload, "ready")
  const cb = (await claimWeeklyPosts(pool, "owner", cadenceBase.id))!
  await saveWeeklyPosts(pool, cadenceBase.id, cb.token, completePosts, "ready")
  await mutatePostAsset(pool, "owner", cadenceBase.id, "p1", 0, { content, width: 20, height: 25, name: "kept.webp" })
  await approvePlanningRun(pool, "owner", cadenceBase.id, 1)
  await assert.rejects(() => changeWeeklyCadence(pool, "other", randomUUID(), cadenceBase.id, 1, { facebook: 1, instagram: 0 }))
  await assert.rejects(() => changeWeeklyCadence(pool, "owner", randomUUID(), cadenceBase.id, 1, { facebook: 9, instagram: 0 }))
  assert.equal((await changeWeeklyCadence(pool, "owner", randomUUID(), cadenceBase.id, 1, { facebook: 3, instagram: 3 })).id, cadenceBase.id)
  const reducedId = randomUUID()
  const reductions = await Promise.all([changeWeeklyCadence(pool, "owner", reducedId, cadenceBase.id, 1, { facebook: 1, instagram: 0 }), changeWeeklyCadence(pool, "owner", reducedId, cadenceBase.id, 1, { facebook: 1, instagram: 0 })])
  const reduced = reductions[0]!
  assert.equal(reductions[1]!.id, reduced.id)
  assert.equal(reduced.version, 2)
  assert.deepEqual(reduced.payload.objective, cadenceReady.payload.objective)
  assert.deepEqual(reduced.payload.review, cadenceReady.payload.review)
  assert.notEqual(reduced.payload.plan!.id, cadenceReady.payload.plan!.id)
  const reducedBatch = (await readWeeklyPosts(pool, "owner", reduced.id))!
  assert.equal(reducedBatch.step, "review")
  assert.equal(reducedBatch.payload.copies.p1!.variants.length, 1)
  assert.deepEqual(reducedBatch.payload.copies.p1!.variants[0], completePosts.copies.p1.variants[0])
  const keptAsset = (await listPostAssets(pool, "owner", reduced.id))[0]!
  assert.deepEqual(await readPostAsset(pool, "owner", keptAsset.id), content)
  assert.equal((await listPostAssets(pool, "owner", cadenceBase.id)).length, 1)
  assert.equal((await readPlanningView(pool, "owner", cadenceBrand, cadenceBase.week)).approved?.id, cadenceBase.id)
  await assert.rejects(() => approvePlanningRun(pool, "owner", reduced.id, reduced.version))
  const oldLease = (await claimWeeklyPosts(pool, "owner", reduced.id))!
  const grown = await changeWeeklyCadence(pool, "owner", randomUUID(), reduced.id, 2, { facebook: 4, instagram: 2 })
  assert.equal((await readWeeklyPosts(pool, "owner", grown.id))?.step, "outline")
  assert.equal(await savePostCopy(pool, reduced.id, oldLease.token, "p1", copyFixture()), false)
  assert.equal(await claimWeeklyPosts(pool, "owner", reduced.id), null)
  await assert.rejects(() => changeWeeklyCadence(pool, "owner", randomUUID(), reduced.id, 2, { facebook: 2, instagram: 1 }))
  const paused = await changeWeeklyCadence(pool, "owner", randomUUID(), grown.id, 3, { facebook: 0, instagram: 0 })
  const pauseBatch = (await readWeeklyPosts(pool, "owner", paused.id))!
  assert.equal(pauseBatch.status, "ready")
  assert.deepEqual(pauseBatch.payload.outline!.posts, [])
  assert.equal(await claimWeeklyPosts(pool, "owner", paused.id), null)
  await approvePlanningRun(pool, "owner", paused.id, 4)
  assert.equal((await pool.query("SELECT count(*)::int n FROM weekly_planning_model_runs WHERE run_id IN ($1,$2,$3)", [reduced.id, grown.id, paused.id])).rows[0].n, 0)
  const restart = await changeWeeklyCadence(pool, "owner", randomUUID(), paused.id, 4, { facebook: 5, instagram: 5 })
  const restartBatch = (await claimWeeklyPosts(pool, "owner", restart.id))!
  const ten = scheduleFixture()
  ten.posts = Array.from({ length: 10 }, (_, i) => ({ ...ten.posts[0]!, title: `სხვადასხვა პოსტი ${i + 1}`, channels: [ten.posts[0]!.channels[i % 2]!] }))
  await saveWeeklyPosts(pool, restart.id, restartBatch.token, { ...restartBatch.batch.payload, outline: ten }, "writing")
  await mutatePostAsset(pool, "owner", restart.id, "p10", 0, { content, width: 20, height: 25, name: "tenth.webp" })
  assert.equal((await listPostAssets(pool, "owner", restart.id))[0]!.postKey, "p10")
  await assert.rejects(() => mutatePostAsset(pool, "owner", restart.id, "p11", 0, { content, width: 20, height: 25, name: "invalid.webp" }))
  // Exercise the real worker + model adapter with fake HTTP, including one saved sibling.
  const runtimeBrand = await strategicBrandFixture(pool)
  const runtime = await beginWeeklyPlanning(pool, "owner", { ...input, id: randomUUID(), brandId: runtimeBrand })
  const runtimeClaim = (await claimPlanningRun(pool, "owner", runtime.id))!
  const runtimePlan = await completePlanningFixture(runtimeClaim.run)
  await finishPlanningStep(pool, runtimeClaim.run, runtimeClaim.token, runtimePlan.payload, "ready")
  await runWeeklyPosts(pool, "owner", runtime.id, MODEL_STAGE_RESERVE_MS - 1)
  assert.equal((await readWeeklyPosts(pool, "owner", runtime.id))?.status, "queued", "insufficient execution budget must not claim")
  const runtimePosts = (await claimWeeklyPosts(pool, "owner", runtime.id))!
  await saveWeeklyPosts(pool, runtime.id, runtimePosts.token, { ...runtimePosts.batch.payload, outline: scheduleFixture(), copies: { p1: copyFixture() } }, "writing")
  const envKeys = ["OPENAI_API_KEY", "OPENAI_POST_WRITER_MODEL", "OPENAI_POST_REVIEW_MODEL"]
  const savedEnv = envKeys.map((key) => process.env[key])
  t.after(() => { envKeys.forEach((key, i) => { if (savedEnv[i] === undefined) delete process.env[key]; else process.env[key] = savedEnv[i] }) })
  process.env.OPENAI_API_KEY = "test-only"
  process.env.OPENAI_POST_WRITER_MODEL = "test-writer"
  process.env.OPENAI_POST_REVIEW_MODEL = "test-reviewer"
  const requests: { step: string; model: string }[] = []
  let providerDown = true
  t.mock.method(globalThis, "fetch", async (url: string, init: RequestInit) => {
    assert.equal(url, "https://api.openai.com/v1/responses")
    const body = JSON.parse(String(init.body)); const step = body.text.format.name.replace(/^brand_/, "")
    requests.push({ step, model: body.model })
    if (providerDown && step === "post_writer_p3") return new Response("temporary provider failure", { status: 503 })
    const result = step === "post_review" ? { summary: "ტექსტები შემოწმებულია", issues: [] } : step === "post_editorial" ? editorialFixture() : copyFixture()
    if (step.startsWith("post_writer_") && "variants" in result) for (const v of result.variants) v.caption = step === "post_writer_p2" ? "რა გამოგვიგზავნოთ? გადაიღეთ ნივთის სრული ხედი და დაზიანება ახლოდან." : "რომელი კვალი უნდა შევინარჩუნოთ? წინასწარ გამიჯნეთ ძველი ფაქტურა და ახალი დაზიანება."
    return new Response(JSON.stringify({ status: "completed", output: [{ content: [{ type: "output_text", text: JSON.stringify(result) }] }] }))
  })
  await runWeeklyPosts(pool, "owner", runtime.id)
  const failedRuntime = (await readWeeklyPosts(pool, "owner", runtime.id))!
  assert.equal(failedRuntime.status, "failed")
  assert.deepEqual(Object.keys(failedRuntime.payload.copies).sort(), ["p1", "p2"])
  assert.equal(requests.filter((r) => r.step === "post_writer_p3").length, 2)
  providerDown = false
  await beginWeeklyPosts(pool, "owner", runtime.id, 1, true)
  await runWeeklyPosts(pool, "owner", runtime.id)
  assert.equal((await readWeeklyPosts(pool, "owner", runtime.id))?.status, "ready")
  assert.equal(requests.filter((r) => r.step === "post_writer_p1").length, 0)
  assert.equal(requests.filter((r) => r.step === "post_writer_p2").length, 1)
  assert.equal(requests.filter((r) => r.step === "post_writer_p3").length, 3)
  assert.ok(requests.filter((r) => r.step.startsWith("post_writer_")).every((r) => r.model === "test-writer"))
  assert.deepEqual(requests.filter((r) => r.step === "post_review"), [{ step: "post_review", model: "test-reviewer" }])
  assert.deepEqual(requests.filter((r) => r.step === "post_editorial"), [{ step: "post_editorial", model: "test-reviewer" }])
  assert.equal((await readWeeklyPosts(pool, "owner", runtime.id))?.payload.review?.editorial?.posts.length, 3)
  assert.deepEqual(requests.filter((r) => r.step === "post_sequence"), [], "semantic sequence review is removed")
  // Simulate a new confirmed foundation version, leaving the run's captured basis untouched.
  await pool.query("UPDATE brand_dossiers SET revision=revision+1 WHERE brand_id=ANY($1::text[])", [[runtimeBrand, cadenceBrand]])
  assert.equal((await readPlanningView(pool, "owner", runtimeBrand, input.week)).stale, true)
  await assert.rejects(() => approvePlanningRun(pool, "owner", runtime.id, 1))
  await assert.rejects(() => changeWeeklyCadence(pool, "owner", randomUUID(), restart.id, restart.version, { facebook: 1, instagram: 1 }), /საფუძველი/)
  assert.equal((await readPlanningRun(pool, "owner", runtime.id))?.payload.basis.revision, 1)
})
