import { DASHBOARD_SECTIONS, isWeek, type DashboardSection } from "../../../application/dashboard/model"
import type { NoteContext } from "../../../application/contextual-notes/model"
import { isDiscoveryId } from "../../../infrastructure/postgres/brand-discovery-store"
import { applyNote, listNotes, resolveNote, submitNote } from "../../../infrastructure/postgres/contextual-notes-store"
import { authenticateWorkRequest, currentSession, subscriptionRequired } from "../../_server/auth"
import { getDatabasePool } from "../../_server/database"
import { limitedBody } from "../../_server/limited-body"

export const runtime = "nodejs"
export const maxDuration = 300
function parseContext(value: unknown): NoteContext {
  if (!value || typeof value !== "object") throw Error("შენიშვნის კონტექსტი არასწორია.")
  const v = value as Record<string, unknown>
  if (typeof v.brandId !== "string" || !v.brandId || v.brandId.length > 160 || !DASHBOARD_SECTIONS.includes(v.section as DashboardSection) || !isWeek(v.week)) throw Error("ბრენდი, გვერდი ან კვირა არასწორია.")
  const postKey = v.postKey ?? null, channel = v.channel ?? null, runId = v.runId ?? null
  if (postKey !== null && (typeof postKey !== "string" || !/^p([1-9]|10)$/.test(postKey))) throw Error("არჩეული პოსტი არასწორია.")
  if (channel !== null && channel !== "facebook" && channel !== "instagram") throw Error("არჩეული არხი არასწორია.")
  if (runId !== null && !isDiscoveryId(runId)) throw Error("გეგმის მისამართი არასწორია.")
  if (postKey && (v.section !== "content" || !channel || !runId)) throw Error("ჯერ აირჩიეთ პოსტი და არხი.")
  if (postKey && (typeof v.postVersion !== "string" || v.postVersion.length > 40 || !Number.isFinite(Date.parse(v.postVersion)))) throw Error("ხელახლა აირჩიეთ პოსტის მიმდინარე ვერსია.")
  return { brandId: v.brandId, section: v.section as DashboardSection, week: v.week, postKey, channel, runId, postVersion: postKey ? v.postVersion as string : null }
}
function failure(error: unknown) {
  return Response.json({ message: error instanceof Error && /[ა-ჰ]/u.test(error.message) ? error.message : "მოქმედება ვერ დასრულდა. სცადეთ ხელახლა." }, { status: 422 })
}
export async function GET(request: Request) {
  const auth = await currentSession()
  if (!auth?.user.emailVerified) return Response.json({ message: "გაგრძელებისთვის შედით ანგარიშში." }, { status: 401 })
  const billing = await subscriptionRequired(auth.user.id)
  if (billing) return billing
  try {
    const context = parseContext(Object.fromEntries(new URL(request.url).searchParams))
    return Response.json({ notes: await listNotes(getDatabasePool(), auth.user.id, context) }, { headers: { "cache-control": "private, no-store" } })
  } catch (error) { return failure(error) }
}
export async function POST(request: Request) {
  const access = await authenticateWorkRequest(request)
  if (access.error) return access.error
  try {
    const body = JSON.parse(new TextDecoder().decode(await limitedBody(request, 40000))) as Record<string, unknown>
    if (!body || !isDiscoveryId(body.id)) throw Error("შენიშვნის მისამართი არასწორია.")
    const pool = getDatabasePool(), ownerId = access.session.user.id
    if (body.action === "confirm") return Response.json({ note: await applyNote(pool, ownerId, body.id, true) })
    if (body.action === "dismiss" || body.action === "undo") return Response.json({ note: await resolveNote(pool, ownerId, body.id, body.action) })
    if (body.action !== "submit" || typeof body.text !== "string" || !body.text.trim() || body.text.length > 8000 || (body.source !== "text" && body.source !== "voice")) throw Error("დაწერეთ შენიშვნა, მაქსიმუმ 8000 სიმბოლო.")
    return Response.json({ note: await submitNote(pool, ownerId, { id: body.id, text: body.text.trim(), source: body.source, context: parseContext(body.context) }) })
  } catch (error) { return failure(error) }
}
