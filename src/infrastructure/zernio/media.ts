import { createHash } from "node:crypto"
import type { PublishableAsset } from "../../application/publishing/delivery-store"
import type { createZernioClient } from "./client"

export class ZernioMediaError extends Error {
  constructor(readonly code: "invalidProviderResponse" | "uploadFailed") {
    super(`Zernio media operation failed: ${code}`)
    this.name = "ZernioMediaError"
  }
}
const object = (value: unknown) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new ZernioMediaError("invalidProviderResponse")
  return value as Record<string, unknown>
}
const safeHttps = (value: unknown, publicUrl = false) => {
  if (typeof value !== "string" || value.length > 8000) throw new ZernioMediaError("invalidProviderResponse")
  let url: URL
  try { url = new URL(value) } catch { throw new ZernioMediaError("invalidProviderResponse") }
  if (url.protocol !== "https:" || url.username || url.password || (publicUrl && url.hostname !== "media.zernio.com")) throw new ZernioMediaError("invalidProviderResponse")
  return url.href
}

export function createZernioMediaUploader(client: ReturnType<typeof createZernioClient>, options: { fetch?: typeof fetch; timeoutMs?: number } = {}) {
  const uploadFetch = options.fetch ?? fetch
  const timeoutMs = options.timeoutMs ?? 30_000
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 120_000) throw new Error("Invalid media upload timeout")
  return {
    async upload(asset: PublishableAsset) {
      if (!asset.filename.trim() || asset.filename.length > 240 || asset.bytes.byteLength < 1 || asset.bytes.byteLength > 25_000_000) throw new ZernioMediaError("uploadFailed")
      const result = await client.request({ method: "POST", path: "media/presign", body: { filename: asset.filename,
        contentType: asset.contentType, size: asset.bytes.byteLength } })
      const data = object(result.data)
      const uploadUrl = safeHttps(data.uploadUrl)
      const providerPublicUrl = safeHttps(data.publicUrl, true)
      if (!Number.isInteger(data.expiresIn) || (data.expiresIn as number) < 1 || (data.expiresIn as number) > 86_400) throw new ZernioMediaError("invalidProviderResponse")
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), timeoutMs)
      try {
        const response = await uploadFetch(uploadUrl, { method: "PUT", redirect: "manual", signal: controller.signal,
          headers: { "Content-Type": asset.contentType }, body: Buffer.from(asset.bytes) })
        if (!response.ok || response.status < 200 || response.status >= 300) { await response.body?.cancel(); throw new ZernioMediaError("uploadFailed") }
        await response.body?.cancel()
      } catch (error) {
        if (error instanceof ZernioMediaError) throw error
        throw new ZernioMediaError("uploadFailed")
      } finally { clearTimeout(timer) }
      return { sourceAssetId: asset.sourceAssetId, mediaType: asset.contentType.startsWith("video/") ? "video" as const : "image" as const,
        contentSha256: createHash("sha256").update(asset.bytes).digest("hex"), providerPublicUrl,
        expiresAt: new Date(Date.now() + (data.expiresIn as number) * 1000).toISOString() }
    },
  }
}
