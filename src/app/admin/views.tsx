import Link from "next/link"

import {
  customerWorkspaceName,
  planLabels,
  subscriptionLifecycleLabels,
  workspaceHealthLabels,
  type AdminAuditEvent,
  type AdminCustomer,
  type AdminIntervention,
  type InterventionPriority,
  type SubscriptionLifecycle,
  type WorkspaceHealth,
} from "../../application/admin-console/model"
import { displayDate } from "../../application/dashboard/model"
import type { AdminCustomerDetail } from "../../infrastructure/postgres/admin-console-store"
import { AdminIcon } from "./shell"

const healthOrder: WorkspaceHealth[] = ["healthy", "needsAttention", "blocked", "inactive"]

function date(value: string) {
  return displayDate(value, { year: "numeric" })
}

function dateTime(value: string) {
  return displayDate(value, { year: "numeric", hour: "2-digit" })
}

function relativeTime(value: string, now = new Date()) {
  const difference = Math.max(0, now.getTime() - Date.parse(value))
  const minutes = Math.floor(difference / 60_000)
  if (minutes < 1) return "ახლახან"
  if (minutes < 60) return `${minutes} წუთის წინ`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} საათის წინ`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days} დღის წინ`
  return date(value)
}

function PageHeading({ eyebrow, title, description, meta }: { eyebrow: string; title: string; description: string; meta?: string }) {
  return <header className="admin-page-heading">
    <div><p className="admin-eyebrow">{eyebrow}</p><h1>{title}</h1><p>{description}</p></div>
    {meta ? <span className="admin-heading-meta"><span className="admin-live-dot" />{meta}</span> : null}
  </header>
}

export function HealthPill({ status }: { status: WorkspaceHealth }) {
  return <span className={`admin-status health-${status}`}><i />{workspaceHealthLabels[status]}</span>
}

export function SubscriptionPill({ lifecycle }: { lifecycle: SubscriptionLifecycle }) {
  return <span className={`admin-status subscription-${lifecycle}`}><i />{subscriptionLifecycleLabels[lifecycle]}</span>
}

function PriorityPill({ priority }: { priority: InterventionPriority }) {
  const labels: Record<InterventionPriority, string> = { urgent: "სასწრაფო", normal: "ჩვეულებრივი", low: "დაბალი" }
  return <span className={`admin-priority priority-${priority}`}>{labels[priority]}</span>
}

function MetricCard({ label, value, note, tone = "plain" }: { label: string; value: number; note: string; tone?: "plain" | "accent" | "warning" }) {
  return <article className={`admin-metric admin-metric-${tone}`}>
    <div><span>{label}</span><AdminIcon name="activity" /></div><strong>{value}</strong><p>{note}</p>
  </article>
}

function EmptyState({ title, detail }: { title: string; detail: string }) {
  return <div className="admin-empty"><span>✓</span><h3>{title}</h3><p>{detail}</p></div>
}

function CustomerLink({ customer }: { customer: Pick<AdminCustomer, "id" | "name" | "email"> }) {
  return <Link className="admin-customer-identity" href={`/admin/customers/${encodeURIComponent(customer.id)}`}>
    <span>{customer.name.slice(0, 1).toLocaleUpperCase("ka-GE")}</span>
    <div><strong>{customer.name}</strong><small>{customer.email}</small></div>
  </Link>
}

function AuditList({ events, compact = false }: { events: readonly AdminAuditEvent[]; compact?: boolean }) {
  if (events.length === 0) return <EmptyState title="მნიშვნელოვანი ცვლილებები არ არის" detail="სისტემის ოპერაციული მოვლენები აქ გამოჩნდება." />
  const categoryLabels: Record<AdminAuditEvent["category"], string> = {
    subscription: "გამოწერა", onboarding: "Onboarding", connection: "კავშირი", publishing: "გამოქვეყნება",
  }
  return <div className={`admin-event-list ${compact ? "is-compact" : ""}`}>
    {events.map((event) => <article key={event.id} className={`admin-event event-${event.category}`}>
      <span className="admin-event-mark" />
      <div><div className="admin-event-topline"><span>{categoryLabels[event.category]}</span><time dateTime={event.occurredAt}>{compact ? relativeTime(event.occurredAt) : dateTime(event.occurredAt)}</time></div>
        <h3>{event.title}</h3><p>{event.detail}</p>
        {compact ? null : <small><Link href={`/admin/customers/${encodeURIComponent(event.customerId)}`}>{event.customerName}</Link> · მოქმედი პირი: {event.actor}</small>}
      </div>
    </article>)}
  </div>
}

