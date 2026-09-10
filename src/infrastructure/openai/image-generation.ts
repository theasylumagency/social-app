import sharp from "sharp"
import { VISUAL_PROVIDER_TIMEOUT_MS, VisualError } from "../../application/visuals/policy"
import type { GeneratedVisual, VisualInput } from "../../application/visuals/types"

type ImageRequest = { prompt: string; model: string; quality: "low" | "medium" | "high"; aspectRatio: VisualInput["aspectRatio"] }
export async function generateImageFromPrompt(input: ImageRequest, options: { apiKey?: string; fetch?: typeof fetch } = {}): Promise<GeneratedVisual> {
  const key = options.apiKey ?? process.env.OPENAI_API_KEY
  if (!key) throw new VisualError("not_configured", "გამოსახულების სერვისი ჯერ არ არის გამართული.", 503)
  const response = await (options.fetch ?? fetch)("https://api.openai.com/v1/images/generations", {
    method: "POST", headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
    body: JSON.stringify({ model: input.model, prompt: input.prompt, n: 1, quality: input.quality,
      size: input.aspectRatio === "4:5" ? "1024x1280" : input.aspectRatio === "9:16" ? "864x1536" : "1024x1024", output_format: "webp" }),
    signal: AbortSignal.timeout(VISUAL_PROVIDER_TIMEOUT_MS),
  })
  if (!response.ok) {
    await response.body?.cancel()
    throw new VisualError(`provider_${response.status}`, response.status === 429
      ? "სურათების სერვისი დატვირთულია. კრედიტი არ ჩამოჭრილა; მოგვიანებით სცადეთ."
      : "სურათების სერვისმა მოთხოვნა ვერ შეასრულა. კრედიტი არ ჩამოჭრილა; სცადეთ სხვა აღწერა ან მოგვიანებით.", 502)
  }
  const reader = response.body?.getReader()
  if (!reader) throw Error("Empty image response")
  const chunks: Uint8Array[] = []; let bytes = 0
  while (true) {
    const { value, done } = await reader.read(); if (done) break
    bytes += value.length
    if (bytes > 16 * 1024 * 1024) { await reader.cancel(); throw Error("Image response too large") }
    chunks.push(value)
  }
  const body = JSON.parse(Buffer.concat(chunks).toString("utf8")) as { id?: unknown; model?: unknown; data?: { b64_json?: unknown; id?: unknown }[]; usage?: unknown }
  const item = body.data?.[0]
  if (typeof item?.b64_json !== "string" || !item.b64_json.length || !/^[A-Za-z0-9+/]+={0,2}$/.test(item.b64_json)) throw new VisualError("no_image", "სერვისმა გამოსახულება არ დააბრუნა. კრედიტი არ ჩამოჭრილა.", 502)
  // File validation/normalization only; no aesthetic scoring or automatic generation retries.
  const source = sharp(Buffer.from(item.b64_json, "base64"), { limitInputPixels: 20_000_000, animated: false })
  const meta = await source.metadata()
  if (!["webp", "png", "jpeg"].includes(meta.format ?? "") || (meta.pages ?? 1) !== 1) throw Error("Invalid image data")
  const { data, info } = await source.rotate().webp({ quality: 90 }).toBuffer({ resolveWithObject: true })
  if (data.length > 8 * 1024 * 1024) throw Error("Image asset too large")
  return { content: data, width: info.width, height: info.height, providerRequestId: response.headers.get("x-request-id"),
    providerAssetId: typeof item.id === "string" ? item.id : typeof body.id === "string" ? body.id : null,
    providerCostUsd: null, metadata: { usage: body.usage ?? null, returnedModel: typeof body.model === "string" ? body.model : input.model } }
}
