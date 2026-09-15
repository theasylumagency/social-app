import Link from "next/link"
import { readStrategyView, readWeekEvidence } from "../../../infrastructure/postgres/social-strategy-store"
import { StrategyClient } from "../strategy-client"
import { EvidenceClient } from "../evidence-client"
import "../strategy.css"
import { readPlanningView } from "../../../infrastructure/postgres/weekly-planning-store"
import { readBrandDossier, readDossierHistory } from "../../../infrastructure/postgres/brand-discovery-store"
import { publicDiscoveryPayload } from "../../../blueprints/social/brand-discovery/model"
import "../../discovery.css"
import { cookies } from "next/headers"
import { notFound, redirect } from "next/navigation"
import { currentWeek, DASHBOARD_SECTIONS, isWeek, selectBrand, type DashboardSection } from "../../../application/dashboard/model"
import { listDashboardBrands, listDashboardSources, readWeeklyBrief } from "../../../infrastructure/postgres/dashboard-store"
import { requireSession, currentSubscription } from "../../_server/auth"
import { SubscriptionExpiry } from "../../subscription/expiry"
import { getDatabasePool } from "../../_server/database"
import { ACTIVE_BRAND_COOKIE } from "../../_server/active-brand"
import { socialConnectionsAvailable } from "../../_server/social-connections"
import { PostgresSocialConnectionsStore } from "../../../infrastructure/postgres/social-connections-store"
import { readConnectionAccounts } from "../../../application/social-connections/view"
import { sectionLabels, WorkspaceShell } from "../shell"
import { PostgresSocialAnalyticsStore } from "../../../infrastructure/postgres/social-analytics-store"
import { ResultsClient } from "../results-client"
import { BrandView, ConnectionsView, ContentView, SettingsView, WeekView } from "../views"
import { Overview } from "../overview"
import { readDeliveryView } from "../../_server/delivery-view"
import { DeliveryStatus } from "../delivery-status"
import "../workspace.css"
import "../weekly-planning.css"
import "../weekly-posts.css"
import "../briefing.css"

type Props = { params: Promise<{ section?: string[] }>; searchParams: Promise<Record<string, string | string[] | undefined>> }

export async function generateMetadata({ params }: Props) {
  const { section } = await params
  return { title: `${sectionLabels[(section?.[0] ?? "overview") as DashboardSection] ?? "სამუშაო სივრცე"} — UNDA`, robots: { index: false, follow: false } }
}

export default async function WorkspacePage({ params, searchParams }: Props) {
  const [{ section: segments }, query, jar] = await Promise.all([params, searchParams, cookies()])
  // Keep bookmarked weekly URLs working while the workspace root becomes a briefing.
  if (!segments?.length && isWeek(query.week)) redirect(`/workspace/week?week=${query.week}`)
  const section = segments?.[0] ?? "overview"
  if ((segments?.length ?? 0) > 1 || !DASHBOARD_SECTIONS.includes(section as DashboardSection)) notFound()
  const session = await requireSession(`/workspace${section === "overview" ? "" : `/${section}`}`)
  const subscription = await currentSubscription(session.user.id)
  const pool = getDatabasePool()
  const brands = await listDashboardBrands(pool, session.user.id)
  const brand = selectBrand(brands, jar.get(ACTIVE_BRAND_COOKIE)?.value)
  if (!brand || !brand.ready) redirect("/onboarding")
  const today = currentWeek()
  const week = section !== "overview" && isWeek(query.week) ? query.week : today
  const [sources, brief, dossier, history, planning, accounts, strategy, evidence, analytics, delivery] = await Promise.all([
    listDashboardSources(pool, session.user.id, brand.id),
    section === "week" ? readWeeklyBrief(pool, session.user.id, brand.id, week) : Promise.resolve(null),
    section === "brand" ? readBrandDossier(pool, session.user.id, brand.id) : Promise.resolve(null),
    section === "brand" && query.view === "history" ? readDossierHistory(pool, session.user.id, brand.id) : Promise.resolve([]),
    (section === "overview" || section === "week" || section === "content") ? readPlanningView(pool, session.user.id, brand.id, week) : Promise.resolve(null),
    (section === "overview" || section === "connections") ? readConnectionAccounts(new PostgresSocialConnectionsStore(pool), { ownerId: session.user.id, brandId: brand.id }) : Promise.resolve([]),
    readStrategyView(pool, session.user.id, brand.id),
    section === "results" ? readWeekEvidence(pool, session.user.id, brand.id) : Promise.resolve([]),
    section === "results" ? new PostgresSocialAnalyticsStore(pool).listResults({ ownerId: session.user.id, brandId: brand.id }) : Promise.resolve([]),
    (section === "overview" || section === "content") ? readDeliveryView(pool, { ownerId: session.user.id, brandId: brand.id }) : Promise.resolve(null),
  ])
  const textParam = (name: string) => typeof query[name] === "string" ? query[name] as string : ""
  return <WorkspaceShell section={section as DashboardSection} brands={brands} brand={brand} user={session.user} week={week}>
    {subscription ? <SubscriptionExpiry expiresAt={subscription.expiresAt} /> : null}
    {section === "overview" ? <Overview brand={brand} strategy={strategy} planning={planning!} accounts={accounts} week={week} readAt={new Date().toISOString()} delivery={delivery!} /> : null}
    {section === "strategy" || ((section === "week" || section === "content") && !strategy.active && !planning?.run) ? <StrategyClient key={brand.id} brandId={brand.id} initial={strategy} /> : null}
    {(section === "week" || section === "content") && strategy.active ? <details className="brief-details"><summary>მოქმედი სოციალური სტრატეგია</summary><section className="ws-card strategy-banner"><h2>{strategy.active.payload.proposal?.objective}</h2><p>{strategy.active.payload.proposal?.horizon}</p><Link className="ws-text-link" href="/workspace/strategy">სტრატეგია, არხები და გაზომვის კრიტერიუმები →</Link></section></details> : null}
    {section === "week" && (strategy.active || planning?.run) ? <WeekView planning={planning!} ownerId={session.user.id} brand={brand} sources={sources} week={week} today={today} brief={brief} /> : null}
    {section === "content" && (strategy.active || planning?.run) ? <ContentView planning={planning!} brand={brand} ownerId={session.user.id} week={week} /> : null}
    {section === "content" ? <DeliveryStatus snapshot={delivery!} week={week} /> : null}
    {section === "results" ? <><ResultsClient results={analytics} /><details className="brief-details"><summary>ბიზნესკონტექსტის დამატება და წინა დაკვირვებები</summary><div className="brief-panel"><EvidenceClient key={brand.id} brandId={brand.id} initial={evidence} /></div></details></> : null}
    {section === "brand" ? <BrandView history={history} dossier={dossier ? { ...dossier, payload: publicDiscoveryPayload(dossier.payload) } : null} brand={brand} sources={sources} view={textParam("view")} /> : null}
    {section === "connections" ? <ConnectionsView sources={sources} brandId={brand.id} accounts={accounts} available={socialConnectionsAvailable()} intentId={textParam("intent")} outcome={textParam("connection")} /> : null}
    {section === "settings" ? <SettingsView brand={brand} user={session.user} brandCount={brands.length} /> : null}
  </WorkspaceShell>
}
