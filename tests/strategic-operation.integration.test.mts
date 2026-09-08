import assert from "node:assert/strict"
import test from "node:test"
import { randomUUID } from "node:crypto"
import { readFile, readdir } from "node:fs/promises"
import { Pool } from "pg"
import { ensurePersonalWorkspace } from "../src/infrastructure/postgres/workspace-store"
import { readSubscription, hasSubscription, purchaseSubscription } from "../src/infrastructure/postgres/subscription-store"
import { approveStrategy, claimStrategy, proposeStrategy, readStrategyView, saveWeekEvidence } from "../src/infrastructure/postgres/social-strategy-store"
import { beginWeeklyPlanning, claimPlanningRun, finishPlanningStep, readPlanningView } from "../src/infrastructure/postgres/weekly-planning-store"
import { claimWeeklyPosts } from "../src/infrastructure/postgres/weekly-posts-store"
import { strategicBrandFixture } from "./strategic-integration-fixture"
import { currentWeek, shiftWeek } from "../src/application/dashboard/model"
import { completePlanningFixture } from "./weekly-planning-fixture"
import { strategyProposal } from "./social-strategy-fixture"
import { runSocialStrategy } from "../src/worker/social-strategy"
import { createBrandOnboarding } from "../src/application/onboarding/create-brand"
import { PostgresIngestionStore } from "../src/infrastructure/postgres/ingestion-store"

