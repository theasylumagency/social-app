import { readPlanningView } from "../../../infrastructure/postgres/weekly-planning-store"
import { readBrandDossier, readDossierHistory } from "../../../infrastructure/postgres/brand-discovery-store"
import { publicDiscoveryPayload } from "../../../blueprints/social/brand-discovery/model"
import "../../discovery.css"
import { cookies } from "next/headers"
import { notFound, redirect } from "next/navigation"
import { currentWeek, DASHBOARD_SECTIONS, isWeek, selectBrand, type DashboardSection } from "../../../application/dashboard/model"
import { listDashboardBrands, listDashboardSources, readWeeklyBrief } from "../../../infrastructure/postgres/dashboard-store"
import { requireSession } from "../../_server/auth"
import { getDatabasePool } from "../../_server/database"
import { ACTIVE_BRAND_COOKIE } from "../../_server/active-brand"
import { sectionLabels, WorkspaceShell } from "../shell"
import { BrandView, ConnectionsView, ContentView, ResultsView, SettingsView, WeekView } from "../views"
import "../workspace.css"
import "../weekly-planning.css"

type Props = { params: Promise<{ section?: string[] }>; searchParams: Promise<Record<string, string | string[] | undefined>> }

export async function generateMetadata({ params }: Props) {
  const { section } = await params
  return { title: `${sectionLabels[(section?.[0] ?? "week") as DashboardSection] ?? "სამუშაო სივრცე"} — UNDA`, robots: { index: false, follow: false } }
}

export default async function WorkspacePage({ params, searchParams }: Props) {
  const [{ section: segments }, query, jar] = await Promise.all([params, searchParams, cookies()])
  const section = segments?.[0] ?? "week"
  if ((segments?.length ?? 0) > 1 || !DASHBOARD_SECTIONS.includes(section as DashboardSection)) notFound()
  const session = await requireSession(`/workspace${section === "week" ? "" : `/${section}`}`)
  const pool = getDatabasePool()
  const brands = await listDashboardBrands(pool, session.user.id)
  const brand = selectBrand(brands, jar.get(ACTIVE_BRAND_COOKIE)?.value)
  if (!brand || !brand.ready) redirect("/onboarding")
  const today = currentWeek()
  const week = isWeek(query.week) ? query.week : today
  const [sources, brief, dossier, history, planning] = await Promise.all([
    listDashboardSources(pool, session.user.id, brand.id),
    section === "week" ? readWeeklyBrief(pool, session.user.id, brand.id, week) : Promise.resolve(null),
    section === "brand" ? readBrandDossier(pool, session.user.id, brand.id) : Promise.resolve(null),
    section === "brand" && query.view === "history" ? readDossierHistory(pool, session.user.id, brand.id) : Promise.resolve([]),
    section === "week" ? readPlanningView(pool, session.user.id, brand.id, week) : Promise.resolve(null),
  ])
  const textParam = (name: string) => typeof query[name] === "string" ? query[name] as string : ""
  return <WorkspaceShell section={section as DashboardSection} brands={brands} brand={brand} user={session.user}>
    {section === "week" ? <WeekView planning={planning!} ownerId={session.user.id} brand={brand} sources={sources} week={week} today={today} brief={brief} /> : null}
    {section === "content" ? <ContentView filter={textParam("filter")} view={textParam("view")} week={week} /> : null}
    {section === "results" ? <ResultsView /> : null}
    {section === "brand" ? <BrandView history={history} dossier={dossier ? { ...dossier, payload: publicDiscoveryPayload(dossier.payload) } : null} brand={brand} sources={sources} view={textParam("view")} /> : null}
    {section === "connections" ? <ConnectionsView sources={sources} /> : null}
    {section === "settings" ? <SettingsView brand={brand} user={session.user} brandCount={brands.length} /> : null}
  </WorkspaceShell>
}
