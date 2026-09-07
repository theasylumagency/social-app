import { randomUUID } from "node:crypto"
import { mkdir, readFile, writeFile } from "node:fs/promises"
import { advanceWeeklyPlanning } from "../src/application/weekly-planning/advance"
import type { BrandDossier, DiscoverySession } from "../src/blueprints/social/brand-discovery/model"
import { publicDiscoveryPayload } from "../src/blueprints/social/brand-discovery/model"
import type { PlanningRun } from "../src/blueprints/social/weekly-planning/model"
import { createBrandReasoner } from "../src/infrastructure/models/brand-reasoning"
import { currentWeek } from "../src/application/dashboard/model"

const flag = (name: string) => process.argv[process.argv.indexOf(name) + 1]
const filename = process.argv.includes("--resume") ? flag("--resume")! : `.local/weekly-planning-eval-${Date.now()}.json`
let run: PlanningRun
if (process.argv.includes("--resume")) run = JSON.parse(await readFile(filename, "utf8"))
else {
  if (!process.argv.includes("--basis-file")) throw Error("Supply --basis-file with an existing discovery evaluation or confirmed dossier JSON")
  const raw = JSON.parse(await readFile(flag("--basis-file")!, "utf8")) as DiscoverySession | BrandDossier
  const discovery = "step" in raw
  const p = publicDiscoveryPayload(raw.payload)
  if (!p.envelope || !p.landscape) throw Error("A completed brand foundation is required")
  // Offline evaluations explicitly select all proposed goals as test input. No account is modified.
  if (!p.feedback.selectedGoalIds) p.feedback.selectedGoalIds = p.goals.map((g) => g.id)
  const basis: BrandDossier = { sessionId: discovery ? raw.id : raw.sessionId, revision: raw.revision, confirmedAt: discovery ? raw.updatedAt : raw.confirmedAt, payload: p }
  const now = new Date().toISOString()
  run = { id: randomUUID(), ownerId: "offline-evaluation", brandId: p.landscape.brandId, week: process.argv.includes("--week") ? flag("--week")! : currentWeek(), version: 1, status: "queued", step: "objective", error: null, leaseUntil: null, createdAt: now, updatedAt: now,
    payload: { basis, priority: process.argv.includes("--priority") ? flag("--priority")! : "", revisionNote: "", previousVersion: null, priorWeeks: [], plannedOn: new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Tbilisi" }), objective: null, focus: null, directions: [], adaptation: [], experiment: null, review: null, plan: null } }
}
await mkdir(".local", { recursive: true })
await writeFile(filename, JSON.stringify(run, null, 2))
console.log(`Evaluation artifact: ${filename}`)
while (run.step !== "ready") {
  const next = await advanceWeeklyPlanning(run, createBrandReasoner(async (record) => {
    console.log(JSON.stringify({ step: record.step, model: record.model, seconds: Math.round(record.durationMs / 1000), errors: record.validationErrors, usage: record.usage }))
  }, { model: process.env.OPENAI_PLANNING_MODEL ?? process.env.OPENAI_BRAND_MODEL ?? "gpt-5.6-sol" }))
  run = { ...run, ...next, status: next.step === "ready" ? "ready" : "queued", updatedAt: new Date().toISOString() }
  await writeFile(filename, JSON.stringify(run, null, 2))
}
console.log(JSON.stringify({ objective: run.payload.objective, audienceFocus: run.payload.focus, directions: run.payload.directions, review: run.payload.review }, null, 2))
