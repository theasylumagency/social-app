import assert from "node:assert/strict"
import test from "node:test"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { ResultsClient } from "../src/app/workspace/results-client"
import { summarizeWeekResults } from "../src/application/analytics/week-evidence"
import { confirmedPublication } from "./week-result-fixture"

test("Results UI distinguishes measured zero from unavailable metrics", () => {
  const evidence = summarizeWeekResults({ week: "2026-09-07", asOf: "2026-09-15T00:00:00.000Z", publications: [confirmedPublication()] })
  const html = renderToStaticMarkup(createElement(ResultsClient, { evidence: [evidence], objective: "Increase qualified inquiries" }))
  assert.match(html, />0</u)
  assert.match(html, /aria-label="მონაცემი მიუწვდომელია">—</u)
  assert.match(html, /ნაწილობრივ ხელმისაწვდომია/u)
  assert.match(html, /გაზომვის დროს პოსტის ასაკი: 24 საათი/u)
  assert.match(html, /Increase qualified inquiries/u)
  assert.match(html, /პუბლიკაციის კვირა<select/u)
})

test("Results UI keeps manual observations visible without implying measured performance", () => {
  const evidence = summarizeWeekResults({ week: "2026-09-07", asOf: "2026-09-15T00:00:00.000Z", publications: [],
    manual: { week: "2026-09-07", reviewedAt: "2026-09-12T00:00:00.000Z", availability: "available",
      observations: [{ level: "downstream", observation: "Reported customer inquiry", source: "CRM export" }], execution: [], unknowns: ["CRM export incomplete"], businessContext: "Promotion" } })
  const html = renderToStaticMarkup(createElement(ResultsClient, { evidence: [evidence] }))
  assert.match(html, /გაზომვები ჯერ მიუწვდომელია/u)
  assert.match(html, /Reported customer inquiry/u)
  assert.match(html, /მომხმარებლის წყარო: CRM export/u)
  assert.match(html, /თქვენ მიერ აღნიშნული შეზღუდვა: CRM export incomplete/u)
  assert.doesNotMatch(html, /ws-result-card/u)
})
