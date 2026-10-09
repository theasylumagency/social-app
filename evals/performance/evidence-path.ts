import { resolve, relative, isAbsolute, sep } from "node:path"
/** Experiment artifacts only; callers must also use exclusive file/directory creation. */
export function evidencePath(path: string) {
  const out = resolve(path), rel = relative(resolve(".local/t12-2"), out)
  if (!rel || rel.startsWith("..") || isAbsolute(rel) || rel.split(sep).some(part => part.startsWith("."))) throw Error("T12_2_LOCAL_EVIDENCE_PATH_REQUIRED")
  return out
}