export function OverviewView({ customers, interventions, audit }: { customers: AdminCustomer[]; interventions: AdminIntervention[]; audit: AdminAuditEvent[] }) {
  const active = customers.filter((customer) => customer.subscription.lifecycle === "active").length
  const expired = customers.filter((customer) => customer.subscription.lifecycle === "expired").length
  const healthy = customers.filter((customer) => customer.health === "healthy").length
  const blocked = customers.filter((customer) => customer.health === "blocked").length
  const attention = customers.filter((customer) => customer.health === "needsAttention").length
  const total = Math.max(customers.length, 1)
  return <>
    <PageHeading eyebrow="Operations overview" title="დღეს სად გვჭირდება ჩარევა?" description="კლიენტების, სამუშაო სივრცეებისა და ოპერაციული რისკების მოკლე, ცოცხალი სურათი." meta={`განახლდა ${dateTime(new Date().toISOString())}`} />
    <section className="admin-metrics" aria-label="ძირითადი მაჩვენებლები">
      <MetricCard label="აქტიური გამოწერები" value={active} note={`${customers.length} რეგისტრირებული კლიენტიდან`} tone="accent" />
      <MetricCard label="გამართული სივრცეები" value={healthy} note={`${Math.round(healthy / total * 100)}% მიმდინარე სამუშაო სივრცეებიდან`} />
      <MetricCard label="ღია ჩარევები" value={interventions.length} note={interventions.some((item) => item.reason.priority === "urgent") ? "სასწრაფო შემთხვევაც არის" : "სასწრაფო შემთხვევა არ არის"} tone={interventions.length ? "warning" : "plain"} />
      <MetricCard label="ვადაგასული გამოწერები" value={expired} note="ისტორიაში რჩება, არ იშლება" />
    </section>

    <div className="admin-overview-grid">
      <section className="admin-panel admin-attention-panel">
        <div className="admin-panel-heading"><div><p className="admin-eyebrow">Priority queue</p><h2>ახლა საყურადღებო</h2></div><Link href="/admin/interventions">ყველას ნახვა <AdminIcon name="arrow" /></Link></div>
        {interventions.length === 0 ? <EmptyState title="ჩარევა საჭირო არ არის" detail="ამ მომენტისთვის ადამიანის მოქმედების მომთხოვნი შემთხვევა არ ჩანს." /> : <div className="admin-intervention-list compact">
          {interventions.slice(0, 5).map((item) => <InterventionCard key={item.id} intervention={item} compact />)}
        </div>}
      </section>
      <section className="admin-panel admin-health-panel">
        <div className="admin-panel-heading"><div><p className="admin-eyebrow">Workspace health</p><h2>სივრცეების მდგომარეობა</h2></div></div>
        <div className="admin-health-summary">
          {healthOrder.map((status) => {
            const count = customers.filter((customer) => customer.health === status).length
            return <div key={status}><div><HealthPill status={status} /><strong>{count}</strong></div><span><i className={`health-bar-${status}`} style={{ width: `${count / total * 100}%` }} /></span></div>
          })}
        </div>
        <p className="admin-panel-note">Health ეფუძნება განმარტებად მიზეზებს — numeric score არ გამოიყენება.</p>
        <div className="admin-health-totals"><span><strong>{attention}</strong> ყურადღება</span><span><strong>{blocked}</strong> დაბლოკილი</span></div>
      </section>
    </div>

    <section className="admin-panel admin-changes-panel">
      <div className="admin-panel-heading"><div><p className="admin-eyebrow">Meaningful changes</p><h2>რა შეიცვალა</h2></div><Link href="/admin/audit">სრული აუდიტი <AdminIcon name="arrow" /></Link></div>
      <AuditList events={audit.slice(0, 6)} compact />
    </section>
  </>
}

