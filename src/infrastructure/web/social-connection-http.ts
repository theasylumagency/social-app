import { ConnectionFlowError } from "../../application/social-connections/connection-flow"
import type { SocialConnectionService } from "../../application/social-connections/service"

const privateHeaders = { "cache-control": "private, no-store", "referrer-policy": "no-referrer" }
type Session = { user: { id: string; emailVerified: boolean } }
type Dependencies = {
  authenticate(request: Request): Promise<{ error: Response } | { session: Session }>
  session(request: Request): Promise<Session | null>
  service(): SocialConnectionService
  origin(): string
  rememberBrand(brandId: string): Promise<void>
}

async function body(request: Request): Promise<Record<string, unknown>> {
  const reader = request.body?.getReader()
  if (!reader) throw new ConnectionFlowError("invalidFlow")
  const chunks: Uint8Array[] = []
  let size = 0
  try {
    while (true) {
      const chunk = await reader.read()
      if (chunk.done) break
      size += chunk.value.byteLength
      if (size > 4000) { await reader.cancel(); throw new ConnectionFlowError("invalidFlow") }
      chunks.push(chunk.value)
    }
    const value: unknown = JSON.parse(Buffer.concat(chunks).toString("utf8"))
    if (!value || typeof value !== "object" || Array.isArray(value)) throw Error()
    return value as Record<string, unknown>
  } catch { throw new ConnectionFlowError("invalidFlow") }
  finally { reader.releaseLock() }
}
function failure(error: unknown) {
  const code = error instanceof ConnectionFlowError ? error.code : "unavailable"
  return Response.json({ code, message: code === "expired" ? "კავშირის დრო ამოიწურა. დაიწყეთ თავიდან." : code === "rateLimited"
    ? "დაკავშირების ბევრი მცდელობაა. მოგვიანებით სცადეთ." : "ანგარიშის დაკავშირება ვერ დასრულდა. სცადეთ თავიდან." },
  { status: code === "unavailable" ? 503 : code === "rateLimited" ? 429 : 422, headers: privateHeaders })
}

/** Shared request adapter keeps production auth hooks and tests on the same route logic. */
export function createSocialConnectionHttp(deps: Dependencies) {
  return {
    async begin(request: Request, platform: string) {
      const access = await deps.authenticate(request)
      if ("error" in access) return access.error
      try {
        if (platform !== "facebook" && platform !== "instagram") throw new ConnectionFlowError("invalidFlow")
        const input = await body(request)
        if (typeof input.brandId !== "string" || (input.accountId !== undefined && (typeof input.accountId !== "string" || input.accountId.length > 160))) throw new ConnectionFlowError("invalidFlow")
        return Response.json(await deps.service().begin(access.session.user.id, input.brandId, platform, input.accountId as string | undefined ?? null), { headers: privateHeaders })
      } catch (error) { return failure(error) }
    },
    async callback(request: Request) {
      const origin = deps.origin()
      const session = await deps.session(request)
      let location = new URL("/workspace/connections?connection=failed", origin)
      if (!session?.user.emailVerified) location = new URL("/login?next=%2Fworkspace%2Fconnections", origin)
      else {
        try {
          if (request.url.length > 24_000) throw new ConnectionFlowError("invalidFlow")
          const query = new URL(request.url).searchParams
          for (const key of query.keys()) if (query.getAll(key).length > 1) throw new ConnectionFlowError("invalidFlow")
          const result = await deps.service().callback(session.user.id, query)
          await deps.rememberBrand(result.brandId)
          location = new URL("/workspace/connections", origin)
          if (result.type === "selection") location.searchParams.set("intent", result.intentId)
          else location.searchParams.set("connection", "connected")
        } catch { /* The provider callback URL and error data must never be reflected. */ }
      }
      return new Response(null, { status: 303, headers: { ...privateHeaders, location: location.href } })
    },
    async pages(request: Request) {
      const session = await deps.session(request)
      if (!session?.user.emailVerified) return Response.json({ message: "გაგრძელებისთვის შედით ანგარიშში." }, { status: 401, headers: privateHeaders })
      try { return Response.json(await deps.service().pages(session.user.id, new URL(request.url).searchParams.get("intent") ?? ""), { headers: privateHeaders }) }
      catch (error) { return failure(error) }
    },
    async select(request: Request) {
      const access = await deps.authenticate(request)
      if ("error" in access) return access.error
      try {
        const input = await body(request)
        if (typeof input.intentId !== "string" || typeof input.pageId !== "string" || input.pageId.length > 160) throw new ConnectionFlowError("invalidFlow")
        const result = await deps.service().selectPage(access.session.user.id, input.intentId, input.pageId)
        await deps.rememberBrand(result.brandId)
        return Response.json({ redirect: "/workspace/connections?connection=connected" }, { headers: privateHeaders })
      } catch (error) { return failure(error) }
    },
  }
}
