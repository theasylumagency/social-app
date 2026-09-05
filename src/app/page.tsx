import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { selectBrand } from "../application/dashboard/model"
import { listDashboardBrands } from "../infrastructure/postgres/dashboard-store"
import { ensurePersonalWorkspace } from "../infrastructure/postgres/workspace-store"
import { requireSession } from "./_server/auth"
import { getDatabasePool } from "./_server/database"
import { ACTIVE_BRAND_COOKIE } from "./_server/active-brand"

export default async function Home() {
  const session = await requireSession()
  const pool = getDatabasePool()
  await ensurePersonalWorkspace(pool, session.user.id)
  const [brands, jar] = await Promise.all([listDashboardBrands(pool, session.user.id), cookies()])
  const brand = selectBrand(brands, jar.get(ACTIVE_BRAND_COOKIE)?.value)
  redirect(brand?.ready ? "/workspace" : "/onboarding")
}
