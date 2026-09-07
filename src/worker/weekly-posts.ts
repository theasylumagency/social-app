import type { Pool } from "pg"
import { createPostSchedule, writePost, reviewPosts } from "../application/weekly-planning/posts"
import { createBrandReasoner } from "../infrastructure/models/brand-reasoning"
import { readPlanningRun, recordPlanningModelRun } from "../infrastructure/postgres/weekly-planning-store"
import { claimWeeklyPosts, saveWeeklyPosts, savePostCopy, failWeeklyPosts, readWeeklyPosts } from "../infrastructure/postgres/weekly-posts-store"

export async function runWeeklyPosts(pool: Pool, ownerId: string, id: string, budgetMs = 290_000) {
  const deadline = Date.now() + budgetMs
  while (Date.now() < deadline - 185_000) {
    const claim = await claimWeeklyPosts(pool, ownerId, id)
    if (!claim) return
    try {
      const run = await readPlanningRun(pool, ownerId, id)
      if (!run) throw Error("Missing owned plan")
      const payload = structuredClone(claim.batch.payload)
      const model = process.env.OPENAI_POST_WRITER_MODEL ?? process.env.OPENAI_PLANNING_MODEL ?? "gpt-5.6-sol"
      const reason = createBrandReasoner((r) => recordPlanningModelRun(pool, id, r), { model, reasoningEffort: "low" })
      let step = claim.batch.step
      if (step === "outline") { payload.outline = await createPostSchedule(run, reason); step = "writing" }
      else if (step === "writing") {
        const pending = payload.outline!.posts.map((_, i) => `p${i + 1}`).filter((key) => !payload.copies[key]).slice(0, 3)
        const results = await Promise.allSettled(pending.map(async (key) => {
          const copy = await writePost(run, payload, key, reason)
          if (!await savePostCopy(pool, id, claim.token, key, copy)) throw Error("Lost lease")
        }))
        if (results.some((r) => r.status === "rejected")) throw Error("Post generation interrupted")
        const latest = await readWeeklyPosts(pool, ownerId, id)
        payload.copies = latest!.payload.copies
        if (Object.keys(payload.copies).length === payload.outline!.posts.length) step = "review"
      } else if (step === "review") {
        payload.review = await reviewPosts(run, payload, reason)
        const blocked = payload.review.issues.filter((i) => i.severity === "blocking")
        if (blocked.length && payload.repairs < 1) {
          for (const issue of blocked) delete payload.copies[issue.postKey]
          payload.repairs++; step = "writing"
        } else step = "ready"
      }
      if (!await saveWeeklyPosts(pool, id, claim.token, payload, step) || step === "ready") return
    } catch (error) {
      console.error("Weekly posts failed", { step: claim.batch.step, error: error instanceof Error ? error.name : "unknown" })
      await failWeeklyPosts(pool, id, claim.token)
      return
    }
  }
}