export function CustomersView({ customers, query, filter }: { customers: AdminCustomer[]; query: string; filter: string }) {
  const normalized = query.trim().toLocaleLowerCase("ka-GE")
  const filtered = customers.filter((customer) => {
    const matchesQuery = !normalized || [customer.name, customer.email, ...customer.brandNames].some((value) => value.toLocaleLowerCase("ka-GE").includes(normalized))
    const matchesFilter = filter === "all"
      || customer.subscription.lifecycle === filter
      || customer.health === filter
      || (filter === "attention" && customer.health === "needsAttention")
    return matchesQuery && matchesFilter
  })
  const filters = [
    ["all", "ყველა"], ["active", "აქტიური"], ["expired", "ვადაგასული"], ["attention", "საყურადღებო"], ["blocked", "დაბლოკილი"], ["inactive", "არააქტიური"],
  ] as const
  return <>
    <PageHeading eyebrow="Customer directory" title="კლიენტები" description="ანგარიში, ბრენდი, გამოწერა და სამუშაო სივრცის მდგომარეობა ერთ ხედში." meta={`${customers.length} კლიენტი`} />
    <section className="admin-panel admin-directory">
      <div className="admin-directory-tools">
        <form className="admin-search" action="/admin/customers">
          <AdminIcon name="search" /><label className="sr-only" htmlFor="admin-search">კლიენტის ძებნა</label>
          <input id="admin-search" name="q" defaultValue={query} placeholder="სახელი, ელფოსტა ან ბრენდი…" />
          {filter !== "all" ? <input type="hidden" name="filter" value={filter} /> : null}
          <button>ძებნა</button>
        </form>
        <div className="admin-filters" aria-label="კლიენტების ფილტრი">
          {filters.map(([value, label]) => <Link key={value} className={filter === value ? "is-active" : ""} href={`/admin/customers?filter=${value}${query ? `&q=${encodeURIComponent(query)}` : ""}`}>{label}</Link>)}
        </div>
      </div>
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead><tr><th>კლიენტი</th><th>ბრენდი / Workspace</th><th>გამოწერა</th><th>მდგომარეობა</th><th>ბოლო აქტივობა</th><th><span className="sr-only">გახსნა</span></th></tr></thead>
          <tbody>{filtered.map((customer) => <tr key={customer.id}>
            <td><CustomerLink customer={customer} /></td>
            <td><strong className="admin-cell-primary">{customerWorkspaceName(customer)}</strong><small className="admin-cell-secondary">{customer.brandNames.length} ბრენდი</small></td>
            <td><SubscriptionPill lifecycle={customer.subscription.lifecycle} /><small className="admin-cell-secondary">{customer.subscription.plan ? planLabels[customer.subscription.plan] ?? customer.subscription.plan : "გეგმის გარეშე"}</small></td>
            <td><HealthPill status={customer.health} />{customer.healthReasons[0] ? <small className="admin-cell-secondary">{customer.healthReasons[0].label}</small> : null}</td>
            <td><time dateTime={customer.lastMeaningfulActivityAt}>{relativeTime(customer.lastMeaningfulActivityAt)}</time></td>
            <td><Link className="admin-row-arrow" href={`/admin/customers/${encodeURIComponent(customer.id)}`} aria-label={`${customer.name} — დეტალურად`}><AdminIcon name="arrow" /></Link></td>
          </tr>)}</tbody>
        </table>
      </div>
      {filtered.length === 0 ? <EmptyState title="კლიენტი ვერ მოიძებნა" detail="შეცვალეთ საძიებო სიტყვა ან არჩეული ფილტრი." /> : <p className="admin-table-count">ნაჩვენებია {filtered.length} / {customers.length}</p>}
    </section>
  </>
}

function detailStatus(value: string | null) {
  if (!value) return "ჯერ არ დაწყებულა"
  const labels: Record<string, string> = {
    approved: "დამტკიცებულია", ready: "მზადაა", running: "მიმდინარეობს", queued: "რიგშია",
    failed: "შეცდომა", changesRequested: "ცვლილებაა მოთხოვნილი", proposed: "შეთავაზებულია", superseded: "ჩანაცვლებულია",
  }
  return labels[value] ?? value
}

