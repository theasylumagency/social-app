import { readFile } from "node:fs/promises"
import path from "node:path"
import { root, hash, json, save } from "./common.mjs"
const first = await json("sample.json"), { sampleHash: previousHash, ...payload } = first
if (hash(JSON.stringify(payload)) !== previousHash) throw Error("ORIGINAL_SAMPLE_CHANGED")
for (const [file, expected] of Object.entries(first.codeHashes as Record<string, string>)) if (hash(await readFile(path.join(root, file))) !== expected) throw Error("ORIGINAL_PROTOCOL_CHANGED")
const revised = { ...payload, sampleId: "unda-request-routing-controlled-v2", version: 2, createdAt: new Date().toISOString(), previousSampleHash: previousHash,
 correction: "Transport validation only: native Choice probabilities rounded to two decimals can sum to 0.99. Allow the mathematical rounding bound, preserving all raw values. No semantic prompts, cases, expectations or diagnostic gates changed.",
 codeHashes: { ...first.codeHashes, "experiments/jev-request-routing-phase-7e/transport-v2.mts": hash(await readFile(path.join(root, "experiments/jev-request-routing-phase-7e/transport-v2.mts"))) } }
const sampleHash = hash(JSON.stringify(revised))
await save("sample-v2.json", { ...revised, sampleHash }, true)
console.log(JSON.stringify({ sampleHash, previousHash, correction: "nativeProbabilityRoundingOnly", cases: first.cases.length }))
