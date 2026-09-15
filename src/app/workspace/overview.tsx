import Link from "next/link"
import type { PlanningView } from "../../blueprints/social/weekly-planning/model"
import type { StrategyView } from "../../blueprints/social/strategy/model"
import type { ConnectionAccountView } from "../../application/social-connections/view"
import { buildBriefing, type BriefingItem } from "../../application/dashboard/briefing"
import { displayDate, weekLabel, type DashboardBrand } from "../../application/dashboard/model"
import { Icon } from "./icons"
import type { DeliverySnapshot } from "../../application/publishing/delivery-view"
import { DeliveryStatus } from "./delivery-status"

function AttentionItems({ title, items }: { title: string; items: BriefingItem[] }) {
  if (!items.length) return null
  return <section className="brief-attention" aria-label={title}><h2>{title}</h2><div className="brief-items">{items.map((item) => <article className="ws-card brief-item" key={item.id}><div><h3>{item.title}</h3><p>{item.detail}</p></div><Link className="ws-text-link" href={item.href}>{item.label} <Icon name="arrow" /></Link></article>)}</div></section>
}

export function Overview({ brand, strategy, planning, accounts, week, readAt, delivery }: {
  brand: DashboardBrand; strategy: StrategyView; planning: PlanningView; accounts: ConnectionAccountView[]; week: string; readAt: string; delivery: DeliverySnapshot
}) {
  const briefing = buildBriefing({ strategy, planning, accounts, week })
  const run = planning.run
  const plan = run?.payload.plan
  const active = strategy.active?.payload.proposal
  const deliveryAttention = delivery.availability === "unavailable" || delivery.items.some((item) => item.attention)
  return <div className="brief-page">
    <header className="ws-page-heading"><div><p className="ws-eyebrow">{brand.name} · {weekLabel(week)}</p><h1>მოკლე შეჯამება</h1><p>სად ვართ, რას ვამზადებთ და სად გვჭირდება თქვენი მონაწილეობა.</p></div><form action="/workspace" method="get"><button className="ws-button ws-button-outline">განახლება</button></form></header>
    <section className="brief-lead"><p className="ws-eyebrow">თქვენი ყურადღება</p><h2>{briefing.decisions.length ? `${briefing.decisions.length} გადაწყვეტილება გელით` : briefing.actions.length ? "გასაგრძელებლად თქვენი მონაწილეობაა საჭირო" : deliveryAttention ? "გამოქვეყნების მდგომარეობა შესამოწმებელია" : "გეგმასა და კონტენტზე გადაწყვეტილება არ გელით"}</h2><p>{briefing.work[0] ?? "ქვემოთ ჩანს გეგმისა და კონტენტის ბოლო შენახული მდგომარეობა."}</p>{deliveryAttention ? <p className="brief-caution">გამოქვეყნების ბლოკში არის გადასამოწმებელი მდგომარეობა.</p> : null}<small>ჩანაწერები წაკითხულია <time dateTime={readAt}>{displayDate(readAt, { hour: "2-digit" })}</time>. ყველა არხის უწყვეტი გამართულობა ამ გვერდით არ დასტურდება.</small></section>
    <AttentionItems title="თქვენი გადაწყვეტილება" items={briefing.decisions} />
    <AttentionItems title="რა არის გასაგრძელებელი" items={briefing.actions} />
    <DeliveryStatus snapshot={delivery} />
    <div className="brief-grid">
      <section className="ws-card brief-panel"><p className="ws-eyebrow">ამ კვირის სამუშაო</p><h2>{plan ? plan.objective.objective : "კვირის მიზანი ჯერ არ არის ჩამოყალიბებული"}</h2>{plan ? <p>{plan.objective.rationale}</p> : <p>მიზანი შეთანხმებულ სტრატეგიასა და ხელმისაწვდომ მონაცემებს დაეყრდნობა.</p>}{briefing.work.length ? <ul>{briefing.work.map((item) => <li key={item}>{item}</li>)}</ul> : null}{planning.stale ? <p className="brief-caution">გეგმის საფუძველი შეიცვალა — საჭიროა დაზუსტება.</p> : null}<Link className="ws-text-link" href={`/workspace/week?week=${week}`}>კვირის გეგმა <Icon name="arrow" /></Link></section>
      <section className="ws-card brief-panel"><p className="ws-eyebrow">შეთანხმებული მიმართულება</p><h2>{active?.objective ?? "სტრატეგია ჯერ არ არის დადასტურებული"}</h2>{active ? <p>{active.horizon}</p> : <p>სტრატეგიული არჩევანი თქვენს გადაწყვეტილებას ეკუთვნის.</p>}<Link className="ws-text-link" href="/workspace/strategy">სტრატეგია და მისი საფუძველი <Icon name="arrow" /></Link></section>
    </div>
    <details className="brief-details"><summary>ბოლო ჩანაწერები და შემოწმების ფარგლები</summary><div className="brief-panel"><dl className="brief-facts"><div><dt>კვირის გეგმა</dt><dd>{run ? `ვერსია ${run.version} · განახლდა ${displayDate(run.updatedAt, { hour: "2-digit" })}` : "ჩანაწერი ჯერ არ არის"}</dd></div><div><dt>ბრენდის სამუშაო საფუძველი</dt><dd>{planning.basis ? `დადასტურდა ${displayDate(planning.basis.confirmedAt, { year: "numeric" })}` : "მიმდინარე დადასტურებული ანალიზი მიუწვდომელია"}</dd></div><div><dt>კავშირების შენახული მდგომარეობა</dt><dd>{accounts.filter((a) => a.connected).length} დაკავშირებული ანგარიში</dd></div></dl><p>გამოქვეყნების ბლოკი UNDA-ს შენახულ განრიგსა და შედეგებს ეყრდნობა. გარე პოსტები და შედეგებიდან მიღებული დასკვნები ამ შეჯამებით არ მოწმდება.</p><div className="brief-links"><Link href="/workspace/content">განრიგი და კონტენტი ↗</Link><Link href="/workspace/results">შედეგების მონაცემები ↗</Link><Link href="/workspace/brand?view=history">ბრენდის ისტორია ↗</Link><Link href="/workspace/connections">კავშირები ↗</Link></div></div></details>
  </div>
}
