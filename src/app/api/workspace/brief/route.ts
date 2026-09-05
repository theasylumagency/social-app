import { isWeek } from "../../../../application/dashboard/model"
import { saveWeeklyBrief } from "../../../../infrastructure/postgres/dashboard-store"
import { authenticateWorkRequest } from "../../../_server/auth"
import { getDatabasePool } from "../../../_server/database"

export async function POST(request: Request): Promise<Response> {
  const access = await authenticateWorkRequest(request)
  if (access.error) return access.error
  const raw = await request.text()
  if (raw.length > 8000) return Response.json({ message: "მოთხოვნა ზედმეტად დიდია." }, { status: 413 })
  let body: unknown
  try { body = JSON.parse(raw) } catch { return Response.json({ message: "მონაცემების ფორმატი არასწორია." }, { status: 400 }) }
  if (!body || typeof body !== "object") return Response.json({ message: "შეამოწმეთ მონაცემები." }, { status: 422 })
  const { brandId, week, objective } = body as Record<string, unknown>
  if (typeof brandId !== "string" || brandId.length > 160 || !isWeek(week) || typeof objective !== "string" || objective.trim().length < 1 || objective.trim().length > 1200) {
    return Response.json({ message: "მიუთითეთ კვირის მიზანი (1–1200 სიმბოლო)." }, { status: 422 })
  }
  try {
    const saved = await saveWeeklyBrief(getDatabasePool(), access.session.user.id, brandId, week, objective.trim())
    return saved ? Response.json({ message: "კვირის მიზანი შენახულია." }) : Response.json({ message: "ბრენდი ვერ მოიძებნა." }, { status: 404 })
  } catch {
    return Response.json({ message: "შენახვა ვერ დასრულდა. სცადეთ ხელახლა." }, { status: 503 })
  }
}