export function CustomerDetailView({ detail }: { detail: AdminCustomerDetail }) {
  const { customer } = detail
  return <>
    <nav className="admin-breadcrumb" aria-label="Breadcrumb"><Link href="/admin/customers">კლიენტები</Link><span>/</span><span>{customer.name}</span></nav>
    <header className="admin-customer-hero">
      <div className="admin-customer-avatar">{customer.name.slice(0, 1).toLocaleUpperCase("ka-GE")}</div>
      <div><p className="admin-eyebrow">Customer workspace</p><h1>{customer.name}</h1><p>{customer.email} · შემოგვიერთდა {date(customer.joinedAt)}</p><div><SubscriptionPill lifecycle={customer.subscription.lifecycle} /><HealthPill status={customer.health} /></div></div>
    </header>

    {customer.healthReasons.length ? <section className={`admin-health-callout health-callout-${customer.health}`}><div><HealthPill status={customer.health} /><h2>{customer.healthReasons[0]!.label}</h2></div><ul>{customer.healthReasons.map((reason) => <li key={reason.code}><strong>{reason.label}</strong><span>{reason.detail}</span></li>)}</ul></section> : null}

    <div className="admin-detail-grid">
      <section className="admin-panel admin-detail-card"><div className="admin-panel-heading"><div><p className="admin-eyebrow">Account</p><h2>ანგარიში</h2></div></div>
        <dl className="admin-definition-list"><div><dt>სახელი</dt><dd>{customer.name}</dd></div><div><dt>ელფოსტა</dt><dd>{customer.email}</dd></div><div><dt>დადასტურება</dt><dd>{customer.emailVerified ? "დადასტურებულია" : "არ არის დადასტურებული"}</dd></div><div><dt>რეგისტრაცია</dt><dd>{dateTime(customer.joinedAt)}</dd></div></dl>
      </section>
      <section className="admin-panel admin-detail-card"><div className="admin-panel-heading"><div><p className="admin-eyebrow">Subscription</p><h2>მიმდინარე გამოწერა</h2></div></div>
        <dl className="admin-definition-list"><div><dt>სტატუსი</dt><dd><SubscriptionPill lifecycle={customer.subscription.lifecycle} /></dd></div><div><dt>გეგმა</dt><dd>{customer.subscription.plan ? planLabels[customer.subscription.plan] ?? customer.subscription.plan : "—"}</dd></div><div><dt>აქტივაცია</dt><dd>{customer.subscription.paidAt ? date(customer.subscription.paidAt) : "—"}</dd></div><div><dt>ვადა</dt><dd>{customer.subscription.expiresAt ? date(customer.subscription.expiresAt) : "—"}</dd></div></dl>
      </section>
    </div>

    <section className="admin-panel admin-detail-wide"><div className="admin-panel-heading"><div><p className="admin-eyebrow">Workspace & planning</p><h2>ბრენდები და მიმდინარე სამუშაო</h2></div></div>
      {detail.brands.length === 0 ? <EmptyState title="ბრენდი ჯერ არ არის" detail="Onboarding-ის დასრულების შემდეგ სამუშაო სივრცის მდგომარეობა აქ გამოჩნდება." /> : <div className="admin-brand-grid">{detail.brands.map((brand) => <article key={brand.id}><div><span className={`admin-readiness ${brand.ready ? "is-ready" : ""}`}>{brand.ready ? "ცოდნა მზადაა" : "Onboarding დაუსრულებელია"}</span><h3>{brand.name}</h3><p>შექმნილია {date(brand.createdAt)}</p></div><dl><div><dt>სტრატეგია</dt><dd>{detailStatus(brand.strategyStatus)}</dd></div><div><dt>კვირის გეგმა</dt><dd>{detailStatus(brand.planningStatus)}</dd></div><div><dt>კონტენტი</dt><dd>{detailStatus(brand.contentStatus)}</dd></div></dl></article>)}</div>}
    </section>

    <div className="admin-detail-grid admin-detail-operational">
      <section className="admin-panel admin-detail-card"><div className="admin-panel-heading"><div><p className="admin-eyebrow">Connections</p><h2>Facebook / Instagram</h2></div></div>
        {detail.connections.length === 0 ? <EmptyState title="კავშირი არ არის" detail="სოციალური ანგარიში ჯერ არ დაკავშირებულა." /> : <div className="admin-connection-list">{detail.connections.map((connection) => <article key={connection.id}><span className={`admin-channel channel-${connection.channel}`}>{connection.channel.slice(0, 1).toUpperCase()}</span><div><strong>{connection.displayName ?? connection.username ?? connection.channel}</strong><small>{connection.channel} · შემოწმდა {relativeTime(connection.lastKnownAt)}</small>{connection.lastErrorCode ? <em>{connection.lastErrorCode}</em> : null}</div><span className={`admin-connection-state ${connection.connectionStatus === "connected" && connection.canPublish ? "is-connected" : ""}`}>{connection.connectionStatus === "connected" && connection.canPublish ? "მზადაა" : "შეფერხებულია"}</span></article>)}</div>}
      </section>
      <section className="admin-panel admin-detail-card"><div className="admin-panel-heading"><div><p className="admin-eyebrow">Publishing</p><h2>მიწოდების სურათი</h2></div></div>
        <div className="admin-publishing-stats"><div><strong>{detail.publishing.scheduled}</strong><span>დაგეგმილი</span></div><div><strong>{detail.publishing.published}</strong><span>გამოქვეყნებული</span></div><div className={detail.publishing.unresolved ? "has-warning" : ""}><strong>{detail.publishing.unresolved}</strong><span>დაუდგენელი</span></div><div className={detail.publishing.failed ? "has-danger" : ""}><strong>{detail.publishing.failed}</strong><span>წარუმატებელი</span></div></div>
        <p className="admin-panel-note">შედეგები მხოლოდ შენახული delivery history-დან იკითხება; გვერდის გახსნა retry-ს ან reconciliation-ს არ იწვევს.</p>
      </section>
    </div>

    <section className="admin-panel admin-detail-wide"><div className="admin-panel-heading"><div><p className="admin-eyebrow">Lifecycle history</p><h2>გამოწერის ისტორია</h2></div></div>
      {detail.subscriptionHistory.length === 0 ? <EmptyState title="გადახდის ისტორია არ არის" detail="ამ კლიენტისთვის subscription payment ჯერ არ დაფიქსირებულა." /> : <div className="admin-history-list">{detail.subscriptionHistory.map((item, index) => <article key={item.id}><span>{String(detail.subscriptionHistory.length - index).padStart(2, "0")}</span><div><strong>{planLabels[item.plan] ?? item.plan}</strong><small>{item.brandLimit} ბრენდი · {date(item.paidAt)} — {date(item.expiresAt)}</small></div><em>{item.mode}</em></article>)}</div>}
    </section>
  </>
}

