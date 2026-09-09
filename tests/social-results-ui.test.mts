import assert from "node:assert/strict"
import test from "node:test"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { ResultsClient } from "../src/app/workspace/results-client"

test("Results UI distinguishes measured zero from unavailable metrics", () => {
  const html = renderToStaticMarkup(createElement(ResultsClient, { results: [{ provider: "zernio", providerProfileRef: "profile",
    providerAccountRef: "provider-account", channel: "facebook", providerPublicationRef: "post", nativePublicationRef: null,
    publicationUrl: null, providerUpdatedAt: "2026-09-09T12:00:00.000Z", observedAt: "2026-09-09T12:01:00.000Z",
    metrics: { impressions: 0, reach: null, likes: 0, comments: null, shares: null, saves: null, clicks: null, views: null,
      follows: null, engagementRate: null }, availability: { impressions: true, reach: false, likes: true, comments: false,
      shares: false, saves: false, clicks: false, views: false, follows: false, engagementRate: false }, rawMetrics: { impressions: 0, likes: 0 },
    publishingAccountId: "account", providerBindingId: "binding" }] }))
  assert.match(html, />0</u)
  assert.match(html, /aria-label="მონაცემი მიუწვდომელია">—</u)
})
