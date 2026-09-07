import { MODEL_STAGE_RESERVE_MS, OPERATOR_WORKER_BUDGET_MS, modelFailure, postStageModel } from "../infrastructure/models/runtime-policy"
import type { Pool } from "pg"
import { createPostSchedule, writePost, reviewPosts, reviewPostSequence } from "../application/weekly-planning/posts"
import { applySequenceReview } from "../blueprints/social/weekly-planning/sequence"
import { applyPostReview } from "../blueprints/social/weekly-planning/posts"
import { createBrandReasoner } from "../infrastructure/models/brand-reasoning"
import { readPlanningRun, recordPlanningModelRun } from "../infrastructure/postgres/weekly-planning-store"
import { claimWeeklyPosts, saveWeeklyPosts, savePostCopy, failWeeklyPosts, readWeeklyPosts } from "../infrastructure/postgres/weekly-posts-store"

export async function runWeeklyPosts(pool: Pool, ownerId: string, id: string, budgetMs = OPERATOR_WORKER_BUDGET_MS) {
  const deadline = Date.now() + budgetMs
  while (Date.now() < deadline - MODEL_STAGE_RESERVE_MS) {
    const claim = await claimWeeklyPosts(pool, ownerId, id)
    if (!claim) return
    const needsSequence = ["writing", "review"].includes(claim.batch.step) && !claim.batch.payload.sequenceReview && !!claim.batch.payload.outline?.posts.length
    const model = postStageModel(needsSequence ? "review" : claim.batch.step)
    try {
      const run = await readPlanningRun(pool, ownerId, id)
      if (!run) throw Error("Missing owned plan")
      const payload = structuredClone(claim.batch.payload)
      const reason = createBrandReasoner((r) => recordPlanningModelRun(pool, id, r), { model, reasoningEffort: "low" })
      let step = claim.batch.step
      if (step === "outline") {
        payload.sequenceRetainedCount = payload.outline?.posts.length ?? 0
        payload.outline = await createPostSchedule(run, reason, payload)
        delete payload.sequenceReview
        step = "writing"
      }
      else if (needsSequence) {
        step = applySequenceReview(payload, await reviewPostSequence(run, payload, reason))
      }
      else if (step === "writing") {
        const pending = payload.outline!.posts.map((_, i) => `p${i + 1}`).filter((key) => !payload.copies[key]).slice(0, 3)
        const results = await Promise.allSettled(pending.map(async (key) => {
          const copy = await writePost(run, payload, key, reason)
          if (!await savePostCopy(pool, id, claim.token, key, copy)) throw Error("MODEL_LOST_LEASE")
        }))
        const failure = results.find((r) => r.status === "rejected")
        if (failure?.status === "rejected") throw failure.reason
        const latest = await readWeeklyPosts(pool, ownerId, id)
        payload.copies = latest!.payload.copies
        if (Object.keys(payload.copies).length === payload.outline!.posts.length) step = "review"
      } else if (step === "review") {
        step = applyPostReview(payload, await reviewPosts(run, payload, reason))
      }
      if (!await saveWeeklyPosts(pool, id, claim.token, payload, step)) throw Error("MODEL_LOST_LEASE")
      if (step === "ready") return
    } catch (error) {
      console.error("Weekly posts failed", { runId: id, step: claim.batch.step, model, ...modelFailure(error) })
      await failWeeklyPosts(pool, id, claim.token)
      return
    }
  }
}