function InterventionCard({ intervention, compact = false }: { intervention: AdminIntervention; compact?: boolean }) {
  return <article className={`admin-intervention priority-card-${intervention.reason.priority}`}>
    <div className="admin-intervention-mark"><span>!</span></div>
    <div className="admin-intervention-copy">
      <div><PriorityPill priority={intervention.reason.priority} />{compact ? null : <span className="admin-open-state">ღია</span>}</div>
      <h3>{intervention.reason.label}</h3><p>{intervention.reason.detail}</p>
      <small>{intervention.workspaceName} · {intervention.affectedCapability} · {relativeTime(intervention.detectedAt)}</small>
    </div>
    <Link href={`/admin/customers/${encodeURIComponent(intervention.customerId)}`} aria-label={`${intervention.workspaceName} — დეტალურად`}><AdminIcon name="arrow" /></Link>
  </article>
}

export function InterventionsView({ interventions, priority }: { interventions: AdminIntervention[]; priority: string }) {
  const filtered = priority === "all" ? interventions : interventions.filter((item) => item.reason.priority === priority)
  const urgent = interventions.filter((item) => item.reason.priority === "urgent").length
  return <>
    <PageHeading eyebrow="Human attention queue" title="ჩარევები" description="მხოლოდ შემთხვევები, სადაც UNDA-ს გუნდის მოქმედება შეიძლება რეალურად იყოს საჭირო." meta={`${interventions.length} ღია · ${urgent} სასწრაფო`} />
    <div className="admin-filters standalone" aria-label="პრიორიტეტის ფილტრი">{[["all", "ყველა"], ["urgent", "სასწრაფო"], ["normal", "ჩვეულებრივი"], ["low", "დაბალი"]].map(([value, label]) => <Link key={value} className={priority === value ? "is-active" : ""} href={`/admin/interventions?priority=${value}`}>{label}</Link>)}</div>
    <section className="admin-panel admin-interventions-panel">
      {filtered.length === 0 ? <EmptyState title="ამ ფილტრში ჩარევა არ არის" detail="ახალი intervention-worthy პრობლემა ავტომატურად გამოჩნდება ამ რიგში." /> : <div className="admin-intervention-list">{filtered.map((item) => <InterventionCard key={item.id} intervention={item} />)}</div>}
      <p className="admin-panel-note">Analytics-ის უბრალო დაგვიანება informational health reason-ად რჩება და რიგს არ ავსებს.</p>
    </section>
  </>
}

