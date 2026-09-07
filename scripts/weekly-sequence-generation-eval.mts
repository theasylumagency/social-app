import assert from "node:assert/strict"
import { mkdir, writeFile } from "node:fs/promises"
import { advanceWeeklyPlanning } from "../src/application/weekly-planning/advance"
import { createPostSchedule, reviewPostSequence } from "../src/application/weekly-planning/posts"
import { applySequenceReview } from "../src/blueprints/social/weekly-planning/sequence"
import { emptyPosts } from "../src/blueprints/social/weekly-planning/posts"
import { createBrandReasoner, type BrandModelRun } from "../src/infrastructure/models/brand-reasoning"
import { postStageModel } from "../src/infrastructure/models/runtime-policy"
import { planningFixture } from "../tests/weekly-planning-fixture"
import { ordinaryPosts } from "../tests/weekly-sequence-fixture"

// Opt-in generation check with a synthetic, mildly differentiated leather-repair brand.
let run = await planningFixture()
run.week = "2026-09-21"
run.payload.founderPosts = true
run.payload.priorWeeks = [{ week: "2026-09-14", objective: "მფლობელმა ნივთის შეფასებისთვის სასარგებლო ინფორმაცია მოამზადოს", directions: [], experiment: null, status: "ready", posts: ordinaryPosts().map((p) => ({ title: p.title, ...p.brief })) }]
const audit: BrandModelRun[] = []
const reason = createBrandReasoner(async (r) => { audit.push(r); console.log(JSON.stringify({ step: r.step, seconds: Math.round(r.durationMs / 1000), errors: r.validationErrors })) }, { model: postStageModel("outline"), reasoningEffort: "low" })
while (run.step !== "ready") run = { ...run, ...await advanceWeeklyPlanning(run, reason) }
const posts = emptyPosts()
const attempts = []
let next: "outline" | "writing" | "ready" = "outline"
while (next === "outline") {
  posts.outline = await createPostSchedule(run, reason, posts)
  const review = await reviewPostSequence(run, posts, reason)
  attempts.push({ outline: structuredClone(posts.outline), review })
  next = applySequenceReview(posts, review)
}
const passed = next === "writing" && !run.payload.review!.concerns.some((c) => c.severity === "blocking")
await mkdir("evals/results/weekly-sequence", { recursive: true })
await writeFile("evals/results/weekly-sequence/ordinary-generation.json", JSON.stringify({ evaluatedAt: new Date().toISOString(), passed, objective: run.payload.objective, directions: run.payload.directions, strategyReview: run.payload.review, attempts, audit }, null, 2))
console.log(JSON.stringify({ passed, attempts: attempts.length, posts: posts.outline!.posts.map((p) => p.title) }))
assert.ok(passed, "Generated week still requires revision; inspect ordinary-generation.json")
