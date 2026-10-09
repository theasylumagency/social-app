import { readFile, readdir } from "node:fs/promises"
import { createHash } from "node:crypto"
import { createCorpus, digest } from "./corpus"
import type { FrozenCorpus } from "./model"
const hashFile = async (file: string) => createHash("sha256").update(await readFile(file)).digest("hex")
async function files(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true })
  return (await Promise.all(entries.map(entry => entry.isDirectory() ? files(`${directory}/${entry.name}`) : Promise.resolve([`${directory}/${entry.name}`])))).flat()
}
export function modelConfiguration(): FrozenCorpus["configuration"] {
  const brand = process.env.OPENAI_BRAND_MODEL?.trim() || "gpt-5.6-terra"
  return { notesModel: process.env.OPENAI_CONTEXTUAL_NOTES_MODEL?.trim() || brand, reviewModel: brand, noteTimeoutMs: 40000, reviewTimeoutMs: 60000, baselineEffort: null, candidateEffort: "low" }
}
export async function freezeCorpus(week: string): Promise<FrozenCorpus> {
  const selected = [...await files("src"), ...await files("evals/performance"), ...await files("tests/fixtures"),
    "tests/weekly-planning-fixture.ts", "tests/weekly-posts-fixture.ts", "tests/brand-discovery-fixture.ts", "tests/social-strategy-fixture.ts", "tests/public-knowledge-fixture.ts",
    "scripts/performance-paired.mts", "scripts/performance-followup.mts", "scripts/performance-review-check.mts", "experiments/jev-request-routing-phase-7e/user-reference.json", "package.json", "package-lock.json"].sort()
  const sourceHashes = Object.fromEntries(await Promise.all(selected.map(async file => [file, await hashFile(file)])))
  const corpus = { version: 1 as const, capturedAt: new Date().toISOString(), week, configuration: modelConfiguration(), cases: await createCorpus(week), sourceHashes,
    provenance: { humanMessages: 5, controlledMessages: 25, liveTrafficSample: false as const, independentFinalQualityLabels: false as const } }
  return { ...corpus, corpusHash: digest(corpus) }
}
export async function assertFrozenCorpus(corpus: FrozenCorpus, requireCurrentConfiguration = true) {
  const { corpusHash, ...payload } = corpus
  if (corpus.version !== 1 || digest(payload) !== corpusHash || corpus.cases.length !== 30 || new Set(corpus.cases.map(item => item.id)).size !== 30) throw Error("FROZEN_CORPUS_CHANGED")
  if (requireCurrentConfiguration && digest(corpus.configuration) !== digest(modelConfiguration())) throw Error("FROZEN_MODEL_CONFIGURATION_CHANGED")
  for (const [file, hash] of Object.entries(corpus.sourceHashes)) {
    if (!/^(src\/|evals\/performance\/|tests\/fixtures\/|tests\/[a-z-]+\.ts$|scripts\/performance-(?:paired|followup|review-check)\.mts$|experiments\/jev-request-routing-phase-7e\/user-reference\.json$|package(?:-lock)?\.json$)/u.test(file)
      || file.split("/").some(part => part === ".." || part.startsWith(".")) || await hashFile(file) !== hash) throw Error(`FROZEN_SOURCE_CHANGED:${file}`)
  }
}
