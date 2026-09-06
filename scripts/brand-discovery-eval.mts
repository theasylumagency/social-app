import { randomUUID } from "node:crypto"
import { mkdir, writeFile, readFile } from "node:fs/promises"
import { advanceDiscovery } from "../src/application/brand-discovery/advance"
import { emptyDiscovery, type DiscoverySession } from "../src/blueprints/social/brand-discovery/model"
import { createBrandReasoner } from "../src/infrastructure/models/brand-reasoning"
import { captureBrandWebsite } from "../src/infrastructure/web/website-discovery"

const flag = (name: string) => process.argv[process.argv.indexOf(name) + 1]
const filename = process.argv.includes("--resume") ? flag("--resume")! : `.local/brand-discovery-eval-${Date.now()}.json`
let session: DiscoverySession = process.argv.includes("--resume") ? JSON.parse(await readFile(filename, "utf8")) : {
  id: randomUUID(), ownerId: "evaluation", brandId: null, revision: 1, status: "running", step: "sources",
  payload: emptyDiscovery({ website: process.argv.includes("--website") ? flag("--website")! : "https://theasylum.agency/", notes: process.argv.includes("--notes-file") ? await readFile(flag("--notes-file")!, "utf8") : "", language: "ka" }),
  error: null, updatedAt: new Date().toISOString(), leaseUntil: null,
}
await mkdir(".local", { recursive: true })
console.log(`Evaluation artifact: ${filename}`)
while (session.step !== "ready") {
  const step = session.step
  const started = Date.now()
  const next = await advanceDiscovery(session, { capture: captureBrandWebsite, reason: createBrandReasoner(async (run) => {
    console.log(JSON.stringify({ step: run.step, model: run.model, seconds: Math.round(run.durationMs / 1000), errors: run.validationErrors, usage: run.usage }))
  }) })
  session = { ...session, ...next, status: next.step === "ready" ? "ready" : "running", updatedAt: new Date().toISOString() }
  await writeFile(filename, JSON.stringify(session, null, 2))
  console.log(`${step} completed in ${Math.round((Date.now() - started) / 1000)}s`)
}
console.log(JSON.stringify({ offers: session.payload.understanding?.offers.map((o) => o.name), audiences: session.payload.hypotheses.map((a) => a.name), goals: session.payload.goals.map((g) => g.title) }, null, 2))
