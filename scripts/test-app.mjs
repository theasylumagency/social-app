import { readdirSync } from "node:fs"
import { spawnSync } from "node:child_process"
import { fileURLToPath } from "node:url"

const root = fileURLToPath(new URL("../", import.meta.url))
const integration = process.argv.includes("--integration")
if (integration) {
  const url = process.env.DATABASE_URL ? new URL(process.env.DATABASE_URL) : null
  if (!url || !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)) {
    throw new Error("App integration tests require a local PostgreSQL DATABASE_URL; remote databases are not accepted.")
  }
}
const files = readdirSync(new URL("../tests/", import.meta.url))
  .filter(name => name.endsWith(".test.mts") && !name.endsWith(".live.test.mts"))
  .filter(name => name.endsWith(".integration.test.mts") === integration)
  .sort().map(name => `tests/${name}`)
if (!files.length) throw new Error("No application tests discovered")
console.log(`Running ${files.length} ${integration ? "isolated integration" : "offline application"} test files`)
const result = spawnSync(process.execPath, ["--import", "tsx", "--test", "--test-concurrency=1", "--test-reporter=tap", ...files], {
  cwd: root, env: process.env, encoding: "utf8", maxBuffer: 32 * 1024 * 1024,
})
process.stdout.write(result.stdout ?? "")
process.stderr.write(result.stderr ?? "")
if (result.error) throw result.error
if (integration && /^# skipped [1-9][0-9]*$/m.test(result.stdout ?? "")) {
  console.error("Integration verification contains skipped tests; it is not a complete verification.")
  process.exitCode = 1
} else process.exitCode = result.status ?? 1
