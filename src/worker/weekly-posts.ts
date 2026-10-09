import { captureWeeklyReview } from "../application/weekly-planning/review-evidence"
import type { BrandModelRun } from "../infrastructure/models/brand-reasoning"
import { hasSubscription } from "../infrastructure/postgres/subscription-store"
import { MODEL_STAGE_RESERVE_MS, OPERATOR_WORKER_BUDGET_MS, modelFailure, postStageModel } from "../infrastructure/models/runtime-policy"
import type { Pool } from "pg"
import { createPostSchedule, writePost, reviewPosts } from "../application/weekly-planning/posts"
import { applyPostReview } from "../blueprints/social/weekly-planning/posts"
import { createBrandReasoner } from "../infrastructure/models/brand-reasoning"
import { readPlanningRun, recordPlanningModelRun } from "../infrastructure/postgres/weekly-planning-store"
import { claimWeeklyPosts, saveWeeklyPosts, savePostCopy, failWeeklyPosts, readWeeklyPosts } from "../infrastructure/postgres/weekly-posts-store"
import { createWeeklySemanticShadowCollector, observeCommittedWeeklyShadow, weeklyShadowSnapshot, type CommittedWeeklyShadow } from "./semantic-shadow"
import type { PostsReview } from "../blueprints/social/weekly-planning/posts"

export async function runWeeklyPosts(pool: Pool, ownerId: string, id: string, budgetMs = OPERATOR_WORKER_BUDGET_MS) {
  const deadline = Date.now() + budgetMs
  let shadow: ReturnType<typeof createWeeklySemanticShadowCollector> = undefined
  try { shadow = createWeeklySemanticShadowCollector() } catch { /* Invalid shadow setup cannot fail normal work. */ }
  const shadowEvents: CommittedWeeklyShadow[] = []
  try {
    await runWeeklyPostsStages(pool, ownerId, id, deadline, shadow, shadowEvents)
  } finally {
    // Finish normal review/repair work first. No provider wait consumes its stage budget.
    // Ready/repair state is already durable; collection uses only the worker's remaining time.
    for (const event of shadowEvents) await observeCommittedWeeklyShadow(shadow, event, Math.max(0, deadline - Date.now()))
  }
}

async function runWeeklyPostsStages(pool: Pool, ownerId: string, id: string, deadline: number, shadow: ReturnType<typeof createWeeklySemanticShadowCollector>, shadowEvents: CommittedWeeklyShadow[]) {
  while (Date.now() < deadline - MODEL_STAGE_RESERVE_MS) {
    if (!await hasSubscription(pool, ownerId)) return
    const claim = await claimWeeklyPosts(pool, ownerId, id)
    if (!claim) return
    const model = postStageModel(claim.batch.step)
    try {
      const run = await readPlanningRun(pool, ownerId, id)
      if (!run) throw Error("Missing owned plan")
      const payload = structuredClone(claim.batch.payload)
      const modelRuns: BrandModelRun[] = []
      const reason = createBrandReasoner(async r => { await recordPlanningModelRun(pool, id, r); modelRuns.push(r) }, { model, reasoningEffort: "low" })
      let step = claim.batch.step
      let shadowEvent: CommittedWeeklyShadow | undefined
      if (step === "outline") {
        payload.outline = await createPostSchedule(run, reason, payload)
        delete payload.sequenceReview
        step = "writing"
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
        let reviewedCopies: typeof payload.copies | undefined
        if (shadow) { try { reviewedCopies = structuredClone(payload.copies) } catch { /* Snapshot is evaluation only. */ } }
        let safetyReview: PostsReview | undefined
        const review = await reviewPosts(run, payload, reason, (value) => { safetyReview = value })
        if (!safetyReview || !review.editorial) throw Error("Missing actual review results")
        payload.reviewEvidence = captureWeeklyReview(run, payload, safetyReview, review.editorial, modelRuns, new Date().toISOString())
        step = applyPostReview(payload, review)
        if (shadow && reviewedCopies && safetyReview) {
          try { shadowEvent = weeklyShadowSnapshot(run, reviewedCopies, safetyReview, review, step) } catch { /* Capture cannot fail the normal review checkpoint. */ }
        }
      }
      if (!await saveWeeklyPosts(pool, id, claim.token, payload, step)) throw Error("MODEL_LOST_LEASE")
      if (shadowEvent) shadowEvents.push(shadowEvent)
      if (step === "ready") return
    } catch (error) {
      console.error("Weekly posts failed", { runId: id, step: claim.batch.step, model, ...modelFailure(error) })
      await failWeeklyPosts(pool, id, claim.token)
      return
    }
  }
}
