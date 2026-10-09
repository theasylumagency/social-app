import { authenticateWorkRequest, currentSession, subscriptionRequired } from "../../_server/auth"
import { getDatabasePool } from "../../_server/database"
import { limitedBody } from "../../_server/limited-body"
import { PublicKnowledgeConflict, readPublicKnowledgeView, savePublicFact, type SavePublicFact } from "../../../infrastructure/postgres/public-knowledge-store"
export const runtime = "nodejs"
export async function GET(request: Request) {
  const session = await currentSession()
  if (!session?.user.emailVerified) return Response.json({ message: "შედით ანგარიშში." }, { status: 401 })
  const billing = await subscriptionRequired(session.user.id)
  if (billing) return billing
  const brandId = new URL(request.url).searchParams.get("brand")
  if (!brandId || brandId.length > 160) return Response.json({ message: "ბრენდი არასწორია." }, { status: 422 })
  try { return Response.json(await readPublicKnowledgeView(getDatabasePool(), session.user.id, brandId), { headers: { "cache-control": "private, no-store" } }) }
  catch { return Response.json({ message: "ფაქტების მიღება ვერ მოხერხდა." }, { status: 404 }) }
}
export async function POST(request: Request) {
  const access = await authenticateWorkRequest(request)
  if (access.error) return access.error
  try {
    const value: unknown = JSON.parse(new TextDecoder().decode(await limitedBody(request, 12000)))
    if (!value || typeof value !== "object" || Array.isArray(value)) throw Error("მონაცემები არასწორია.")
    const input = value as SavePublicFact
    if (typeof input.brandId !== "string" || !input.brandId || input.brandId.length > 160) throw Error("ბრენდი არასწორია.")
    return Response.json(await savePublicFact(getDatabasePool(), access.session.user.id, input), { headers: { "cache-control": "private, no-store" } })
  } catch (error) {
    const message = error instanceof Error && !("code" in error) ? error.message : "ფაქტის შენახვა ვერ დასრულდა."
    return Response.json({ message }, { status: error instanceof PublicKnowledgeConflict ? 409 : 422 })
  }
}
