import { authenticateWorkRequest, currentSession, subscriptionRequired } from "../../_server/auth"
import { getDatabasePool } from "../../_server/database"
import { isDiscoveryId } from "../../../infrastructure/postgres/brand-discovery-store"
import { approveStrategy, proposeStrategy, readStrategyView, retryStrategy } from "../../../infrastructure/postgres/social-strategy-store"

export async function GET(request: Request) {
  const session = await currentSession()
  if (!session?.user.emailVerified) return Response.json({ message: "შედით ანგარიშში." }, { status: 401 })
  const denied = await subscriptionRequired(session.user.id)
  if (denied) return denied
  const brand = new URL(request.url).searchParams.get("brand")
  if (!brand || brand.length > 160) return Response.json({ message: "ბრენდი არასწორია." }, { status: 400 })
  return Response.json(await readStrategyView(getDatabasePool(), session.user.id, brand), { headers: { "cache-control": "private, no-store" } })
}
export async function POST(request: Request) {
  const auth = await authenticateWorkRequest(request)
  if (auth.error) return auth.error
  try {
    const raw = await request.text()
    if (raw.length > 5000) throw Error()
    const b = JSON.parse(raw)
    if (!b || !isDiscoveryId(b.id) || typeof b.brandId !== "string" || !b.brandId || b.brandId.length > 160) throw Error()
    const pool = getDatabasePool(), ownerId = auth.session.user.id
    if (b.action === "propose" || b.action === "revise") {
      if (b.action === "revise" && !isDiscoveryId(b.parentId)) throw Error()
      await proposeStrategy(pool, ownerId, { id: b.id, brandId: b.brandId, ...(b.action === "revise" ? { parentId: b.parentId, reason: b.reason, comment: b.comment } : {}) })
    } else if (b.action === "approve" && Number.isSafeInteger(b.revision)) await approveStrategy(pool, ownerId, b.brandId, b.id, b.revision)
    else if (b.action === "retry") await retryStrategy(pool, ownerId, b.brandId, b.id)
    else throw Error()
    return Response.json(await readStrategyView(pool, ownerId, b.brandId))
  } catch (error) { return Response.json({ message: error instanceof Error && /[ა-ჰ]/u.test(error.message) ? error.message : "მოთხოვნა ვერ შესრულდა. განაახლეთ გვერდი და სცადეთ ხელახლა." }, { status: 422 }) }
}
