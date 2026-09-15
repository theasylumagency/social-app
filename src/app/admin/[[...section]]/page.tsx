import { notFound } from "next/navigation"

import { adminSectionLabels, interventionsFromCustomers, isAdminSection, type AdminSection } from "../../../application/admin-console/model"
import { listAdminCustomers, readAdminAudit, readAdminCustomerDetail } from "../../../infrastructure/postgres/admin-console-store"
import { requireInternalAdmin } from "../../_server/admin"
import { getDatabasePool } from "../../_server/database"
import { AdminShell } from "../shell"
import {
  AuditView,
  CommunicationView,
  CustomerDetailView,
  CustomersView,
  InterventionsView,
  OverviewView,
  SubscriptionsView,
} from "../views"
import "../admin.css"

type Props = {
  params: Promise<{ section?: string[] }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

function textParameter(query: Record<string, string | string[] | undefined>, name: string) {
  const value = query[name]
  return typeof value === "string" ? value : ""
}

export async function generateMetadata({ params }: Props) {
  const segments = (await params).section
  const section = segments?.[0] ?? "overview"
  return {
    title: `${section === "customers" && segments?.[1] ? "კლიენტის დეტალები" : isAdminSection(section) ? adminSectionLabels[section] : "Operations"} — UNDA Operations`,
    robots: { index: false, follow: false },
  }
}

export default async function AdminPage({ params, searchParams }: Props) {
  const [{ section: segments }, query] = await Promise.all([params, searchParams])
  const sectionValue = segments?.[0] ?? "overview"
  if (!isAdminSection(sectionValue)) notFound()
  if ((segments?.length ?? 0) > (sectionValue === "customers" ? 2 : 1)) notFound()

  const returnTo = `/admin${segments?.length ? `/${segments.join("/")}` : ""}`
  const session = await requireInternalAdmin(returnTo)
  const pool = getDatabasePool()
  const section = sectionValue as AdminSection

  if (section === "overview") {
    const [customers, audit] = await Promise.all([listAdminCustomers(pool), readAdminAudit(pool, 12)])
    const interventions = interventionsFromCustomers(customers)
    return <AdminShell section={section} user={session.user} interventionCount={interventions.length}><OverviewView customers={customers} interventions={interventions} audit={audit} /></AdminShell>
  }

  if (section === "customers" && segments?.[1]) {
    const detail = await readAdminCustomerDetail(pool, segments[1])
    if (!detail) notFound()
    return <AdminShell section={section} user={session.user} interventionCount={null}><CustomerDetailView detail={detail} /></AdminShell>
  }

  if (section === "customers") {
    const customers = await listAdminCustomers(pool)
    const interventions = interventionsFromCustomers(customers)
    const filter = textParameter(query, "filter") || "all"
    return <AdminShell section={section} user={session.user} interventionCount={interventions.length}><CustomersView customers={customers} query={textParameter(query, "q")} filter={filter} /></AdminShell>
  }

  if (section === "interventions") {
    const customers = await listAdminCustomers(pool)
    const interventions = interventionsFromCustomers(customers)
    const requestedPriority = textParameter(query, "priority")
    const priority = ["urgent", "normal", "low"].includes(requestedPriority) ? requestedPriority : "all"
    return <AdminShell section={section} user={session.user} interventionCount={interventions.length}><InterventionsView interventions={interventions} priority={priority} /></AdminShell>
  }

  if (section === "subscriptions") {
    const customers = await listAdminCustomers(pool)
    const interventions = interventionsFromCustomers(customers)
    return <AdminShell section={section} user={session.user} interventionCount={interventions.length}><SubscriptionsView customers={customers} /></AdminShell>
  }

  if (section === "communication") {
    return <AdminShell section={section} user={session.user} interventionCount={null}><CommunicationView /></AdminShell>
  }

  const audit = await readAdminAudit(pool)
  return <AdminShell section={section} user={session.user} interventionCount={null}><AuditView events={audit} /></AdminShell>
}
