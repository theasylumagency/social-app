import type { Pool } from "pg"
import { VisualError } from "./policy"
import { generateImageFromPrompt } from "../../infrastructure/openai/image-generation"
import { claimVisualGeneration, markVisualGenerationFailed, markVisualGenerationSucceeded } from "../../infrastructure/postgres/visual-generation-store"

export async function runVisualGeneration(pool: Pool, id: string, generate = generateImageFromPrompt) {
  const claim = await claimVisualGeneration(pool, id)
  if (!claim) return
  try {
    const image = await generate(claim)
    await markVisualGenerationSucceeded(pool, claim.access, id, claim.token, image)
  } catch (error) {
    console.error("Visual generation failed", { generationId: id, code: error instanceof VisualError ? error.code : "generation_failed" })
    await markVisualGenerationFailed(pool, id, claim.token, error instanceof VisualError ? error.message : "გამოსახულება ვერ შეიქმნა ან ვერ შეინახა. კრედიტი არ ჩამოჭრილა; ხელახლა სცადეთ.")
  }
}
