import assert from "node:assert/strict"
import test from "node:test"
import { evidencePeriod, summarizeWeekResults, MAX_EVIDENCE_POSTS } from "../src/application/analytics/week-evidence"
import { confirmedPublication } from "./week-result-fixture"
import type { WeekEvidence } from "../src/blueprints/social/strategy/model"
import { planningEvidenceContext } from "../src/application/analytics/planning-evidence-context"

const summary = (publications: ReturnType<typeof confirmedPublication>[], asOf = "2026-09-15T00:00:00.000Z") => summarizeWeekResults({ week: "2026-09-07", asOf, publications })
test("latest comparable snapshot replaces cumulative history and preserves measured zero and missing fields", () => {
  const old = confirmedPublication(), latest = structuredClone(old)
  old.measurement!.metrics = { ...old.measurement!.metrics, likes: 5 }
  latest.measurement!.providerUpdatedAt = "2026-09-11T12:00:00.000Z"
  latest.measurement!.metrics = { ...latest.measurement!.metrics, likes: null }
  latest.measurement!.availability = { ...latest.measurement!.availability, likes: false }
  const result = summary([old, latest])
  assert.equal(result.results!.publicationCount, 1)
  assert.equal(result.results!.posts[0]!.measurement!.metrics.impressions, 0)
  assert.equal(result.results!.posts[0]!.measurement!.metrics.likes, null, "no sum or carry-forward from older snapshots")
  assert.equal(result.results!.posts[0]!.measurement!.ageHours, 48)
  assert.equal(result.availability, "partial")
})
test("cutoffs exclude future source updates, later ingestion and later confirmations", () => {
  for (const key of ["providerUpdatedAt", "observedAt", "storedAt"] as const) {
    const p = confirmedPublication(); p.measurement![key] = "2026-09-16T00:00:00.000Z"
    assert.equal(summary([p]).results!.measuredPostCount, 0, key)
  }
  const p = confirmedPublication(); p.confirmedAt = "2026-09-16T00:00:00.000Z"
  assert.equal(summary([p]).results!.publicationCount, 0)
})
test("manual connected and downstream assertions cannot mint measurement authority", () => {
  const manual: WeekEvidence = { week: "2026-09-07", reviewedAt: "2026-09-11T12:00:00.000Z", availability: "available",
    observations: [{ level: "connected", observation: "sales doubled", source: "owner export" }], execution: ["published five posts"], unknowns: ["attribution"], businessContext: "promotion" }
  const e = summarizeWeekResults({ week: manual.week, asOf: "2026-09-15T00:00:00.000Z", publications: [], manual })
  assert.equal(e.availability, "unavailable"); assert.equal(e.results!.publicationCount, 0)
  assert.equal(e.observations[0]!.provenance, "manual"); assert.deepEqual(e.manual!.execution, manual.execution)
  assert.equal(e.businessContext, "promotion")
  const legacy = planningEvidenceContext([manual])[0]!
  assert.equal(legacy.availability, "unavailable"); assert.equal(legacy.provenance, "manual-legacy")
  assert.equal(legacy.results, null); assert.deepEqual(legacy.manual!.execution, manual.execution)
  const limitationsOnly = summarizeWeekResults({ week: "2026-08-31", asOf: "2026-09-15T00:00:00.000Z", publications: [],
    manual: { ...manual, week: "2026-08-31", observations: [], execution: [], businessContext: "", unknowns: ["CRM export unavailable"] } })
  const empty = summarizeWeekResults({ week: "2026-09-07", asOf: "2026-09-15T00:00:00.000Z", publications: [] })
  assert.equal(planningEvidenceContext([empty, limitationsOnly])[0]!.manual!.unknowns[0], "CRM export unavailable", "limitations-only notes are not discarded")
})
test("publication periods use Tbilisi midnight and exclude their next Monday", () => {
  assert.deepEqual(evidencePeriod("2026-09-07"), { start: "2026-09-06T20:00:00.000Z", end: "2026-09-13T20:00:00.000Z" })
  const p = confirmedPublication(); p.measurement = null
  p.publishedAt = "2026-09-06T20:00:00.000Z"; assert.equal(summary([p]).results!.publicationCount, 1)
  p.publishedAt = "2026-09-13T20:00:00.000Z"; assert.equal(summary([p]).results!.publicationCount, 0)
})
test("native publication identity deduplicates reconnects within a canonical account and excludes conflicting versions", () => {
  const p = confirmedPublication(), replacement = structuredClone(p)
  replacement.provider = "meta"; replacement.providerPublicationRef = "meta-post"
  replacement.lineage = { ...replacement.lineage, providerBindingId: "replacement", attemptId: "later-attempt" }
  replacement.measurement = { ...replacement.measurement!, provider: "meta", providerBindingId: "replacement", providerPublicationRef: "meta-post" }
  assert.equal(summary([p, replacement]).results!.publicationCount, 1)
  replacement.lineage.draftVersion = 2
  const conflict = summary([p, replacement]).results!
  assert.equal(conflict.publicationCount, 1); assert.equal(conflict.posts[0]!.lineageConflict, true); assert.equal(conflict.measuredPostCount, 0)
  replacement.publishingAccountId = "other-account"
  assert.equal(summary([p, replacement]).results!.publicationCount, 2)
})
test("complete measured coverage is available only for a closed, untruncated period", () => {
  const p = confirmedPublication()
  p.measurement!.metrics = Object.fromEntries(Object.keys(p.measurement!.metrics).map(k => [k, 0])) as NonNullable<typeof p.measurement>["metrics"]
  p.measurement!.availability = Object.fromEntries(Object.keys(p.measurement!.availability).map(k => [k, true])) as NonNullable<typeof p.measurement>["availability"]
  assert.equal(summary([p]).availability, "available")
  assert.equal(summary([p], "2026-09-12T12:00:00.000Z").availability, "partial")
  p.measurement!.nativePublicationRef = null
  assert.equal(summary([p]).availability, "partial", "unknown cross-provider identity limits complete coverage")
  const many = Array.from({ length: MAX_EVIDENCE_POSTS + 1 }, (_, i) => confirmedPublication(String(i)))
  const bounded = summary(many)
  assert.equal(bounded.results!.publicationCount, many.length); assert.equal(bounded.results!.posts.length, MAX_EVIDENCE_POSTS)
  assert.equal(bounded.results!.truncated, true); assert.equal(bounded.availability, "partial")
})
