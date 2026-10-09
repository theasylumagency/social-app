import { readFile, writeFile, appendFile, mkdir } from "node:fs/promises"
import { join } from "node:path"
import { digest } from "../evals/performance/corpus"
import { assertFrozenCorpus } from "../evals/performance/freeze"
import { evidencePath } from "../evals/performance/evidence-path"
import { remainingBudget } from "../evals/performance/continuation-budget"
import { evaluationBudget } from "../evals/performance/budget"
import { DIAGNOSTIC_LIMITS } from "../evals/performance/runner"
import type { FrozenCorpus, CaseReceipt } from "../evals/performance/model"
import { createBrandReasoner, type BrandModelRun } from "../src/infrastructure/models/brand-reasoning"
import { modelFailure } from "../src/infrastructure/models/runtime-policy"
import { reviewPostRevision } from "../src/application/post-revisions/review"
import type { PostRevision } from "../src/application/post-revisions/model"
import { weeklyReviewBlocker } from "../src/application/weekly-planning/review-policy"

async function main() {
  const args = process.argv.slice(2)
  if (args.length !== 3 || args[2] !== "--live") throw Error("USAGE: <new-frozen-corpus> <new-output-directory> --live")
  if (!process.env.OPENAI_API_KEY) throw Error("EVALUATION_API_KEY_REQUIRED")
  const current = JSON.parse(await readFile(evidencePath(args[0]!), "utf8")) as FrozenCorpus
  await assertFrozenCorpus(current)
  const directory = evidencePath(args[1]!), previousDirectory = evidencePath(".local/t12-2/live-followup-01")
  const rows = (await readFile(join(previousDirectory, "receipts.jsonl"), "utf8")).split("\n").filter(Boolean).map(line => JSON.parse(line) as CaseReceipt)
  const previous = JSON.parse(await readFile(join(previousDirectory, "summary.json"), "utf8"))
  const combined = JSON.parse(await readFile(join(previousDirectory, "combined-budget.json"), "utf8"))
  const firstDirectory = evidencePath(".local/t12-2/live-diagnostic-01")
  const first = JSON.parse(await readFile(join(firstDirectory, "summary.json"), "utf8"))
  const firstRows = (await readFile(join(firstDirectory, "receipts.jsonl"), "utf8")).split("\n").filter(Boolean).map(line => JSON.parse(line) as CaseReceipt)
  if (first.receiptsHash !== digest(firstRows) || combined.priorReceiptsHash !== first.receiptsHash
    || first.budget.requests + previous.budget.requests !== combined.requests
    || first.budget.serializedRequestBytes + previous.budget.serializedRequestBytes !== combined.serializedRequestBytes
    || first.budget.knownOutputTokens + previous.budget.knownOutputTokens !== combined.knownOutputTokens
    || first.budget.unknownOutputReservation + previous.budget.unknownOutputReservation !== combined.unknownOutputReservation
    || first.budget.elapsedMs + previous.budget.elapsedMs !== combined.elapsedExecutionMs) throw Error("REVIEW_CHECK_BUDGET_CHANGED")
  if (previous.receiptsHash !== digest(rows) || combined.newReceiptsHash !== digest(rows) || digest(previous.configuration) !== digest(current.configuration)) throw Error("REVIEW_CHECK_EVIDENCE_CHANGED")
  const source = JSON.parse(await readFile(evidencePath(".local/t12-2/corpus-v4.json"), "utf8")) as FrozenCorpus
  const { corpusHash, ...sourcePayload } = source
  if (digest(sourcePayload) !== corpusHash || previous.corpusHash !== corpusHash) throw Error("REVIEW_CHECK_CONTEXT_CHANGED")
  const native = rows.find(row => row.caseId === "E01" && row.arm === "lowInterpreter")!
  const item = source.cases.find(item => item.id === "E01")!, original = item.context.planning.posts!
  if (!native?.result?.revisedPosts || native.contextHash !== digest({ input: item.input, context: item.context })) throw Error("REVIEW_CHECK_DRAFT_MISSING")
  const prior = { limits: DIAGNOSTIC_LIMITS, requests: combined.requests, serializedRequestBytes: combined.serializedRequestBytes,
    knownOutputTokens: combined.knownOutputTokens, unknownOutputReservation: combined.unknownOutputReservation, pendingOutputReservation: 0, elapsedMs: combined.elapsedExecutionMs }
  const limits = remainingBudget(DIAGNOSTIC_LIMITS, prior), budget = evaluationBudget(limits)
  await mkdir(directory)
  await writeFile(join(previousDirectory, "review-check-reservation.json"), JSON.stringify({ directory, limits, sourceReceiptsHash: previous.receiptsHash }), { flag: "wx" })
  await writeFile(join(directory, "attempts.jsonl"), "", { flag: "wx" })
  const runs: BrandModelRun[] = []; let writes = Promise.resolve()
  const reason = createBrandReasoner(async run => {
    writes = writes.then(() => appendFile(join(directory, "attempts.jsonl"), JSON.stringify(run) + "\n")); await writes; runs.push(run)
  }, { fetch: budget.fetch, model: current.configuration.reviewModel, requestTimeoutMs: 60000 })
  const payload = structuredClone(native.result.revisedPosts); delete payload.reviewEvidence; payload.review = null
  const revision: PostRevision = { id: item.input.id, noteId: item.input.id, ownerId: "evaluation-only", brandId: item.input.context.brandId,
    runId: original.runId, postKey: "p1", channel: "facebook", stablePostId: "evaluation:E01", version: 2, parentRevisionId: null,
    baseApprovalId: "controlled-start-not-real-approval", baseDigest: digest(original.payload), status: "running", run: item.context.planning.run!,
    before: original.payload, batch: { ...original, payload }, error: null, updatedAt: original.updatedAt }
  let reviewed = null, failure = null
  try { reviewed = await reviewPostRevision(revision, reason, runs) } catch (error) { failure = modelFailure(error) }
  await writes
  const snapshot = budget.snapshot()
  const result = { version: 1, mode: "live-review-contract-check", corpusHash: current.corpusHash, sourceCorpusHash: corpusHash,
    sourceReceiptsHash: previous.receiptsHash, sourceDraftDigest: digest(payload.copies), reviewed, failure, modelRuns: runs, budget: snapshot,
    finalStatus: reviewed ? weeklyReviewBlocker(reviewed.reviewEvidence!) ? "needsChanges" : "readyForHumanApproval" : "contractFailed",
    combinedBudget: { requests: prior.requests + snapshot.requests, serializedRequestBytes: prior.serializedRequestBytes + snapshot.serializedRequestBytes,
      knownOutputTokens: prior.knownOutputTokens + snapshot.knownOutputTokens, unknownOutputReservation: prior.unknownOutputReservation + snapshot.unknownOutputReservation,
      elapsedExecutionMs: prior.elapsedMs + snapshot.elapsedMs }, productionWrites: false, independentHumanQuality: "pending", monetaryCostUsd: null }
  await writeFile(join(directory, "result.json"), JSON.stringify(result, null, 2) + "\n", { flag: "wx" })
  console.log(JSON.stringify({ finalStatus: result.finalStatus, paidRequests: snapshot.requests, totalRequests: result.combinedBudget.requests }))
}
main().catch(error => { console.error(error instanceof Error ? error.message : "REVIEW_CHECK_FAILED"); process.exitCode = 1 })
