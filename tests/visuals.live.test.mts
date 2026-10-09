import assert from "node:assert/strict"
import test, { type TestContext } from "node:test"
import { randomUUID } from "node:crypto"
import { readdir, readFile } from "node:fs/promises"
import { Pool } from "pg"
import sharp from "sharp"
import { readVisualPolicy } from "../src/application/visuals/policy"
import { parseVisualInput } from "../src/application/visuals/input"
import { runVisualGeneration } from "../src/application/visuals/generate"
import { getVisualCreditBalance } from "../src/infrastructure/postgres/visual-credit-store"
import { createPendingVisualGeneration, listVisualGenerationsForWorkspace, readVisualAsset } from "../src/infrastructure/postgres/visual-generation-store"
import { ensurePersonalWorkspace } from "../src/infrastructure/postgres/workspace-store"


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

