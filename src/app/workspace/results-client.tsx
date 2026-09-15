"use client"

import type { SocialAnalyticsResult, SocialMetricName } from "../../application/analytics/social-analytics-store"
import { SOCIAL_METRIC_NAMES } from "../../application/analytics/social-analytics-store"
import { displayDate } from "../../application/dashboard/model"

const labels: Record<SocialMetricName | "engagementRate", string> = { impressions: "ჩვენებები", reach: "მიღწევა", likes: "მოწონებები",
  comments: "კომენტარები", shares: "გაზიარებები", saves: "შენახვები", clicks: "დაკლიკებები", views: "ნახვები",
  follows: "გამოწერები", engagementRate: "ჩართულობის მაჩვენებელი" }

export function ResultsClient({ results }: { results: readonly SocialAnalyticsResult[] }) {
  const postCount = new Set(results.map((r) => JSON.stringify([r.providerBindingId, r.providerPublicationRef]))).size
  const latest = results.reduce<string | null>((date, r) => !date || r.providerUpdatedAt > date ? r.providerUpdatedAt : date, null)
  return <>
    <header className="ws-page-heading"><div><p className="ws-eyebrow">დაკვირვებიდან შემდეგ გადაწყვეტილებამდე</p><h1>შედეგები და შემდეგი ნაბიჯი</h1><p>რა მონაცემი გვაქვს და რისი დასკვნა შეგვიძლია მის საფუძველზე.</p></div></header>
    <section className="brief-lead brief-results"><p className="ws-eyebrow">შენახული გაზომვები · ყველა პერიოდი</p><h2>{results.length ? `${postCount} პოსტის მონაცემები ხელმისაწვდომია` : "შედეგების შესაფასებლად მონაცემები ჯერ არ გვაქვს"}</h2><p>{latest ? `წყაროს ბოლო გაზომვა: ${displayDate(latest, { year: "numeric", hour: "2-digit" })}.` : "ავტომატური შედეგები ჯერ არ არის ხელმისაწვდომი. ეს ნულოვან შედეგს არ ნიშნავს."}</p>
      <div className="brief-grid"><section><h3>რას ვასკვნით</h3><p>{results.length ? "გაზომვები დაკვირვების საფუძველია. ამ გვერდზე სტრატეგიის შეცვლის დასკვნა ჯერ არ არის ჩამოყალიბებული." : "მონაცემების მიღებამდე კონტენტის ეფექტიანობას ვერ ვაფასებთ."}</p></section><section><h3>შემდეგი ნაბიჯი</h3><p>{results.length ? "შევადაროთ დაკვირვებები შეთანხმებულ მიზანსა და იმავე პერიოდის ბიზნესკონტექსტს. საჭირო კონტექსტი ქვემოთ შეგიძლიათ დაამატოთ." : "შეამოწმეთ ანგარიშის კავშირი და გამოქვეყნება. ხელმისაწვდომი გარე დაკვირვება შეგიძლიათ წყაროსთან ერთად დაამატოთ."}</p></section></div><small>აქ ავტომატურად ინახება UNDA-ს პუბლიკაციების გაზომვები. ერთი პოსტი ან მაჩვენებლის ზრდა მიზეზშედეგობრივ კავშირს არ ამტკიცებს.</small>
    </section>
    {results.length ? <details className="brief-details"><summary>გაზომილი მაჩვენებლები და ისტორია · {postCount} პოსტი · {results.length} ჩანაწერი</summary><div className="brief-results-detail"><section className="ws-results-feed" aria-label="სოციალური პოსტების გაზომილი შედეგები">
    <header><p className="ws-eyebrow">დაკავშირებული ანგარიშებიდან</p><h2>პოსტების ფაქტობრივი მაჩვენებლები</h2><p>თითოეული ჩანაწერი კონკრეტულ პოსტსა და გაზომვის დროს ეკუთვნის.</p></header>
    {results.map((result) => <article className="ws-card ws-result-card" key={`${result.providerBindingId}:${result.providerPublicationRef}:${result.providerUpdatedAt}`}>
      <div><strong>{result.channel === "facebook" ? "Facebook" : "Instagram"}</strong><time dateTime={result.providerUpdatedAt}>{displayDate(result.providerUpdatedAt, { year: "numeric", hour: "2-digit" })}</time>{result.publicationUrl ? <a href={result.publicationUrl} target="_blank" rel="noreferrer">პოსტის ნახვა ↗</a> : null}</div>
      <dl>{[...SOCIAL_METRIC_NAMES, "engagementRate" as const].map((name) => <div key={name}><dt>{labels[name]}</dt><dd>{result.metrics[name] === null ? <span aria-label="მონაცემი მიუწვდომელია">—</span> : name === "engagementRate" ? `${result.metrics[name]}%` : result.metrics[name]!.toLocaleString("ka-GE")}</dd></div>)}</dl>
      <small>— ნიშნავს, რომ წყარომ მაჩვენებელი არ მოგვაწოდა; 0 ნიშნავს გაზომილ ნულს.</small>
    </article>)}
  </section></div></details> : null}
  </>
}
