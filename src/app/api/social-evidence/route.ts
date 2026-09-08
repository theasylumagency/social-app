import { authenticateWorkRequest } from "../../_server/auth"
import { getDatabasePool } from "../../_server/database"
import { isWeek } from "../../../application/dashboard/model"
import { saveWeekEvidence } from "../../../infrastructure/postgres/social-strategy-store"
import type { WeekEvidence } from "../../../blueprints/social/strategy/model"

export async function POST(request: Request) {
  const auth = await authenticateWorkRequest(request)
  if (auth.error) return auth.error
  try {
    const raw = await request.text()
    if (raw.length > 16000) throw Error()
    const b = JSON.parse(raw)
    const e = b?.evidence
    const text = (v: unknown) => typeof v === "string" && v.length <= 2500
    if (typeof b?.brandId !== "string" || !b.brandId || b.brandId.length > 160 || !e || !isWeek(e.week) || !text(e.businessContext) || !Array.isArray(e.observations) || e.observations.length > 10 || e.observations.some((o: Record<string, unknown>) => !o || !["public", "connected", "downstream"].includes(String(o.level)) || !text(o.observation) || !String(o.observation).trim() || !text(o.source) || !String(o.source).trim()) || ![e.execution, e.unknowns].every((items) => Array.isArray(items) && items.length <= 10 && items.every(text))) throw Error()
    const evidence: WeekEvidence = { week: e.week, reviewedAt: "", availability: "unavailable", observations: e.observations, execution: e.execution, unknowns: e.unknowns, businessContext: e.businessContext }
    await saveWeekEvidence(getDatabasePool(), auth.session.user.id, b.brandId, evidence)
    return Response.json({ saved: true })
  } catch (error) { return Response.json({ message: error instanceof Error && /[ა-ჰ]/u.test(error.message) ? error.message : "შეამოწმეთ დაკვირვება, კვირა და წყარო." }, { status: 422 }) }
}
