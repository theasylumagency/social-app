import { randomBytes } from "node:crypto"
import { appendFile, readFile } from "node:fs/promises"

const file = new URL("../../.env.local", import.meta.url)
const existing = await readFile(file, "utf8")
const defaults = {
  BETTER_AUTH_SECRET: randomBytes(48).toString("base64url"),
  BETTER_AUTH_URL: "http://localhost:3000",
  AUTH_EMAIL_MODE: "preview",
}
const additions = Object.entries(defaults).filter(([key]) => !new RegExp(`^${key}=`, "m").test(existing))
if (additions.length) await appendFile(file, `\n${additions.map(([key, value]) => `${key}=${value}`).join("\n")}\n`)
console.log("Local authentication defaults initialized; existing settings preserved.")
