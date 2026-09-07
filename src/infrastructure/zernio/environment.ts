import { authOrigin } from "../../lib/auth/environment"

export type ZernioEnvironment = {
  readonly publishingEnabled: boolean
  readonly apiBaseUrl: string
  readonly apiKey: string | null
  readonly webhookSecret: string | null
  readonly connectionContextKey: string | null
  readonly applicationOrigin: string
}

/** Server configuration only; call from the future server/worker composition root. */
export function readZernioEnvironment(env: NodeJS.ProcessEnv = process.env): ZernioEnvironment {
  const flag = env.SOCIAL_PUBLISHING_ENABLED ?? "false"
  if (flag !== "true" && flag !== "false") throw new Error("SOCIAL_PUBLISHING_ENABLED must be true or false")
  const publishingEnabled = flag === "true"
  let url: URL
  try { url = new URL(env.ZERNIO_API_BASE_URL ?? "https://zernio.com/api/v1") }
  catch { throw new Error("ZERNIO_API_BASE_URL is invalid") }
  const productionEndpoint = url.origin === "https://zernio.com" && url.pathname.replace(/\/$/, "") === "/api/v1"
  const localEndpoint = env.NODE_ENV !== "production" && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)
    && ["http:", "https:"].includes(url.protocol) && url.pathname.replace(/\/$/, "") === "/api/v1"
  if ((!productionEndpoint && !localEndpoint) || url.username || url.password || url.search || url.hash) {
    throw new Error("ZERNIO_API_BASE_URL must use the approved API endpoint (local test servers are allowed outside production)")
  }
  const secret = (name: string) => {
    const value = env[name]?.trim() || null
    if (value && /[\r\n\u0000]/u.test(value)) throw new Error(`${name} is invalid`)
    return value
  }
  const apiKey = secret("ZERNIO_API_KEY")
  const webhookSecret = secret("ZERNIO_WEBHOOK_SECRET")
  const connectionContextKey = secret("SOCIAL_CONNECTION_CONTEXT_KEY")
  if (connectionContextKey && (!/^[A-Za-z0-9+/]{43}=$/u.test(connectionContextKey)
    || Buffer.from(connectionContextKey, "base64").length !== 32
    || Buffer.from(connectionContextKey, "base64").toString("base64") !== connectionContextKey)) {
    throw new Error("SOCIAL_CONNECTION_CONTEXT_KEY must be a base64-encoded 32-byte key")
  }
  if (publishingEnabled && (!apiKey || !webhookSecret || !connectionContextKey)) {
    throw new Error("Social publishing requires ZERNIO_API_KEY, ZERNIO_WEBHOOK_SECRET and SOCIAL_CONNECTION_CONTEXT_KEY")
  }
  // Reuse the app's canonical-origin policy instead of introducing another origin.
  let applicationOrigin: string
  try { applicationOrigin = authOrigin(env) }
  catch { throw new Error("BETTER_AUTH_URL must be a valid application origin") }
  return { publishingEnabled, apiBaseUrl: url.href.replace(/\/$/, ""), apiKey, webhookSecret, connectionContextKey, applicationOrigin }
}
