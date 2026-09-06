import { after } from "next/server"
import { authenticateWorkRequest, currentSession } from "../../_server/auth"
import { getDatabasePool } from "../../_server/database"
import { rememberBrand } from "../../_server/active-brand"
import { ensurePersonalWorkspace } from "../../../infrastructure/postgres/workspace-store"
import { confirmDiscovery, DiscoveryConflict, isDiscoveryId, readDiscovery, retryDiscovery, reviseDiscovery, saveDiscoveryDraft, startDiscovery } from "../../../infrastructure/postgres/brand-discovery-store"
import { runBrandDiscovery } from "../../../worker/brand-discovery"
import type { DiscoverySession } from "../../../blueprints/social/brand-discovery/model"

export const runtime = "nodejs"
export const maxDuration = 300

function publicSession(session: DiscoverySession | null) {
  return session ? { ...session, payload: { ...session.payload, sources: session.payload.sources.map((source) => ({ ...source, text: "" })) } } : null
}
export async function GET(request: Request) {
  const session = await currentSession()
  if (!session?.user.emailVerified) return Response.json({ message: "გაგრძელებისთვის შედით ანგარიშში." }, { status: 401 })
  const query = new URL(request.url).searchParams
  const id = query.get("id")
  const brand = query.get("brand")
  if ((id && !isDiscoveryId(id)) || (brand && brand.length > 160)) return Response.json({ message: "მისამართი არასწორია." }, { status: 400 })
  const result = await readDiscovery(getDatabasePool(), session.user.id, id ?? undefined, brand)
  return Response.json({ session: publicSession(result) }, { headers: { "cache-control": "private, no-store" } })
}

export async function POST(request: Request) {
  const access = await authenticateWorkRequest(request)
  if (access.error) return access.error
  const raw = await request.text()
  if (raw.length > 24000) return Response.json({ message: "მოთხოვნა ზედმეტად დიდია." }, { status: 413 })
  let body: Record<string, unknown>
  try { const value: unknown = JSON.parse(raw); if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(); body = value as Record<string, unknown> }
  catch { return Response.json({ message: "მონაცემების ფორმატი არასწორია." }, { status: 400 }) }
  if (!isDiscoveryId(body.id)) return Response.json({ message: "სესია არასწორია." }, { status: 422 })
  const pool = getDatabasePool()
  const ownerId = access.session.user.id
  const id = body.id
  try {
    if (body.action === "draft") {
      const input = body.input as Record<string, unknown> | undefined
      if (!input || typeof input.website !== "string" || input.website.length > 500 || typeof input.notes !== "string" || input.notes.length > 8000 || !["ka", "en"].includes(String(input.language)) || (body.brandId !== null && body.brandId !== undefined && (typeof body.brandId !== "string" || body.brandId.length > 160))) throw new Error("შეამოწმეთ ბიზნესის ინფორმაცია.")
      await ensurePersonalWorkspace(pool, ownerId)
      const draft = await saveDiscoveryDraft(pool, ownerId, id, { website: input.website, notes: input.notes, language: input.language as "ka" | "en" }, typeof body.brandId === "string" ? body.brandId : null)
      return Response.json({ session: publicSession(draft) })
    }
    if (!Number.isSafeInteger(body.revision) || Number(body.revision) < 1) throw new Error("სესიის ვერსია არასწორია.")
    const revision = body.revision as number
    if (body.action === "start") await startDiscovery(pool, ownerId, id, revision, body.input)
    else if (body.action === "revise") await reviseDiscovery(pool, ownerId, id, revision, body)
    else if (body.action === "retry") await retryDiscovery(pool, ownerId, id, revision)
    else if (body.action === "confirm") {
      const brandId = await confirmDiscovery(pool, ownerId, id, revision, body.selectedGoalIds, body.language)
      await rememberBrand(brandId)
      return Response.json({ brandId, redirect: "/workspace/brand" })
    } else if (body.action !== "resume") throw new Error("ქმედება არასწორია.")
    const current = await readDiscovery(pool, ownerId, id)
    if (!current) return Response.json({ message: "სესია ვერ მოიძებნა." }, { status: 404 })
    if (["queued", "running"].includes(current.status)) after(() => runBrandDiscovery(pool, ownerId, id))
    return Response.json({ session: publicSession(current) })
  } catch (error) {
    if (error instanceof DiscoveryConflict) return Response.json({ message: error.message }, { status: 409 })
    // Expected validation errors contain Georgian copy; database errors remain private.
    const message = error instanceof Error && /[ა-ჰ]/u.test(error.message) ? error.message : "ცვლილება ვერ შეინახა. თქვენი ინფორმაცია შენარჩუნებულია; სცადეთ ხელახლა."
    return Response.json({ message }, { status: 422 })
  }
}
