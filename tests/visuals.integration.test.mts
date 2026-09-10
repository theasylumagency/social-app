import assert from "node:assert/strict"
import test, { type TestContext } from "node:test"
import { randomUUID } from "node:crypto"
import { readdir, readFile } from "node:fs/promises"
import { Pool } from "pg"
import sharp from "sharp"
import { readVisualPolicy } from "../src/application/visuals/policy"
import { parseVisualInput } from "../src/application/visuals/input"
import { runVisualGeneration } from "../src/application/visuals/generate"
import { addVisualCredits, getVisualCreditBalance, seedDemoCreditsIfNeeded } from "../src/infrastructure/postgres/visual-credit-store"
import { claimVisualGeneration, createPendingVisualGeneration, expireVisualGenerations, listVisualGenerationsForWorkspace, markVisualGenerationFailed, markVisualGenerationSucceeded, readVisualAsset } from "../src/infrastructure/postgres/visual-generation-store"
import { ensurePersonalWorkspace } from "../src/infrastructure/postgres/workspace-store"
import { listPostAssets, mutatePostAsset, readPostAsset } from "../src/infrastructure/postgres/weekly-posts-store"
import { scheduleFixture } from "./weekly-posts-fixture"

async function fixture(t: TestContext) {
  const admin = new Pool({ connectionString: process.env.DATABASE_URL })
  const schema = `visuals_test_${randomUUID().replaceAll("-", "")}`
  await admin.query(`CREATE SCHEMA "${schema}"`)
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, options: `-c search_path=${schema}` })
  t.after(async () => { await pool.end(); await admin.query(`DROP SCHEMA "${schema}" CASCADE`); await admin.end() })
  for (const file of (await readdir(new URL("../db/migrations/", import.meta.url))).filter((f) => f.endsWith(".sql")).sort()) await pool.query(await readFile(new URL(`../db/migrations/${file}`, import.meta.url), "utf8"))
  for (const id of ["owner", "other"]) await pool.query('INSERT INTO auth_user(id,name,email,"emailVerified") VALUES($1,$1,$2,true)', [id, `${id}@example.test`])
  const access = await ensurePersonalWorkspace(pool, "owner"); const other = await ensurePersonalWorkspace(pool, "other")
  const content = await sharp({ create: { width: 24, height: 32, channels: 3, background: "blue" } }).webp().toBuffer()
  const image = { content, width: 24, height: 32, providerRequestId: "req-fixture", providerAssetId: null, providerCostUsd: null, metadata: {} }
  return { pool, access, other, image }
}
const demo = readVisualPolicy({ VISUAL_MODE: "test" })
const production = readVisualPolicy({ VISUAL_MODE: "production" })
const input = () => parseVisualInput({ requestId: randomUUID(), prompt: "A ceramic blue bowl" })

test("live OpenAI visual is stored and charged exactly once", { skip: process.env.VISUAL_LIVE_TEST !== "1" || !process.env.DATABASE_URL || !process.env.OPENAI_API_KEY }, async (t) => {
  const { pool, access } = await fixture(t)
  const policy = readVisualPolicy({ VISUAL_MODE: "test", OPENAI_IMAGE_QUALITY: "low" })
  const g = await createPendingVisualGeneration(pool, access, parseVisualInput({ requestId: randomUUID(), prompt: "A minimal studio photograph of a blue ceramic bowl on a warm cream background. Soft daylight, no text, no logo." }), policy)
  await runVisualGeneration(pool, g.id)
  const [result] = await listVisualGenerationsForWorkspace(pool, access)
  assert.equal(result?.status, "succeeded", result?.error ?? undefined)
  assert.ok(await readVisualAsset(pool, access, g.id))
  assert.deepEqual(await getVisualCreditBalance(pool, access), { remainingCredits: 19, reservedCredits: 0, availableCredits: 19 })
})

test("ledger prevents concurrent overspend, duplicate grants, double completion and cross-workspace reads", { skip: !process.env.DATABASE_URL }, async (t) => {
  const { pool, access, other, image } = await fixture(t)
  await Promise.all(Array.from({ length: 12 }, () => seedDemoCreditsIfNeeded(pool, access, demo)))
  assert.equal((await getVisualCreditBalance(pool, access)).remainingCredits, 20)
  await seedDemoCreditsIfNeeded(pool, other, production)
  assert.equal((await getVisualCreditBalance(pool, other)).remainingCredits, 0)
  const same = input()
  const duplicates = await Promise.all(Array.from({ length: 5 }, () => createPendingVisualGeneration(pool, access, same, demo)))
  assert.equal(new Set(duplicates.map((g) => g.id)).size, 1)
  await assert.rejects(createPendingVisualGeneration(pool, access, { ...same, prompt: "Different" }, demo), /უკვე/)
  const race = await Promise.allSettled(Array.from({ length: 25 }, () => createPendingVisualGeneration(pool, access, input(), demo)))
  assert.equal(race.filter((r) => r.status === "fulfilled").length, 19)
  assert.deepEqual(await getVisualCreditBalance(pool, access), { remainingCredits: 20, reservedCredits: 20, availableCredits: 0 })
  const id = duplicates[0]!.id
  const claims = await Promise.all([claimVisualGeneration(pool, id), claimVisualGeneration(pool, id)])
  assert.equal(claims.filter(Boolean).length, 1)
  const claim = claims.find(Boolean)!
  const completions = await Promise.all([markVisualGenerationSucceeded(pool, access, id, claim.token, image), markVisualGenerationSucceeded(pool, access, id, claim.token, image)])
  assert.equal(completions.filter(Boolean).length, 1)
  assert.equal((await getVisualCreditBalance(pool, access)).remainingCredits, 19)
  assert.ok(await readVisualAsset(pool, access, id))
  assert.equal(await readVisualAsset(pool, other, id), null)
  assert.deepEqual(await listVisualGenerationsForWorkspace(pool, other), [])
  const pending = (await listVisualGenerationsForWorkspace(pool, access)).find((g) => g.status === "pending")!
  await runVisualGeneration(pool, pending.id, async () => { throw Error("provider failed") })
  assert.deepEqual(await getVisualCreditBalance(pool, access), { remainingCredits: 19, reservedCredits: 18, availableCredits: 1 })
  await addVisualCredits(pool, access, { delta: 5, reason: "credit_purchase", grantKey: "purchase-1" })
  await addVisualCredits(pool, access, { delta: 5, reason: "credit_purchase", grantKey: "purchase-1" })
  assert.equal((await getVisualCreditBalance(pool, access)).remainingCredits, 24)
  await assert.rejects(addVisualCredits(pool, access, { delta: 6, reason: "credit_purchase", grantKey: "purchase-1" }))
  await assert.rejects(addVisualCredits(pool, access, { delta: -7, reason: "manual_adjustment", grantKey: "adjust-1" }))
})

