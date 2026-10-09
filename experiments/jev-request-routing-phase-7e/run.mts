import { readFile, writeFile, mkdir } from "node:fs/promises"
import path from "node:path"
import { environment, experiment, root, json, hash, save } from "./common.mjs"
import { classify, diagnosticCandidate, RoutingProviderError, type RoutingResult } from "./router.mjs"
import type { ProbeCase } from "./cases.mjs"
const sample = await json("sample.json")
const { sampleHash, ...payload } = sample
if (hash(JSON.stringify(payload)) !== sampleHash) throw Error("FROZEN_SAMPLE_CHANGED")
for (const [file, expected] of Object.entries(sample.codeHashes as Record<string, string>)) if (hash(await readFile(path.join(root, file))) !== expected) throw Error("FROZEN_PROTOCOL_CHANGED")
const { jevKey } = await environment()
if (!jevKey) throw Error("JEV_KEY_MISSING")
await mkdir(path.join(experiment, "results"), { recursive: true })
await writeFile(path.join(experiment, "results/run-start.json"), JSON.stringify({ startedAt: new Date().toISOString(), sampleHash, maxRequests: 101, provider: "jevOnly", controlledOnly: true }) + "\n", { flag: "wx", mode: 0o600 })
const records: unknown[] = []
let stop = false
const run = async (c: ProbeCase, runNumber: number, orderAudit = false) => {
 let native: unknown = null, result: RoutingResult | null = null, failure: { code: string; httpStatus?: number } | null = null
 const captureFetch: typeof fetch = async (url, init) => {
  const response = await fetch(url, init)
  if (response.ok) { try { const raw = await response.clone().json(); native = { model: raw.model ?? null, answers: raw.answers ?? null, usage: raw.usage ?? null } } catch { native = { nonJson: true } } }
  return response
 }
 const started = performance.now()
 try { result = await classify(c.input, jevKey, AbortSignal.timeout(3000), orderAudit, captureFetch) }
 catch (error) {
  failure = error instanceof RoutingProviderError ? { code: error.code, ...(error.httpStatus === undefined ? {} : { httpStatus: error.httpStatus }) } : { code: error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError") ? "timeout" : "providerException" }
  if (failure.code === "schema" || failure.httpStatus === 401 || failure.httpStatus === 422) stop = true
 }
 const record = { sampleHash, caseId: c.id, run: runNumber, orderAudit, requestedDecisions: 4, latencyMs: performance.now() - started, result, native, failure,
  diagnostic: diagnosticCandidate(c.input, result), estimatedCostUsd: result ? result.usage.input_tokens * 0.042 / 1_000_000 : null }
 records.push(record)
 await writeFile(path.join(experiment, "results/requests.jsonl"), JSON.stringify(record) + "\n", { flag: "a", mode: 0o600 })
}
for (let pass = 1; pass <= sample.runs; pass++) {
 for (const c of sample.cases as ProbeCase[]) { await run(c, pass); if (stop) break }
 console.log(JSON.stringify({ completePass: stop ? null : pass, requestsRecorded: records.length, stoppedForProtocolFailure: stop }))
 if (stop) break
}
if (!stop) for (const id of sample.orderAuditIds as string[]) { await run((sample.cases as ProbeCase[]).find(c => c.id === id)!, 1, true); if (stop) break }
await save("results/execution.json", { completedAt: new Date().toISOString(), sampleHash, plannedPrimaryRequests: sample.cases.length * sample.runs, plannedOrderAuditRequests: sample.orderAuditIds.length, actualRequests: records.length, stoppedForProtocolFailure: stop, productionStateChanged: false }, true)
console.log(JSON.stringify({ recordedRequests: records.length, stoppedForProtocolFailure: stop }))
if (stop) process.exitCode = 1
