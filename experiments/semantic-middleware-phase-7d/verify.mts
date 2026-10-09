import { readFile } from "node:fs/promises"
import path from "node:path"
import { execFileSync } from "node:child_process"
import { parseEnv } from "node:util"
import { json, root, save, sha256 } from "./common.mjs"
import { semanticShadowSettings } from "../../src/infrastructure/models/semantic-shadow-config"
import { verifyFrozen } from "./review.mjs"
const baseline = await json("integrity/baseline.json") as { repositories: Record<string, { files: Record<string, string>; head: string }> }
const repositories = { unda: root, benchmark: path.resolve(root, "../unda-semantic-benchmark") }
const results = []
for (const [name, directory] of Object.entries(repositories)) {
 const before = baseline.repositories[name]!
 const changed = []
 for (const [file, hash] of Object.entries(before.files)) {
  try { if (sha256(await readFile(path.join(directory, file))) !== hash) changed.push(file) } catch { changed.push(file) }
 }
 const git = (...args: string[]) => execFileSync("git", ["-c", `safe.directory=${directory}`, "-C", directory, ...args], { windowsHide: true }).toString("utf8")
 const head = git("rev-parse", "HEAD").trim()
 const names = git("ls-files", "--cached", "--others", "--exclude-standard", "-z").split("\0").filter(Boolean)
 const added = [...new Set(names)].filter(f => !(f in before.files))
 const outsideScope = added.filter(f => name !== "unda" || !f.startsWith("experiments/semantic-middleware-phase-7d/"))
 results.push({ repository: name, originalFilesChecked: Object.keys(before.files).length, originalFileChanges: changed, headUnchanged: head === before.head, newFilesOutsideScope: outsideScope, isolatedNewFiles: added.length, createdFiles: added.sort() })
}
const local = parseEnv(await readFile(path.join(root, ".env.local"), "utf8"))
const productionShadowEnabled = semanticShadowSettings(local, root).enabled
await verifyFrozen()
const passed = !productionShadowEnabled && results.every(r => !r.originalFileChanges.length && r.headUnchanged && !r.newFilesOutsideScope.length)
await save("integrity/verification.json", { checkedAt: new Date().toISOString(), passed, productionShadowEnabled, frozenSampleAndProtocolVerified: true, results })
console.log(JSON.stringify({ passed, productionShadowEnabled, results: results.map(r => ({repository:r.repository,originalFilesChecked:r.originalFilesChecked,originalFileChanges:r.originalFileChanges,headUnchanged:r.headUnchanged,newFilesOutsideScope:r.newFilesOutsideScope,isolatedNewFiles:r.isolatedNewFiles})) }))
if (!passed) process.exitCode = 1
