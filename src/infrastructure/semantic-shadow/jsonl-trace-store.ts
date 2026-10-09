import { mkdir, writeFile, lstat } from "node:fs/promises"
import path from "node:path"
import type { ShadowTraceSink } from "../../blueprints/social/semantic-middleware/shadow"

/** Worker-local append-only evaluation store. No application read/policy path. */
export function createShadowJsonlSink(file: string): ShadowTraceSink {
  return { async append(trace, signal) {
    if (signal.aborted) return
    await mkdir(path.dirname(file), { recursive: true, mode: 0o700 })
    // Refuse a pre-existing symlink; collector/config never writes arbitrary workflow files.
    try { if ((await lstat(file)).isSymbolicLink()) throw Error("SHADOW_TRACE_LINK") }
    catch (error) { if (!(error && typeof error === "object" && "code" in error && error.code === "ENOENT")) throw error }
    if (!signal.aborted) await writeFile(file, JSON.stringify(trace) + "\n", { flag: "a", encoding: "utf8", mode: 0o600, signal })
  } }
}
