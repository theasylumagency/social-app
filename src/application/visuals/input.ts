import { VisualError } from "./policy"
import type { VisualInput } from "./types"

export const visualUuid = (value: unknown): value is string => typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
export function parseVisualInput(value: unknown): VisualInput {
  const invalid = () => new VisualError("invalid_input", "შეამოწმეთ აღწერა და არჩეული პოსტი.", 400)
  if (!value || typeof value !== "object" || Array.isArray(value)) throw invalid()
  const v = value as Record<string, unknown>
  if (!visualUuid(v.requestId) || typeof v.prompt !== "string" || !v.prompt.trim() || v.prompt.length > 4000) throw invalid()
  if (v.brandId !== undefined && (typeof v.brandId !== "string" || !v.brandId.trim() || v.brandId.length > 160)) throw invalid()
  if (v.aspectRatio !== undefined && !["1:1", "4:5", "9:16"].includes(String(v.aspectRatio))) throw invalid()
  if (v.requestKind !== undefined && v.requestKind !== "generate" && v.requestKind !== "regenerate") throw invalid()
  let target: VisualInput["target"] = null
  if (v.target !== undefined) {
    if (!v.target || typeof v.target !== "object" || Array.isArray(v.target)) throw invalid()
    const t = v.target as Record<string, unknown>
    if (!visualUuid(t.runId) || typeof t.postKey !== "string" || !/^p([1-9]|10)$/.test(t.postKey) || typeof t.slot !== "number" || !Number.isInteger(t.slot) || t.slot < 0 || t.slot > 5) throw invalid()
    target = { runId: t.runId, postKey: t.postKey, slot: t.slot }
  }
  return { requestId: v.requestId, prompt: v.prompt.trim(), brandId: typeof v.brandId === "string" ? v.brandId : null,
    aspectRatio: (v.aspectRatio ?? "1:1") as VisualInput["aspectRatio"], requestKind: v.requestKind === "regenerate" ? "regenerate" : "generate", target }
}

/** A stream limit is required even when Content-Length is missing or incorrect. */
export async function readVisualJson(request: Request) {
  const reader = request.body?.getReader()
  if (!reader) throw new VisualError("invalid_input", "მოთხოვნა ცარიელია.", 400)
  const chunks: Uint8Array[] = []; let bytes = 0
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    bytes += value.length
    if (bytes > 24_000) { await reader.cancel(); throw new VisualError("too_large", "აღწერა ზედმეტად დიდია.", 413) }
    chunks.push(value)
  }
  try { return JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown }
  catch { throw new VisualError("invalid_input", "მონაცემების ფორმატი არასწორია.", 400) }
}
