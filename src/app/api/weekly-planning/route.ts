import { after } from "next/server"
import { authenticateWorkRequest, currentSession } from "../../_server/auth"
import { getDatabasePool } from "../../_server/database"
import { isWeek } from "../../../application/dashboard/model"
import { isDiscoveryId } from "../../../infrastructure/postgres/brand-discovery-store"
import { approvePlanningRun, beginWeeklyPlanning, PlanningConflict, readPlanningRun, readPlanningView, retryPlanningRun, type BeginPlanningInput } from "../../../infrastructure/postgres/weekly-planning-store"
import { runWeeklyPlanning } from "../../../worker/weekly-planning"

export const runtime = "nodejs"
export const maxDuration = 300
export async function GET(request: Request) {
  const auth = await currentSession()
  if (!auth?.user.emailVerified) return Response.json({ message: "გაგრძელებისთვის შედით ანგარიშში." }, { status: 401 })
  const query = new URL(request.url).searchParams
  const brandId = query.get("brand")
  const week = query.get("week")
  if (!brandId || brandId.length > 160 || !isWeek(week)) return Response.json({ message: "ბრენდი ან კვირა არასწორია." }, { status: 400 })
  return Response.json(await readPlanningView(getDatabasePool(), auth.user.id, brandId, week), { headers: { "cache-control": "private, no-store" } })
}
export async function POST(request: Request) {
  const access = await authenticateWorkRequest(request)
  if (access.error) return access.error
  const raw = await request.text()
  if (raw.length > 8000) return Response.json({ message: "მოთხოვნა ზედმეტად დიდია." }, { status: 413 })
  let body: Record<string, unknown>
  try { const value: unknown = JSON.parse(raw); if (!value || typeof value !== "object" || Array.isArray(value)) throw Error(); body = value as Record<string, unknown> }
  catch { return Response.json({ message: "მონაცემების ფორმატი არასწორია." }, { status: 400 }) }
  const pool = getDatabasePool()
  const ownerId = access.session.user.id
  if (!isDiscoveryId(body.id)) return Response.json({ message: "გეგმის მისამართი არასწორია." }, { status: 422 })
  try {
    let run
    if (body.action === "start" || body.action === "revise") {
      if (typeof body.brandId !== "string" || !isWeek(body.week) || typeof body.priority !== "string") throw new Error("შეამოწმეთ კვირა და პრიორიტეტი.")
      if (body.action === "revise" && (!isDiscoveryId(body.parentId) || !Number.isSafeInteger(body.parentVersion) || typeof body.revisionNote !== "string")) throw new Error("მიუთითეთ გეგმის დაზუსტება.")
      const input: BeginPlanningInput = { id: body.id, brandId: body.brandId, week: body.week, priority: body.priority, ...(body.action === "revise" ? { parentId: body.parentId as string, parentVersion: body.parentVersion as number, revisionNote: body.revisionNote as string } : {}) }
      run = await beginWeeklyPlanning(pool, ownerId, input)
    } else {
      if (!Number.isSafeInteger(body.version) || Number(body.version) < 1) throw new Error("გეგმის ვერსია არასწორია.")
      run = await readPlanningRun(pool, ownerId, body.id)
      if (!run) return Response.json({ message: "გეგმა ვერ მოიძებნა." }, { status: 404 })
      if (body.action === "approve") await approvePlanningRun(pool, ownerId, body.id, body.version as number)
      else if (body.action === "retry") await retryPlanningRun(pool, ownerId, body.id, body.version as number)
      else if (body.action !== "resume") throw new Error("ქმედება არასწორია.")
    }
    const view = await readPlanningView(pool, ownerId, run.brandId, run.week)
    if (view.run && ["queued", "running"].includes(view.run.status)) {
      const id = view.run.id
      after(() => runWeeklyPlanning(pool, ownerId, id))
    }
    return Response.json(view)
  } catch (error) {
    if (error instanceof PlanningConflict) return Response.json({ message: error.message }, { status: 409 })
    const message = error instanceof Error && /[ა-ჰ]/u.test(error.message) ? error.message : "მოქმედება ვერ დასრულდა. შენახული გეგმა შენარჩუნებულია; სცადეთ ხელახლა."
    return Response.json({ message }, { status: 422 })
  }
}
