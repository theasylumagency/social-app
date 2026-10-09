"use client"

import { useState } from "react"
import type { SocialMetricName } from "../../application/analytics/social-analytics-store"
import { SOCIAL_METRIC_NAMES } from "../../application/analytics/social-analytics-store"
import type { WeekEvidence } from "../../blueprints/social/strategy/model"
import { displayDate, weekLabel } from "../../application/dashboard/model"

const labels: Record<SocialMetricName | "engagementRate", string> = { impressions: "ჩვენებები", reach: "მიღწევა", likes: "მოწონებები",
  comments: "კომენტარები", shares: "გაზიარებები", saves: "შენახვები", clicks: "დაკლიკებები", views: "ნახვები",
  follows: "გამოწერები", engagementRate: "ჩართულობის მაჩვენებელი" }
const availability = { available: "გაზომვები ხელმისაწვდომია", partial: "გაზომვები ნაწილობრივ ხელმისაწვდომია", unavailable: "გაზომვები ჯერ მიუწვდომელია" }

export function ResultsClient({ evidence, objective }: { evidence: readonly WeekEvidence[]; objective?: string | undefined }) {
  const [week, setWeek] = useState(evidence.find(e => (e.results?.publicationCount ?? 0) > 0 || e.observations.length || e.businessContext || e.manual?.execution.length || e.manual?.unknowns.length)?.week ?? evidence[1]?.week ?? evidence[0]?.week ?? "")
  const selected = evidence.find(e => e.week === week) ?? evidence[0]
  const results = selected?.results
  return <>
    <header className="ws-page-heading"><div><p className="ws-eyebrow">დაკვირვებიდან შემდეგ გადაწყვეტილებამდე</p><h1>შედეგები და შემდეგი ნაბიჯი</h1><p>რა მონაცემი გვაქვს და რისი დასკვნა შეგვიძლია მის საფუძველზე.</p></div></header>
    {evidence.length ? <label>პუბლიკაციის კვირა<select value={selected?.week ?? ""} onChange={e => setWeek(e.target.value)}>{evidence.map(e => <option key={e.week} value={e.week}>{weekLabel(e.week)}</option>)}</select></label> : null}
    <section className="brief-lead brief-results"><p className="ws-eyebrow">დადასტურებული პუბლიკაციები · თბილისის დრო</p><h2>{availability[selected?.availability ?? "unavailable"]}</h2>
      <p>{results ? `${results.publicationCount}${results.truncated ? " ან მეტი" : ""} დადასტურებული პუბლიკაცია; შერჩევაში ${results.measuredPostCount} პოსტის გაზომვა.` : "ავტომატური შედეგები ჯერ არ არის ხელმისაწვდომი. ეს ნულოვან შედეგს არ ნიშნავს."}</p>
      {results ? <p>მონაცემები აღებულია: <time dateTime={results.asOf}>{displayDate(results.asOf, { year: "numeric", hour: "2-digit" })}</time>. {results.period.closed ? "პუბლიკაციის კვირა დასრულებულია." : "პუბლიკაციის კვირა ჯერ მიმდინარეობს."}</p> : null}
      <div className="brief-grid"><section><h3>რას ვასკვნით</h3><p>ვხედავთ თითოეული პოსტის ბოლო ხელმისაწვდომ გაზომვას. უცნობი მაჩვენებელი ნულს არ ნიშნავს. პოსტის ასაკისა და წყაროს განსხვავება პირდაპირ შედარებას ზღუდავს.</p></section><section><h3>შემდეგი ნაბიჯი</h3>{objective ? <p>მოქმედი მიზანი: {objective}</p> : null}<p>ახალი გეგმა ბოლო ოთხი კვირის ამავე წესით შერჩეულ შედეგებსა და თქვენს ბიზნესკონტექსტს გაითვალისწინებს. გეგმის შექმნისას მონაცემები ფიქსირდება; მოგვიანებით მიღებული გაზომვები უკვე შექმნილ გეგმას არ ცვლის.</p></section></div>
      {selected?.unknowns.length ? <details className="brief-details"><summary>მონაცემების ფარგლები და განმარტებები</summary>{selected.unknowns.map((note, i) => <p key={i}><small>{note}</small></p>)}</details> : null}
    </section>
    {(selected?.observations.length || selected?.businessContext || selected?.manual?.execution.length || selected?.manual?.unknowns.length) ? <section className="ws-card"><h2>თქვენი დამატებული კონტექსტი</h2><p>ეს ჩანაწერები მომხმარებლის მოწოდებულია და ავტომატური გაზომვის სტატუსს არ ცვლის.</p>{selected.manual?.execution.map((text, i) => <p key={i}>{text}</p>)}{selected.observations.map((o, i) => <article key={i}><p>{o.observation}</p><small>მომხმარებლის წყარო: {o.source}</small></article>)}{selected.manual?.unknowns.map((text, i) => <p key={i}>თქვენ მიერ აღნიშნული შეზღუდვა: {text}</p>)}<p>{selected.businessContext}</p></section> : null}
    {results?.posts.length ? <section className="ws-results-feed" aria-label="სოციალური პოსტების გაზომილი შედეგები"><header><h2>პოსტების ბოლო ხელმისაწვდომი გაზომვები</h2><p>განმეორებითი გაზომვები არ ჯამდება. მაჩვენებლები შეიძლება პუბლიკაციის კვირის შემდეგ მიღებულ რეაქციებსაც მოიცავდეს.</p></header>
      {results.posts.map(post => <article className="ws-card ws-result-card" key={post.identity}>
        <div><strong>{post.channel === "facebook" ? "Facebook" : "Instagram"}</strong><span>გამოქვეყნდა: <time dateTime={post.publishedAt}>{displayDate(post.publishedAt, { year: "numeric", hour: "2-digit" })}</time></span>{post.measurement?.publicationUrl ? <a href={post.measurement.publicationUrl} target="_blank" rel="noreferrer">პოსტის ნახვა ↗</a> : null}</div>
        {post.lineageConflict ? <p>პოსტის ვერსიის კავშირი დაზუსტებას საჭიროებს; მაჩვენებლები გამორიცხულია.</p> : post.measurement ? <p>ტექსტის ვერსია: {post.lineage[0]?.draftVersion}. წყარო: {post.measurement.provider}. გაზომვის დროს პოსტის ასაკი: {post.measurement.ageHours} საათი. ბოლო გაზომვა: <time dateTime={post.measurement.providerUpdatedAt}>{displayDate(post.measurement.providerUpdatedAt, { year: "numeric", hour: "2-digit" })}</time>.</p> : <p>გაზომვა ჯერ მიუწვდომელია.</p>}
        <dl>{[...SOCIAL_METRIC_NAMES, "engagementRate" as const].map(name => <div key={name}><dt>{labels[name]}</dt><dd>{post.measurement?.metrics[name] === null || post.measurement?.metrics[name] === undefined ? <span aria-label="მონაცემი მიუწვდომელია">—</span> : post.measurement.metrics[name]!.toLocaleString("ka-GE")}</dd></div>)}</dl>
        <small>— ნიშნავს, რომ წყარომ მაჩვენებელი არ მოგვაწოდა; 0 ნიშნავს გაზომილ ნულს. ჩართულობის მაჩვენებელი ნაჩვენებია წყაროს მნიშვნელობით; მისი გამყოფი უცნობია.</small>
      </article>)}
    </section> : null}
  </>
}
