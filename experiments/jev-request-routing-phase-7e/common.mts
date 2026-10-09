import { readFile, writeFile, mkdir } from "node:fs/promises"
import { createHash } from "node:crypto"
import { parseEnv } from "node:util"
import { fileURLToPath } from "node:url"
import path from "node:path"
export const experiment = fileURLToPath(new URL("./", import.meta.url)), root = path.resolve(experiment, "../..")
export const hash = (text: string | Buffer) => createHash("sha256").update(text).digest("hex")
export async function json(file: string) { return JSON.parse((await readFile(path.join(experiment, file), "utf8")).replace(/^\uFEFF/, "")) }
export async function save(file: string, value: unknown, once = false) {
 const destination = path.resolve(experiment, file)
 if (!destination.startsWith(experiment)) throw Error("EXPERIMENT_PATH")
 await mkdir(path.dirname(destination), { recursive: true })
 await writeFile(destination, JSON.stringify(value, null, 2) + "\n", { flag: once ? "wx" : "w", mode: 0o600 })
}
export async function environment() {
 const load = async (file: string) => { try { return parseEnv(await readFile(file, "utf8")) } catch { return {} } }
 const local = await load(path.join(root, ".env.local")), benchmark = await load(path.join(root, "../unda-semantic-benchmark/.env.local"))
 return { databaseUrl: process.env.DATABASE_URL ?? local.DATABASE_URL,
  jevKey: process.env.JEV_API_KEY ?? process.env.SEMANTIC_MIDDLEWARE_SHADOW_JEV_API_KEY ?? local.SEMANTIC_MIDDLEWARE_SHADOW_JEV_API_KEY ?? benchmark.JEV_API_KEY }
}
export async function baselineEnvironment() {
 const local = parseEnv(await readFile(path.join(root, ".env.local"), "utf8"))
 return { apiKey: process.env.OPENAI_API_KEY ?? local.OPENAI_API_KEY, model: process.env.OPENAI_CONTEXTUAL_NOTES_MODEL ?? local.OPENAI_CONTEXTUAL_NOTES_MODEL ?? process.env.OPENAI_BRAND_MODEL ?? local.OPENAI_BRAND_MODEL ?? "gpt-5.6-terra" }
}