test("persistence failures roll back debit and bytes; expired claims are never sent to the provider again", { skip: !process.env.DATABASE_URL }, async (t) => {
  const { pool, access, image } = await fixture(t)
  const first = await createPendingVisualGeneration(pool, access, input(), demo)
  const claim = (await claimVisualGeneration(pool, first.id))!
  await assert.rejects(markVisualGenerationSucceeded(pool, access, first.id, claim.token, { ...image, content: Buffer.alloc(0) }))
  assert.equal((await getVisualCreditBalance(pool, access)).remainingCredits, 20)
  assert.equal(await readVisualAsset(pool, access, first.id), null)
  await pool.query("UPDATE visual_generations SET lease_until=now()-interval '1 second' WHERE id=$1", [first.id])
  await expireVisualGenerations(pool)
  let calls = 0
  await runVisualGeneration(pool, first.id, async () => { calls++; return image })
  assert.equal(calls, 0)
  assert.equal(await markVisualGenerationSucceeded(pool, access, first.id, claim.token, image), false)
  assert.deepEqual(await getVisualCreditBalance(pool, access), { remainingCredits: 20, reservedCredits: 0, availableCredits: 20 })
  const regenerated = await createPendingVisualGeneration(pool, access, { ...input(), requestKind: "regenerate" }, demo)
  await runVisualGeneration(pool, regenerated.id, async () => image)
  assert.equal((await getVisualCreditBalance(pool, access)).remainingCredits, 19)
  await seedDemoCreditsIfNeeded(pool, access, demo)
  assert.equal((await getVisualCreditBalance(pool, access)).remainingCredits, 19)
})

test("post targets are owned and valid; attachment uses existing media pipeline without another charge", { skip: !process.env.DATABASE_URL }, async (t) => {
  const { pool, access, other, image } = await fixture(t)
  await pool.query("INSERT INTO brands(id,created_at,workspace_id) VALUES('brand',now(),$1)", [access.workspaceId])
  const runId = randomUUID()
  await pool.query("INSERT INTO weekly_planning_runs(id,owner_user_id,brand_id,week_start,version,status,step,payload) VALUES($1,'owner','brand','2026-09-07',1,'ready','ready','{}')", [runId])
  await pool.query("INSERT INTO weekly_post_batches(run_id,status,step,payload) VALUES($1,'ready','ready',$2)", [runId, JSON.stringify({ outline: scheduleFixture(), copies: {}, review: null, repairs: 0 })])
  const request = { ...input(), brandId: "brand", target: { runId, postKey: "p1", slot: 0 } }
  await assert.rejects(createPendingVisualGeneration(pool, other, request, demo))
  await assert.rejects(createPendingVisualGeneration(pool, access, { ...request, target: { ...request.target, slot: 2 } }, demo))
  assert.equal((await getVisualCreditBalance(pool, other)).remainingCredits, 0)
  const g = await createPendingVisualGeneration(pool, access, request, demo)
  await runVisualGeneration(pool, g.id, async () => image)
  const saved = (await readVisualAsset(pool, access, g.id))!
  await assert.rejects(mutatePostAsset(pool, other.userId, runId, "p1", 0, { ...saved, name: "generated.webp" }))
  await mutatePostAsset(pool, access.userId, runId, "p1", 0, { ...saved, name: "generated.webp" })
  const assets = await listPostAssets(pool, access.userId, runId)
  assert.equal(assets.length, 1)
  assert.deepEqual(await readPostAsset(pool, access.userId, assets[0]!.id), image.content)
  await mutatePostAsset(pool, access.userId, runId, "p1", 0, null)
  assert.ok(await readVisualAsset(pool, access, g.id))
  assert.equal((await getVisualCreditBalance(pool, access)).remainingCredits, 19)
  // A stale failure cannot overwrite success or refund a completed generation.
  await markVisualGenerationFailed(pool, g.id, randomUUID(), "late failure")
  assert.equal((await listVisualGenerationsForWorkspace(pool, access))[0]?.status, "succeeded")
})
