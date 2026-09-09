"use client"

import type { SocialAnalyticsResult, SocialMetricName } from "../../application/analytics/social-analytics-store"
import { SOCIAL_METRIC_NAMES } from "../../application/analytics/social-analytics-store"
import { displayDate } from "../../application/dashboard/model"

const labels: Record<SocialMetricName | "engagementRate", string> = { impressions: "ჩვენებები", reach: "მიღწევა", likes: "მოწონებები",
  comments: "კომენტარები", shares: "გაზიარებები", saves: "შენახვები", clicks: "დაკლიკებები", views: "ნახვები",
  follows: "გამოწერები", engagementRate: "ჩართულობის მაჩვენებელი" }

export function ResultsClient({ results }: { results: readonly SocialAnalyticsResult[] }) {
  if (!results.length) return <section className="ws-card ws-results-empty"><h2>ავტომატური შედეგები ჯერ არ არის ხელმისაწვდომი</h2><p>გამოქვეყნებული პოსტის პირველი გაზომილი მონაცემი აქ გამოჩნდება. მიუწვდომელი მაჩვენებელი ნულად არ ჩაითვლება.</p></section>
  return <section className="ws-results-feed" aria-label="სოციალური პოსტების გაზომილი შედეგები">
    <header><p className="ws-eyebrow">დაკავშირებული ანგარიშებიდან</p><h2>პოსტების ფაქტობრივი მაჩვენებლები</h2><p>თითოეული ჩანაწერი კონკრეტულ პოსტსა და გაზომვის დროს ეკუთვნის.</p></header>
    {results.map((result) => <article className="ws-card ws-result-card" key={`${result.providerBindingId}:${result.providerPublicationRef}:${result.providerUpdatedAt}`}>
      <div><strong>{result.channel === "facebook" ? "Facebook" : "Instagram"}</strong><time dateTime={result.providerUpdatedAt}>{displayDate(result.providerUpdatedAt, { year: "numeric", hour: "2-digit" })}</time>{result.publicationUrl ? <a href={result.publicationUrl} target="_blank" rel="noreferrer">პოსტის ნახვა ↗</a> : null}</div>
      <dl>{[...SOCIAL_METRIC_NAMES, "engagementRate" as const].map((name) => <div key={name}><dt>{labels[name]}</dt><dd>{result.metrics[name] === null ? <span aria-label="მონაცემი მიუწვდომელია">—</span> : name === "engagementRate" ? `${result.metrics[name]}%` : result.metrics[name]!.toLocaleString("ka-GE")}</dd></div>)}</dl>
      <small>— ნიშნავს, რომ წყარომ მაჩვენებელი არ მოგვაწოდა; 0 ნიშნავს გაზომილ ნულს.</small>
    </article>)}
  </section>
}