test("subscription, persistent strategy, disagreement, evidence and weekly admission work together", { skip: !process.env.DATABASE_URL }, async (t) => {
  const admin = new Pool({ connectionString: process.env.DATABASE_URL })
  const schema = `strategic_test_${randomUUID().replaceAll("-", "")}`
  assert.match(schema, /^strategic_test_[a-f0-9]{32}$/)
  await admin.query(`CREATE SCHEMA "${schema}"`)
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, options: `-c search_path=${schema}` })
  t.after(async () => { await pool.end(); await admin.query(`DROP SCHEMA "${schema}" CASCADE`); await admin.end() })
  for (const file of (await readdir(new URL("../db/migrations/", import.meta.url))).filter((f) => f.endsWith(".sql")).sort()) await pool.query(await readFile(new URL(`../db/migrations/${file}`, import.meta.url), "utf8"))
  for (const id of ["owner", "other"]) { await pool.query('INSERT INTO auth_user(id,name,email,"emailVerified") VALUES($1,$1,$2,true)', [id, `${id}@example.test`]); await ensurePersonalWorkspace(pool, id) }
  const workspace = await ensurePersonalWorkspace(pool, "owner")
  assert.equal(await hasSubscription(pool, "owner"), false, "no implicit trial")
  const paymentId = randomUUID()
  const purchases = await Promise.all([purchaseSubscription(pool, "owner", paymentId, "solo"), purchaseSubscription(pool, "owner", paymentId, "solo")])
  assert.deepEqual(purchases[0], purchases[1])
  assert.equal((await pool.query("SELECT count(*)::int n FROM subscription_payments")).rows[0].n, 1)
  assert.equal(await hasSubscription(pool, "other"), false)
  await assert.rejects(() => purchaseSubscription(pool, "owner", randomUUID(), "custom"), /ინდივიდუალური/)

  const brandId = await strategicBrandFixture(pool)
  const active = (await readStrategyView(pool, "owner", brandId)).active!
  const input = { id: randomUUID(), brandId, week: currentWeek(), priority: "" }
  await assert.rejects(() => beginWeeklyPlanning(pool, "owner", { ...input, week: shiftWeek(input.week, 1) }), /მიმდინარე კვირისთვის/)
  const first = await beginWeeklyPlanning(pool, "owner", input)
  assert.equal(first.payload.socialStrategy?.id, active.id)
  assert.equal(first.payload.evidence?.[0]?.availability, "unavailable")
  const lease = (await claimPlanningRun(pool, "owner", first.id))!
  const ready = await completePlanningFixture(lease.run)
  await finishPlanningStep(pool, lease.run, lease.token, ready.payload, "ready")
  const previousWeek = shiftWeek(input.week, -1)
  await pool.query("UPDATE weekly_planning_runs SET week_start=$2::date,payload=jsonb_set(jsonb_set(payload,'{plan,startsOn}',to_jsonb($2::text)),'{plan,endsOn}',to_jsonb(($2::date+6)::text)) WHERE id=$1", [first.id, previousWeek])
  assert.equal(await claimWeeklyPosts(pool, "owner", first.id), null, "archived queued content cannot generate")
  await saveWeekEvidence(pool, "owner", brandId, { week: previousWeek, reviewedAt: "forged", availability: "unavailable", observations: [{ level: "public", observation: "კომენტარში შეფასებისთვის ფოტოს გაგზავნა იკითხეს", source: "https://facebook.com/workshop/posts/1" }], execution: ["ერთი პოსტი გამოქვეყნდა"], unknowns: ["მიზეზობრივი კავშირი უცნობია"], businessContext: "" })
  const next = await beginWeeklyPlanning(pool, "owner", { ...input, id: randomUUID() })
  assert.equal(next.payload.socialStrategy?.id, active.id)
  assert.equal((await pool.query("SELECT count(*)::int n FROM social_strategies WHERE brand_id=$1", [brandId])).rows[0].n, 1, "week rollover creates no strategy")
  assert.equal(next.payload.evidence?.[0]?.availability, "available")
  assert.notEqual(next.payload.evidence?.[0]?.reviewedAt, "forged")
  assert.equal(next.payload.priorWeeks.length, 1)

  // One actual worker call per proposed/revised strategy, with an entirely fake provider.
  const oldKey = process.env.OPENAI_API_KEY
  process.env.OPENAI_API_KEY = "test-only"
  t.after(() => { if (oldKey === undefined) delete process.env.OPENAI_API_KEY; else process.env.OPENAI_API_KEY = oldKey })
  const modelInputs: Record<string, unknown>[] = []
  t.mock.method(globalThis, "fetch", async (url: string, init?: RequestInit) => {
    assert.equal(url, "https://api.openai.com/v1/responses")
    const body = JSON.parse(String(init?.body))
    const input = JSON.parse(body.input); modelInputs.push(input)
    const proposal = strategyProposal()
    if (input.founderComment) proposal.rationale = `გავითვალისწინეთ ახალი კონტექსტი: ${input.founderComment}`
    return Response.json({ status: "completed", output: [{ content: [{ type: "output_text", text: JSON.stringify(proposal) }] }] })
  })
  await assert.rejects(() => proposeStrategy(pool, "owner", { id: randomUUID(), brandId, parentId: active.id, reason: "newWeek", comment: "ახალი კვირა დაიწყო" }))
  const proposed = await proposeStrategy(pool, "owner", { id: randomUUID(), brandId, parentId: active.id, reason: "performanceEvidence", comment: "ახალ კომენტარებში ფასის გაგების პრობლემა ჩანს" })
  await runSocialStrategy(pool, "owner", proposed.id)
  assert.equal((await readStrategyView(pool, "owner", brandId)).active?.id, active.id)
  assert.equal((await readStrategyView(pool, "other", brandId)).latest, null)
  await assert.rejects(() => approveStrategy(pool, "other", brandId, proposed.id, proposed.revision))
  const disagreed = await proposeStrategy(pool, "owner", { id: randomUUID(), brandId, parentId: proposed.id, reason: "founderFeedback", comment: "ფასის ნაცვლად შეფასების საზღვრები უნდა განვმარტოთ" })
  await runSocialStrategy(pool, "owner", disagreed.id)
  assert.equal(modelInputs.length, 2)
  assert.equal(modelInputs[1]!.founderComment, disagreed.payload.comment)
  assert.ok(modelInputs[1]!.previousProposal)
  const view = await readStrategyView(pool, "owner", brandId)
  assert.match(view.latest!.payload.proposal!.rationale, /შეფასების საზღვრები/)
  await assert.rejects(() => approveStrategy(pool, "owner", brandId, proposed.id, proposed.revision))
  await Promise.all([approveStrategy(pool, "owner", brandId, disagreed.id, disagreed.revision), approveStrategy(pool, "owner", brandId, disagreed.id, disagreed.revision)])
  assert.equal((await readStrategyView(pool, "owner", brandId)).active?.id, disagreed.id)
  assert.equal((await readPlanningView(pool, "owner", brandId, input.week)).stale, true)
  assert.equal(await claimPlanningRun(pool, "owner", next.id), null, "superseded strategy cannot create copy")

  const store = new PostgresIngestionStore(pool, workspace)
  const addBrand = (name: string) => createBrandOnboarding({ businessName: name, services: ["მომსახურება"], language: "ka" }, store)
  await assert.rejects(() => addBrand("Over capacity"), /ლიმიტი/)
  const beforeUpgrade = await readSubscription(pool, "owner")
  await purchaseSubscription(pool, "owner", randomUUID(), "studio")
  assert.equal((await readSubscription(pool, "owner"))?.expiresAt, beforeUpgrade?.expiresAt)
  const race = await Promise.allSettled([addBrand("Brand two"), addBrand("Brand three"), addBrand("Brand four")])
  assert.equal(race.filter((r) => r.status === "fulfilled").length, 2, "concurrent creation cannot exceed three brands")
  await purchaseSubscription(pool, "owner", randomUUID(), "agency")
  assert.equal((await readSubscription(pool, "owner"))?.brandLimit, 10)
  await pool.query("INSERT INTO subscription_custom_terms(workspace_id,brand_limit,terms) VALUES($1,12,'ინდივიდუალური სატესტო შეთანხმება')", [workspace.workspaceId])
  await purchaseSubscription(pool, "owner", randomUUID(), "custom")
  assert.equal((await readSubscription(pool, "owner"))?.brandLimit, 12)
  await pool.query("UPDATE workspace_subscriptions SET paid_at=now()-interval '2 months',expires_at=now()-interval '1 second' WHERE workspace_id=$1", [workspace.workspaceId])
  assert.equal(await hasSubscription(pool, "owner"), false)
  assert.equal(await claimStrategy(pool, "owner", disagreed.id), null)
  await assert.rejects(() => addBrand("Expired"), /გამოწერა/)
  await assert.rejects(() => saveWeekEvidence(pool, "owner", brandId, { week: input.week, reviewedAt: "", availability: "unavailable", observations: [], execution: [], unknowns: [], businessContext: "" }), /გამოწერა/)
  assert.equal((await pool.query("SELECT count(*)::int n FROM brands WHERE workspace_id=$1", [workspace.workspaceId])).rows[0].n, 3, "expiry preserves brands")
  await purchaseSubscription(pool, "owner", randomUUID(), "studio")
  assert.equal(await hasSubscription(pool, "owner"), true)
})
