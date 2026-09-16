import { DASHBOARD_SECTIONS, isWeek, type DashboardSection } from "../../../application/dashboard/model"
import type { NoteContext, NoteTarget } from "../../../application/contextual-notes/model"
import { isDiscoveryId } from "../../../infrastructure/postgres/brand-discovery-store"
import { applyNote, listNotes, resolveNote, submitNote } from "../../../infrastructure/postgres/contextual-notes-store"
import { authenticateWorkRequest, currentSession, subscriptionRequired } from "../../_server/auth"
import { getDatabasePool } from "../../_server/database"
import { limitedBody } from "../../_server/limited-body"
import { listChannelPolicies, listOperatingRules } from "../../../infrastructure/postgres/operating-policy-store"

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
  let target: NoteTarget | null = null
  if (v.target !== undefined && v.target !== null) {
    if (typeof v.target !== "object") throw Error("არჩეული ობიექტი არასწორია.")
    const t = v.target as Record<string, unknown>
    const types: NoteTarget["type"][] = ["post", "weekly_objective", "audience_focus", "content_direction", "progress_signal", "business_summary", "positioning", "audience_hypothesis", "offer", "communication_rule"]
    if (!types.includes(t.type as NoteTarget["type"]) || typeof t.id !== "string" || !t.id || t.id.length > 180 || typeof t.label !== "string" || !t.label || t.label.length > 240 || typeof t.version !== "string" || !t.version || t.version.length > 180 || typeof t.hash !== "string" || !/^[a-f0-9]{8}$/i.test(t.hash) || !t.data || typeof t.data !== "object" || Array.isArray(t.data) || JSON.stringify(t.data).length > 12000) throw Error("არჩეული ობიექტი არასწორია.")
    target = { type: t.type as NoteTarget["type"], id: t.id, label: t.label, version: t.version, hash: t.hash, data: t.data as Record<string, unknown> }
    if (target.type.startsWith("weekly_") || target.type === "audience_focus" || target.type === "content_direction" || target.type === "progress_signal") {
      if (v.section !== "week" || !runId) throw Error("გეგმის არჩეული ნაწილი არასწორია.")
    } else if (target.type !== "post" && v.section !== "brand") throw Error("ბრენდის არჩეული ნაწილი არასწორია.")
  }
  return { brandId: v.brandId, section: v.section as DashboardSection, week: v.week, postKey, channel, runId, postVersion: postKey ? v.postVersion as string : null, target }
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
    const pool = getDatabasePool()
    const [notes, rules, channels] = await Promise.all([listNotes(pool, auth.user.id, context), listOperatingRules(pool, auth.user.id, context.brandId), listChannelPolicies(pool, auth.user.id, context.brandId)])
    return Response.json({ notes, rules, channels }, { headers: { "cache-control": "private, no-store" } })
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
