import { createHash } from "node:crypto"
import { writeFile } from "node:fs/promises"
import { completePlanningFixture, planningFixture } from "../tests/weekly-planning-fixture"
import { currentScheduleFixture, copyFixture } from "../tests/weekly-posts-fixture"
import { compilePostGenerationContext, compilePostEditorialContext, postEditorialContext } from "../src/blueprints/social/weekly-planning/post-context"
import { latencyStats } from "../src/application/evaluation/performance-report"
import { evaluationReportPath } from "./evaluation-report-path.mjs"

const out = evaluationReportPath("docs/plans/2026-10-09-review-context-benchmark.json")
const run = await completePlanningFixture(await planningFixture()), outline = currentScheduleFixture()
const copies = Object.fromEntries(outline.posts.map((_, i) => [`p${i + 1}`, copyFixture()]))
function previous() {
  const posts = outline.posts.map((post, i) => ({ postKey: `p${i + 1}`, ...compilePostEditorialContext(run, post), draft: copies[`p${i + 1}`] }))
  const postContexts = outline.posts.map((post, i) => ({ postKey: `p${i + 1}`, ...compilePostGenerationContext(run, post) }))
  return [{ postContexts, weeklyOutline: outline, drafts: copies }, { posts }]
}
function current() {
  const postContexts = outline.posts.map((post, i) => ({ postKey: `p${i + 1}`, ...compilePostGenerationContext(run, post) }))
  const posts = postContexts.map(context => ({ postKey: context.postKey, ...postEditorialContext(context), draft: copies[context.postKey] }))
  return [{ postContexts, weeklyOutline: outline, drafts: copies }, { posts }]
}
const before = JSON.stringify(previous()), after = JSON.stringify(current())
if (before !== after) throw Error("REVIEWER_INPUT_CHANGED")
for (let warm = 0; warm < 200; warm++) { previous(); current() }
const iterations = 500, oldMs = [], newMs = []
let checksum = 0
const measure = (compile: () => unknown[]) => {
  const started = performance.now()
  for (let i = 0; i < iterations; i++) checksum += compile().length
  return (performance.now() - started) / iterations
}
for (let round = 0; round < 20; round++) {
  if (round % 2 === 0) { oldMs.push(measure(previous)); newMs.push(measure(current)) }
  else { newMs.push(measure(current)); oldMs.push(measure(previous)) }
}
const previousTiming = latencyStats(oldMs)!, currentTiming = latencyStats(newMs)!
const report = { scope: "controlled-context-preparation-only", fixturePosts: outline.posts.length, rounds: 20, iterationsPerRound: iterations,
  warmupIterations: 200, order: "alternating", previousMsPerWeek: previousTiming, currentMsPerWeek: currentTiming,
  generationCompilationsPerWeek: { previous: outline.posts.length * 2, current: outline.posts.length },
  inputBytes: Buffer.byteLength(before), inputHash: createHash("sha256").update(before).digest("hex"), byteIdenticalReviewerInputs: true,
  callsRemoved: 0, providerTokenReduction: 0, fullPipelineSpeedupMeasured: false, qualityModelEvaluated: false, checksum }
await writeFile(out, JSON.stringify(report, null, 2) + "\n", { flag: "wx" })
console.log(JSON.stringify(report, null, 2))
