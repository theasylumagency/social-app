import assert from "node:assert/strict"
import test from "node:test"
import { inspectSocialPresence } from "../src/application/social-strategy/reconnaissance"
import { assertStrategyRevision, validateStrategyProposal, STRATEGY_SCHEMA } from "../src/blueprints/social/strategy/model"
import { validateSchema } from "../src/blueprints/social/brand-discovery/validation"
import { strategyProposal } from "./social-strategy-fixture"
import { planningFixture, completePlanningFixture } from "./weekly-planning-fixture"
import { compilePlanningContext } from "../src/application/weekly-planning/advance"
import { nextSubscriptionPeriod, subscriptionActive } from "../src/application/subscriptions/policy"

test("strategic objective persists unchanged across weeks; weekly objectives do not mutate it", async () => {
  const first = await planningFixture()
  const before = structuredClone(first.payload.socialStrategy)
  const week1 = await completePlanningFixture(first)
  const week2 = await completePlanningFixture({ ...first, week: "2026-09-14" })
  assert.deepEqual(week1.payload.socialStrategy, before)
  assert.deepEqual(week2.payload.socialStrategy, before)
  assert.notEqual(week1.payload.plan!.startsOn, week2.payload.plan!.startsOn)
  assert.notEqual(week1.payload.objective?.objective, before!.payload.proposal!.objective)
})
test("public reconnaissance distinguishes inaccessible and missing input without false absence", async () => {
  const run = await planningFixture()
  const missing = await inspectSocialPresence(run.payload.basis, [], async () => { throw Error("No website") })
  assert.deepEqual(missing.map((r) => [r.channel, r.availability]), [["facebook", "unknown"], ["instagram", "unknown"]])
  const inaccessible = await inspectSocialPresence(run.payload.basis, ["https://facebook.com/workshop"], async () => { throw Error("Blocked") })
  assert.equal(inaccessible[0]!.availability, "unknown")
  const login = await inspectSocialPresence(run.payload.basis, ["https://instagram.com/workshop"], async (url) => ({ url, text: "Log in to continue ".repeat(20), socialLinks: [] }))
  assert.equal(login.find((r) => r.channel === "instagram")?.availability, "unknown")
})
test("active, infrequent, empty and not-found classifications need appropriate evidence", () => {
  const proposal = strategyProposal()
  const sources = ["facebook", "instagram"].map((channel) => ({ channel, url: null, text: "", capturedAt: new Date().toISOString(), availability: "unknown" as const }))
  assert.deepEqual(validateSchema(proposal, STRATEGY_SCHEMA), [])
  assert.deepEqual(validateStrategyProposal(proposal, sources), [])
  for (const status of ["active", "infrequent", "empty", "notFound"] as const) {
    const p = structuredClone(proposal); p.reconnaissance[0]!.status = status
    assert.ok(validateStrategyProposal(p, sources).length)
  }
  for (const status of ["active", "infrequent", "empty"] as const) {
    const p = structuredClone(proposal); p.reconnaissance[0] = { ...p.reconnaissance[0]!, status, sourceUrl: "https://facebook.com/workshop", excerpt: "საჯარო ჩანაწერი" }
    assert.deepEqual(validateStrategyProposal(p, [{ ...sources[0]!, url: "https://facebook.com/workshop", availability: "accessible", text: "საჯარო ჩანაწერი" }, sources[1]!]), [])
  }
  const absent = structuredClone(proposal); absent.reconnaissance[0]!.status = "notFound"
  assert.deepEqual(validateStrategyProposal(absent, [{ ...sources[0]!, availability: "notFound" }, sources[1]!]), [])
})
test("supplied observations inform planning; missing results remain unavailable", async () => {
  const run = await planningFixture()
  assert.equal(compilePlanningContext(run).dataAvailability.performance, "unavailable")
  run.payload.evidence = [{ week: "2026-08-31", reviewedAt: "2026-09-06T10:00:00Z", availability: "available", observations: [{ level: "public", observation: "კომენტარში იკითხეს რა ფოტო გამოაგზავნონ", source: "https://facebook.com/workshop/posts/1" }], execution: ["ერთი პოსტი გამოქვეყნდა"], unknowns: ["გაყიდვაზე გავლენა უცნობია"], businessContext: "" }]
  assert.equal(compilePlanningContext(run).recentSignals[0]?.observation, run.payload.evidence[0]!.observations[0]!.observation)
  const next = await completePlanningFixture(run)
  assert.deepEqual(next.payload.evidence, run.payload.evidence)
  assert.deepEqual(next.payload.socialStrategy, run.payload.socialStrategy)
})
test("strategy revisions require an explicit evidence/business reason; calendar is rejected", async () => {
  const active = (await planningFixture()).payload.socialStrategy!
  assert.throws(() => assertStrategyRevision(active, "newWeek", "Monday arrived again"))
  assert.throws(() => assertStrategyRevision(active, "founderFeedback", "უბრალოდ სხვა რამ მინდა"))
  assert.doesNotThrow(() => assertStrategyRevision(active, "businessPriority", "ამ თვეში ახალი მომსახურება დაემატა"))
  assert.doesNotThrow(() => assertStrategyRevision(null, "founderFeedback", "მომხმარებლებს შეფასების სხვა პრობლემა აქვთ"))
})
test("subscriptions have no trial, expire at the boundary, renew without losing paid time and upgrade immediately", () => {
  assert.equal(subscriptionActive(null), false)
  const first = nextSubscriptionPeriod(null, "solo", 1, "monthly", new Date("2026-01-31T12:00:00Z"))
  assert.equal(first.expiresAt, "2026-02-28T12:00:00.000Z")
  assert.equal(subscriptionActive(first, new Date(first.expiresAt)), false)
  const upgraded = nextSubscriptionPeriod(first, "studio", 3, "monthly", new Date("2026-02-05T12:00:00Z"))
  assert.equal(upgraded.brandLimit, 3); assert.equal(upgraded.expiresAt, first.expiresAt)
  const renewed = nextSubscriptionPeriod(upgraded, "studio", 3, "monthly", new Date("2026-02-06T12:00:00Z"))
  assert.equal(renewed.expiresAt, "2026-03-28T12:00:00.000Z")
  assert.throws(() => nextSubscriptionPeriod(upgraded, "solo", 1, "monthly", new Date("2026-02-06T12:00:00Z")))
  assert.throws(() => nextSubscriptionPeriod(null, "agency", 100))
  assert.throws(() => nextSubscriptionPeriod(null, "custom", 10))
  const restored = nextSubscriptionPeriod(first, "solo", 1, "monthly", new Date("2026-05-01T12:00:00Z"))
  assert.equal(restored.expiresAt, "2026-06-01T12:00:00.000Z")
})
