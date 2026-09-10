import type { Pool } from "pg"
import { assertVisualEnabled, readVisualPolicy } from "../application/visuals/policy"
import { runVisualGeneration } from "../application/visuals/generate"
import { expireVisualGenerations } from "../infrastructure/postgres/visual-generation-store"

export async function runVisualGenerationTick(pool: Pool) {
  await expireVisualGenerations(pool)
  try { assertVisualEnabled(readVisualPolicy(), process.env.OPENAI_API_KEY) } catch { return }
  const pending = await pool.query<{ id: string }>("SELECT id FROM visual_generations WHERE status='pending' AND started_at IS NULL ORDER BY created_at LIMIT 2")
  await Promise.all(pending.rows.map((row) => runVisualGeneration(pool, row.id)))
}
