import { readFile } from "node:fs/promises"
import path from "node:path"
import { cases, referenceStatus } from "./cases.mjs"
import { MODEL, PROTOCOL, requestBody } from "./router.mjs"
import { root, hash, save } from "./common.mjs"
const codeHashes: Record<string, string> = {}
for (const file of ["experiments/jev-request-routing-phase-7e/router.mts", "experiments/jev-request-routing-phase-7e/cases.mts", "src/application/contextual-notes/model.ts", "src/infrastructure/postgres/contextual-notes-store.ts"]) codeHashes[file] = hash(await readFile(path.join(root, file)))
const payload = { sampleId: "unda-request-routing-controlled-v1", version: 1, createdAt: new Date().toISOString(), referenceStatus, model: MODEL, protocol: PROTOCOL,
 selection: "All 32 predeclared engineered cases, preserving every case and expectation; no provider-output selection. Stored notes with fixture-text matches are not natural real requests.",
 cases, requests: cases.map(c => ({ id: c.id, body: requestBody(c.input) })), codeHashes,
 runs: 3, orderAuditIds: ["C01", "C10", "C11", "C25", "C32"],
 derivation: "Descriptive native Choice and binary argmax only, with strict app-owned target/editability gates. Diagnostic candidates have no production authority. No production or calibrated probability cutoff chosen." }
const sampleHash = hash(JSON.stringify(payload))
await save("sample.json", { ...payload, sampleHash }, true)
await save("sample-manifest.json", { sampleId: payload.sampleId, sampleHash, createdAt: payload.createdAt, cases: cases.length, model: MODEL, protocol: PROTOCOL, runs: payload.runs, codeHashes, referenceStatus, naturalRealRequests: 0 }, true)
console.log(JSON.stringify({ sampleHash, cases: cases.length, runs: payload.runs, naturalRealRequests: 0 }))
