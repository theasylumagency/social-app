import { listDashboardBrands } from "../../../../infrastructure/postgres/dashboard-store"
import { authenticateWorkRequest } from "../../../_server/auth"
import { getDatabasePool } from "../../../_server/database"
import { rememberBrand } from "../../../_server/active-brand"

export async function POST(request: Request): Promise<Response> {
  const access = await authenticateWorkRequest(request)
  if (access.error) return access.error
  const raw = await request.text()
  if (raw.length > 1000) return Response.json({ message: "მოთხოვნა ზედმეტად დიდია." }, { status: 413 })
  let body: unknown
  try { body = JSON.parse(raw) } catch { return Response.json({ message: "არასწორი მოთხოვნა." }, { status: 400 }) }
  const brandId = body && typeof body === "object" && "brandId" in body ? body.brandId : undefined
  if (typeof brandId !== "string") return Response.json({ message: "აირჩიეთ ბრენდი." }, { status: 422 })
  try {
    const brands = await listDashboardBrands(getDatabasePool(), access.session.user.id)
    if (!brands.some((brand) => brand.id === brandId)) return Response.json({ message: "ბრენდი ვერ მოიძებნა." }, { status: 404 })
    await rememberBrand(brandId)
    return Response.json({ ok: true })
  } catch {
    return Response.json({ message: "ბრენდის გახსნა ვერ მოხერხდა." }, { status: 503 })
  }
}
