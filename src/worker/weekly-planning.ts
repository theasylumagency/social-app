import type { Pool } from "pg"
import { advanceWeeklyPlanning } from "../application/weekly-planning/advance"
import { createBrandReasoner } from "../infrastructure/models/brand-reasoning"
import { claimPlanningRun, failPlanningStep, finishPlanningStep, recordPlanningModelRun } from "../infrastructure/postgres/weekly-planning-store"
import { runWeeklyPosts } from "./weekly-posts"

export async function runWeeklyPlanning(pool: Pool, ownerId: string, id: string, budgetMs = 290_000) {
  const deadline = Date.now() + budgetMs
  while (Date.now() < deadline - 185_000) {
    const claim = await claimPlanningRun(pool, ownerId, id)
    if (!claim) return
    try {
      const next = await advanceWeeklyPlanning(claim.run, createBrandReasoner((run) => recordPlanningModelRun(pool, id, run), { model: process.env.OPENAI_PLANNING_MODEL ?? process.env.OPENAI_BRAND_MODEL ?? "gpt-5.6-sol", ...(claim.run.payload.founderPosts ? { reasoningEffort: "low" as const } : {}) }))
      if (!await finishPlanningStep(pool, claim.run, claim.token, next.payload, next.step)) return
      if (next.step === "ready") { await runWeeklyPosts(pool, ownerId, id, deadline - Date.now()); return }
    } catch (error) {
      const message = error instanceof Error ? error.message : ""
      console.error("Weekly planning stage failed", { runId: id, step: claim.run.step, error: error instanceof Error ? error.name : "unknown" })
      await failPlanningStep(pool, claim.run, claim.token, message.startsWith("MODEL_CONTRACT") ? "ამ ეტაპის შედეგმა ხარისხის შემოწმება ვერ გაიარა. შენახული ეტაპებიდან შეგვიძლია ხელახლა გავაგრძელოთ." : "გეგმის მომზადება დროებით შეწყდა. უკვე დასრულებული ეტაპები შენახულია; ხელახლა ცდა აქედან გააგრძელებს.")
      return
    }
  }
}
