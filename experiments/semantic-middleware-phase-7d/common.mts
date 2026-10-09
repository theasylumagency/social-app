import { readFile, writeFile, mkdir } from "node:fs/promises"
import { createHash } from "node:crypto"
import { parseEnv } from "node:util"
import { fileURLToPath } from "node:url"
import path from "node:path"
import { semanticShadowSettings } from "../../src/infrastructure/models/semantic-shadow-config"
export const experiment = fileURLToPath(new URL("./", import.meta.url))
export const root = path.resolve(experiment, "../..")
export const sha256 = (value: string | Buffer) => createHash("sha256").update(value).digest("hex")
export async function json(file: string) { return JSON.parse((await readFile(path.join(experiment, file), "utf8")).replace(/^\uFEFF/, "")) }
export async function save(file: string, data: unknown, immutable = false) {
  const resolved = path.resolve(experiment, file)
  if (!resolved.startsWith(experiment)) throw Error("EXPERIMENT_PATH")
  await mkdir(path.dirname(resolved), { recursive: true })
  await writeFile(resolved, JSON.stringify(data, null, 2) + "\n", { flag: immutable ? "wx" : "w", mode: 0o600 })
}
export async function environment() {
  const load = async (file: string) => { try { return parseEnv(await readFile(file, "utf8")) } catch { return {} } }
  const local = await load(path.join(root, ".env.local")), benchmark = await load(path.join(root, "../unda-semantic-benchmark/.env.local"))
  const apiKey = process.env.SEMANTIC_MIDDLEWARE_SHADOW_JEV_API_KEY ?? local.SEMANTIC_MIDDLEWARE_SHADOW_JEV_API_KEY ?? process.env.JEV_API_KEY ?? benchmark.JEV_API_KEY
  const settings = semanticShadowSettings({ SEMANTIC_MIDDLEWARE_SHADOW_ENABLED: "true", SEMANTIC_MIDDLEWARE_SHADOW_PROVIDER: "jev", SEMANTIC_MIDDLEWARE_SHADOW_MODEL: "jev-1.13.0",
    SEMANTIC_MIDDLEWARE_SHADOW_JEV_API_KEY: apiKey, SEMANTIC_MIDDLEWARE_SHADOW_TRACE_PATH: ".local/semantic-shadow/phase7d.jsonl", SEMANTIC_MIDDLEWARE_SHADOW_TIMEOUT_MS: "2000", SEMANTIC_MIDDLEWARE_SHADOW_BUDGET_MS: "5000", SEMANTIC_MIDDLEWARE_SHADOW_MAX_TASKS: "5",
    SEMANTIC_MIDDLEWARE_SHADOW_INPUT_USD_PER_M: "0.042", SEMANTIC_MIDDLEWARE_SHADOW_OUTPUT_USD_PER_M: "0" }, root)
  return { settings, databaseUrl: process.env.DATABASE_URL ?? local.DATABASE_URL,
    rateSource: { url: "https://docs.typesafe.ai/models", checkedAt: "2026-10-06", kind: "published-rate-estimate-not-invoice" } }
}
