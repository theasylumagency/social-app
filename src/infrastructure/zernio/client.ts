import type { ZernioEnvironment } from "./environment"

export type ZernioClientErrorCode = "invalidRequest" | "requestTooLarge" | "responseTooLarge" | "timeout" | "transport" | "http" | "invalidResponse"

/** Never retains a URL, request/response body, headers, or the original transport error. */
export class ZernioClientError extends Error {
  constructor(readonly code: ZernioClientErrorCode, readonly status: number | null = null) {
    super(`Zernio request failed: ${code}${status === null ? "" : ` (${status})`}`)
    this.name = "ZernioClientError"
  }
}

export type ZernioRequest = {
  readonly method: "GET" | "POST"
  /** Relative endpoint without query, leading slash, or traversal segments. */
  readonly path: string
  readonly query?: Readonly<Record<string, string>>
  readonly body?: unknown
}

export type ZernioClientOptions = {
  readonly fetch?: typeof fetch
  readonly timeoutMs?: number
  readonly maxRequestBytes?: number
  readonly maxResponseBytes?: number
}

function boundedOption(value: number | undefined, fallback: number, max: number) {
  const result = value ?? fallback
  if (!Number.isSafeInteger(result) || result < 1 || result > max) throw new Error("Invalid Zernio client resource limit")
  return result
}

/** Transport foundation. No endpoint-specific behavior, retries, or publication calls. */
export function createZernioClient(config: ZernioEnvironment, options: ZernioClientOptions = {}) {
  if (!config.apiKey) throw new Error("ZERNIO_API_KEY is required for provider requests")
  const fetchRequest = options.fetch ?? fetch
  const timeoutMs = boundedOption(options.timeoutMs, 15_000, 120_000)
  const maxRequestBytes = boundedOption(options.maxRequestBytes, 256_000, 1_000_000)
  const maxResponseBytes = boundedOption(options.maxResponseBytes, 1_000_000, 10_000_000)
  const authorization = `Bearer ${config.apiKey}`
  const base = new URL(`${config.apiBaseUrl}/`)

  return {
    async request(input: ZernioRequest): Promise<{ readonly status: number; readonly data: unknown }> {
      if (!/^[A-Za-z0-9_-]+(?:\/[A-Za-z0-9_-]+)*$/u.test(input.path)
        || !["GET", "POST"].includes(input.method) || (input.method === "GET" && input.body !== undefined)) {
        throw new ZernioClientError("invalidRequest")
      }
      const url = new URL(input.path, base)
      for (const [key, value] of Object.entries(input.query ?? {})) url.searchParams.set(key, value)
      let body: string | undefined
      try { body = input.body === undefined ? undefined : JSON.stringify(input.body) }
      catch { throw new ZernioClientError("invalidRequest") }
      if (Buffer.byteLength(url.href) + Buffer.byteLength(body ?? "") > maxRequestBytes) throw new ZernioClientError("requestTooLarge")
      const controller = new AbortController()
      let timer: ReturnType<typeof setTimeout> | undefined
      const deadline = new Promise<never>((_, reject) => {
        timer = setTimeout(() => { reject(new ZernioClientError("timeout")); controller.abort() }, timeoutMs)
      })
      const execute = async () => {
        const response = await fetchRequest(url, {
          method: input.method, signal: controller.signal, redirect: "manual", cache: "no-store",
          headers: { Authorization: authorization, Accept: "application/json", ...(body === undefined ? {} : { "Content-Type": "application/json" }) },
          ...(body === undefined ? {} : { body }),
        })
        // Never follow a redirect carrying credentials, or expose an error response body.
        if (!response.ok) {
          await response.body?.cancel()
          throw new ZernioClientError("http", response.status)
        }
        const declaredSize = response.headers.get("content-length")
        if (declaredSize !== null && Number(declaredSize) > maxResponseBytes) {
          await response.body?.cancel()
          throw new ZernioClientError("responseTooLarge", response.status)
        }
        const reader = response.body?.getReader()
        const chunks: Uint8Array[] = []
        let size = 0
        const cancel = () => { void reader?.cancel().catch(() => undefined) }
        controller.signal.addEventListener("abort", cancel, { once: true })
        try {
          if (controller.signal.aborted) throw new ZernioClientError("timeout")
          if (reader) {
            while (true) {
              const part = await reader.read()
              if (part.done) break
              size += part.value.byteLength
              if (size > maxResponseBytes) {
                await reader.cancel()
                throw new ZernioClientError("responseTooLarge", response.status)
              }
              chunks.push(part.value)
            }
          }
        } finally {
          controller.signal.removeEventListener("abort", cancel)
          reader?.releaseLock()
        }
        if (response.status === 204) return { status: response.status, data: null }
        try { return { status: response.status, data: JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown } }
        catch { throw new ZernioClientError("invalidResponse", response.status) }
      }
      try { return await Promise.race([execute(), deadline]) }
      catch (error) {
        if (error instanceof ZernioClientError) throw error
        throw new ZernioClientError(controller.signal.aborted ? "timeout" : "transport")
      } finally { clearTimeout(timer) }
    },
  }
}
