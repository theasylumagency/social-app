import { readFile, mkdir, writeFile } from "node:fs/promises"
import { dirname, resolve, join } from "node:path"
import { currentWeek } from "../src/application/dashboard/model"
import { freezeCorpus, assertFrozenCorpus } from "../evals/performance/freeze"
import { runPairs } from "../evals/performance/runner"
import { pairedReport } from "../evals/performance/report"
import { blindReview } from "../evals/performance/blind-review"
import type { CaseReceipt, FrozenCorpus } from "../evals/performance/model"
import { evidencePath } from "../evals/performance/evidence-path"
import { digest } from "../evals/performance/corpus"
import { mockContractFetch } from "../evals/performance/mock"
const args = process.argv.slice(2), [command, ...values] = args
async function main() {
  if (command === "freeze" && values.length === 2 && values[0] === "--out" && values[1]?.endsWith(".json")) {
    const out = evidencePath(values[1]); await mkdir(dirname(out), { recursive: true })
    const corpus = await freezeCorpus(currentWeek())
    await writeFile(out, JSON.stringify(corpus, null, 2) + "\n", { flag: "wx" })
    console.log(JSON.stringify({ corpusHash: corpus.corpusHash, cases: corpus.cases.length, out })); return
  }
  if (command === "run" && values.length === 5 && values[0] === "--corpus" && values[2] === "--out" && ["--live", "--mock"].includes(values[4]!)) {
    const corpus = JSON.parse(await readFile(evidencePath(values[1]!), "utf8")) as FrozenCorpus
    const directory = evidencePath(values[3]!)
    await runPairs(corpus, directory, values[4] === "--live" ? { mode: "live-provider" } : { mode: "mock-contract", fetch: mockContractFetch })
    await report(corpus, directory); return
  }
  if (command === "report" && values.length === 4 && values[0] === "--corpus" && values[2] === "--run") {
    const corpus = JSON.parse(await readFile(evidencePath(values[1]!), "utf8")) as FrozenCorpus
    await report(corpus, evidencePath(values[3]!)); return
  }
  throw Error("USAGE: freeze --out .local/t12-2/<new>.json | run --corpus <frozen.json> --out <new-directory> --live|--mock | report --corpus <frozen.json> --run <directory>")
}
async function report(corpus: FrozenCorpus, directory: string) {
  await assertFrozenCorpus(corpus, false)
  const receipts = (await readFile(join(directory, "receipts.jsonl"), "utf8")).split("\n").filter(Boolean).map(line => JSON.parse(line) as CaseReceipt)
  const summary = JSON.parse(await readFile(join(directory, "summary.json"), "utf8")) as { corpusHash: string; receiptsHash: string; caseIds: string[] }
  if (summary.corpusHash !== corpus.corpusHash || summary.receiptsHash !== digest(receipts)) throw Error("EVALUATION_SAVED_RECEIPTS_CHANGED")
  const result = pairedReport(corpus, receipts, summary.caseIds), review = blindReview(corpus, receipts, summary.caseIds)
  await writeFile(join(directory, "comparison.json"), JSON.stringify(result, null, 2) + "\n", { flag: "wx" })
  await writeFile(join(directory, "blind-review.html"), review.html, { flag: "wx" })
  await writeFile(join(directory, "blind-mapping.private.json"), JSON.stringify(review.mapping, null, 2) + "\n", { flag: "wx" })
  console.log(JSON.stringify({ distinctPairs: result.distinctCompletePairs, gate: result.gate.decision, directory }))
}
// Importable path guard does not invoke a paid experiment.
if (process.argv[1] && resolve(process.argv[1]) === resolve("scripts/performance-paired.mts")) {
  main().catch(error => { console.error(error instanceof Error ? error.message : "EVALUATION_FAILED"); process.exitCode = 1 })
}
