import { resolve, relative, isAbsolute } from "node:path"

/** Every repeat gets a new filename; callers write with wx to preserve earlier evidence. */
export function evaluationReportPath(defaultPath: string) {
  const args = process.argv.slice(2)
  if (args.length && (args.length !== 2 || args[0] !== "--out" || !args[1])) throw Error("USAGE: --out <new-workspace-report.json>")
  const out = resolve(args[1] ?? defaultPath), taskRelative = relative(process.cwd(), out)
  if (!taskRelative || taskRelative.startsWith("..") || isAbsolute(taskRelative) || !out.endsWith(".json")
    || taskRelative.split(/[\\/]/u).some(part => part.startsWith(".") && part !== ".local")) throw Error("WORKSPACE_REPORT_PATH_REQUIRED")
  return out
}
