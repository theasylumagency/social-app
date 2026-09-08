import { hasSubscription } from "../infrastructure/postgres/subscription-store"
import { MODEL_STAGE_RESERVE_MS, OPERATOR_WORKER_BUDGET_MS, modelFailure } from "../infrastructure/models/runtime-policy"
import type { Pool } from "pg"
import { advanceWeeklyPlanning } from "../application/weekly-planning/advance"
import { createBrandReasoner } from "../infrastructure/models/brand-reasoning"
import { claimPlanningRun, failPlanningStep, finishPlanningStep, recordPlanningModelRun } from "../infrastructure/postgres/weekly-planning-store"

export async function runWeeklyPlanning(pool: Pool, ownerId: string, id: string, budgetMs = OPERATOR_WORKER_BUDGET_MS) {
  const deadline = Date.now() + budgetMs
  while (Date.now() < deadline - MODEL_STAGE_RESERVE_MS) {
    if (!await hasSubscription(pool, ownerId)) return
    const claim = await claimPlanningRun(pool, ownerId, id)
    if (!claim) return
    try {
      const next = await advanceWeeklyPlanning(claim.run, createBrandReasoner((run) => recordPlanningModelRun(pool, id, run), { model: process.env.OPENAI_PLANNING_MODEL?.trim() || process.env.OPENAI_BRAND_MODEL?.trim() || "gpt-5.6-terra", ...(claim.run.payload.founderPosts ? { reasoningEffort: "low" as const } : {}) }))
      if (!await finishPlanningStep(pool, claim.run, claim.token, next.payload, next.step)) return
      if (next.step === "ready") return
    } catch (error) {
      const message = error instanceof Error ? error.message : ""
      console.error("Weekly planning stage failed", { runId: id, step: claim.run.step, ...modelFailure(error) })
      await failPlanningStep(pool, claim.run, claim.token, message.startsWith("MODEL_CONTRACT") ? "ამ ეტაპის შედეგმა ხარისხის შემოწმება ვერ გაიარა. შენახული ეტაპებიდან შეგვიძლია ხელახლა გავაგრძელოთ." : "გეგმის მომზადება დროებით შეწყდა. უკვე დასრულებული ეტაპები შენახულია; ხელახლა ცდა აქედან გააგრძელებს.")
      return
    }
  }
}
