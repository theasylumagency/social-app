import { readFile, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { assertFrozenCorpus } from "../evals/performance/freeze"
import { digest } from "../evals/performance/corpus"
import { evidencePath } from "../evals/performance/evidence-path"
import { runPairs, DIAGNOSTIC_LIMITS } from "../evals/performance/runner"
import { remainingBudget, type CompletedBudget } from "../evals/performance/continuation-budget"
import { pairedReport } from "../evals/performance/report"
import { blindReview } from "../evals/performance/blind-review"
import type { FrozenCorpus, CaseReceipt } from "../evals/performance/model"

async function main() {
  const args = process.argv.slice(2)
  if (args.length !== 7 || args[0] !== "--corpus" || args[2] !== "--after" || args[4] !== "--out" || args[6] !== "--live") throw Error("USAGE: --corpus <new-frozen.json> --after <completed-run> --out <new-run> --live")
  if (!process.env.OPENAI_API_KEY) throw Error("EVALUATION_API_KEY_REQUIRED")
  const corpus = JSON.parse(await readFile(evidencePath(args[1]!), "utf8")) as FrozenCorpus
  await assertFrozenCorpus(corpus)
  const priorDirectory = evidencePath(args[3]!), directory = evidencePath(args[5]!)
  const prior = JSON.parse(await readFile(join(priorDirectory, "summary.json"), "utf8")) as { mode: string; halted: unknown; configuration: unknown; receiptsHash: string; budget: CompletedBudget }
  const priorReceipts = (await readFile(join(priorDirectory, "receipts.jsonl"), "utf8")).split("\n").filter(Boolean).map(line => JSON.parse(line) as CaseReceipt)
  if (prior.mode !== "live-provider" || prior.halted !== null || priorReceipts.length !== 12 || prior.receiptsHash !== digest(priorReceipts)
    || digest(prior.configuration) !== digest(corpus.configuration) || priorReceipts.reduce((sum, row) => sum + row.providerRequestIds.length, 0) !== prior.budget.requests) throw Error("INVALID_PRIOR_LIVE_EVIDENCE")
  const limits = remainingBudget(DIAGNOSTIC_LIMITS, prior.budget), caseIds = ["E01", "E06"]
  // A one-time reservation prevents repeated continuations from reusing the same remainder.
  await writeFile(join(priorDirectory, "followup-reservation.json"), JSON.stringify({ directory, priorReceiptsHash: prior.receiptsHash,
    corpusHash: corpus.corpusHash, caseIds, limits, reservedAt: new Date().toISOString() }, null, 2) + "\n", { flag: "wx" })
  const { receipts, summary } = await runPairs(corpus, directory, { mode: "live-provider", limits, caseIds })
  const comparison = pairedReport(corpus, receipts, caseIds), review = blindReview(corpus, receipts, caseIds)
  await writeFile(join(directory, "comparison.json"), JSON.stringify(comparison, null, 2) + "\n", { flag: "wx" })
  await writeFile(join(directory, "blind-review.html"), review.html, { flag: "wx" })
  await writeFile(join(directory, "blind-mapping.private.json"), JSON.stringify(review.mapping, null, 2) + "\n", { flag: "wx" })
  await writeFile(join(directory, "combined-budget.json"), JSON.stringify({ originalAllowance: DIAGNOSTIC_LIMITS, priorReceiptsHash: prior.receiptsHash,
    newReceiptsHash: summary.receiptsHash, requests: prior.budget.requests + summary.budget.requests,
    serializedRequestBytes: prior.budget.serializedRequestBytes + summary.budget.serializedRequestBytes,
    knownOutputTokens: prior.budget.knownOutputTokens + summary.budget.knownOutputTokens,
    unknownOutputReservation: prior.budget.unknownOutputReservation + summary.budget.unknownOutputReservation,
    elapsedExecutionMs: prior.budget.elapsedMs + summary.budget.elapsedMs, monetaryCostUsd: null }, null, 2) + "\n", { flag: "wx" })
  console.log(JSON.stringify({ completedPairs: comparison.distinctCompletePairs, halted: summary.halted, totalRequests: prior.budget.requests + summary.budget.requests }))
}
main().catch(error => { console.error(error instanceof Error ? error.message : "EVALUATION_FOLLOWUP_FAILED"); process.exitCode = 1 })