export function SubscriptionsView({ customers }: { customers: AdminCustomer[] }) {
  const rows = customers.toSorted((a, b) => Date.parse(b.subscription.paidAt ?? b.joinedAt) - Date.parse(a.subscription.paidAt ?? a.joinedAt))
  return <>
    <PageHeading eyebrow="Subscription lifecycle" title="გამოწერები" description="მიმდინარე მდგომარეობა და შენახული lifecycle — გაუქმებული ან წასული კლიენტი ისტორიიდან არ ქრება." meta={`${customers.filter((item) => item.subscription.lifecycle === "active").length} აქტიური`} />
    <section className="admin-panel admin-directory"><div className="admin-table-wrap"><table className="admin-table admin-subscription-table"><thead><tr><th>კლიენტი</th><th>სტატუსი</th><th>გეგმა</th><th>დაწყება</th><th>ვადა</th><th>ისტორია</th></tr></thead><tbody>{rows.map((customer) => <tr key={customer.id}><td><CustomerLink customer={customer} /></td><td><SubscriptionPill lifecycle={customer.subscription.lifecycle} /></td><td><strong className="admin-cell-primary">{customer.subscription.plan ? planLabels[customer.subscription.plan] ?? customer.subscription.plan : "—"}</strong></td><td>{customer.subscription.paidAt ? date(customer.subscription.paidAt) : "—"}</td><td>{customer.subscription.expiresAt ? date(customer.subscription.expiresAt) : "—"}</td><td><span className="admin-payment-count">{customer.subscription.paymentCount}</span></td></tr>)}</tbody></table></div></section>
    <aside className="admin-integrity-note"><AdminIcon name="shield" /><div><strong>Lifecycle integrity</strong><p>არსებული მოდელი cancellation-სა და trial-ს ცალკე მოვლენად ჯერ არ ინახავს. ამიტომ ეს ხედიც მხოლოდ დადასტურებულ active / expired / no subscription მდგომარეობებს აჩვენებს.</p></div></aside>
  </>
}

export function CommunicationView() {
  return <>
    <PageHeading eyebrow="Operational communication" title="კომუნიკაცია" description="კლიენტთან მიზნობრივი ოპერაციული შეტყობინებების ჟურნალი — generic email client-ის გარეშე." />
    <div className="admin-communication-layout">
      <section className="admin-panel admin-communication-empty"><div className="admin-mail-illustration"><AdminIcon name="communication" /></div><h2>გაგზავნილი კომუნიკაცია ჯერ არ ინახება</h2><p>არსებულ სისტემაში durable communication journal არ არის. ამიტომ გვერდი ცარიელ მდგომარეობას ზუსტად აჩვენებს და წერილებს არ იგონებს.</p><span>Read-only foundation</span></section>
      <aside className="admin-panel admin-purpose-panel"><p className="admin-eyebrow">Purpose-based flow</p><h2>დაგეგმილი კატეგორიები</h2><ul><li><span>01</span><div><strong>კავშირის აღდგენა</strong><small>Facebook / Instagram reconnection</small></div></li><li><span>02</span><div><strong>გადახდის საკითხი</strong><small>Subscription action required</small></div></li><li><span>03</span><div><strong>სისტემური პრობლემა</strong><small>Important service incident</small></div></li><li><span>04</span><div><strong>ანგარიშის მოქმედება</strong><small>Customer action required</small></div></li></ul><p>გაგზავნა დაემატება მხოლოდ explicit domain workflow-ით და audit trail-ით.</p></aside>
    </div>
  </>
}

export function AuditView({ events }: { events: AdminAuditEvent[] }) {
  return <>
    <PageHeading eyebrow="Meaningful event history" title="აუდიტი" description="რა მოხდა სისტემაში, როდის და ვინ ან რამ გამოიწვია — დაბალი დონის ტექნიკური log-ების გარეშე." meta={`${events.length} ბოლო მოვლენა`} />
    <section className="admin-panel admin-audit-panel"><AuditList events={events} /></section>
  </>
}
