import assert from "node:assert/strict"
import test from "node:test"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { JSDOM } from "jsdom"
import { buildBriefing } from "../src/application/dashboard/briefing"
import { BrandBrief } from "../src/app/workspace/brand-brief"
import { Overview } from "../src/app/workspace/overview"
import { WeeklyPlanningClient } from "../src/app/workspace/weekly-planning-client"
import { completePlanningFixture, planningFixture } from "./weekly-planning-fixture"
import { approvedStrategy } from "./social-strategy-fixture"
import { emptyPosts, type PostsBatch } from "../src/blueprints/social/weekly-planning/posts"
import type { PlanningView } from "../src/blueprints/social/weekly-planning/model"
import type { StrategyView } from "../src/blueprints/social/strategy/model"
import { currentWeek } from "../src/application/dashboard/model"

const run = await completePlanningFixture(await planningFixture())
run.week = currentWeek()
const active = approvedStrategy(run.payload.basis)
function input() {
  const posts: PostsBatch = { runId: run.id, status: "ready", step: "ready", payload: emptyPosts(), error: null, leaseUntil: null, approvedAt: null, updatedAt: run.updatedAt }
  const planning: PlanningView = { run: structuredClone(run), approved: null, history: [], basis: run.payload.basis, stale: false, posts }
  const strategy: StrategyView = { latest: active, active, legacy: false }
  return { strategy, planning, week: run.week, accounts: ["facebook", "instagram"].map((channel) => ({ id: channel, channel: channel as "facebook" | "instagram", name: channel, connected: true, canPublish: true, canFetchAnalytics: true })) }
}

test("a review is a decision; blocked, stale, failed and unfinished work cannot look ready for approval", () => {
  assert.deepEqual(buildBriefing(input()).decisions.map((i) => i.id), ["content-review"])
  const revised = input()
  revised.planning.run!.status = "approved"
  assert.deepEqual(buildBriefing(revised).decisions.map((i) => i.id), ["content-review"], "changed copy still needs approval under an approved plan")
  for (const state of ["stale", "blocked", "failed", "queued", "running"] as const) {
    const props = input()
    if (state === "stale") props.planning.stale = true
    else if (state === "blocked") props.planning.posts!.payload.review = { summary: "Blocked", issues: [{ postKey: "p1", severity: "blocking", message: "Unproven claim" }] }
    else props.planning.posts!.status = state
    const result = buildBriefing(props)
    assert.equal(result.decisions.length, 0, state)
    assert.ok(result.actions.length || result.work.length, state)
  }
})

test("only selected channels require connection; a saved connection without publish capability is insufficient", () => {
  const props = input()
  props.planning.posts!.payload.outline = { summary: "", cadenceReason: "", channelReason: "", posts: [{ title: "", directionKey: "d1", dayOffset: 0, why: "", format: "text", channels: [{ channel: "facebook", reason: "" }], brief: { job: "", takeaway: "", points: [], mustNotSay: [] }, visual: { kind: "none", description: "", aspectRatio: "none", frames: [] } }] }
  props.accounts = props.accounts.filter((a) => a.channel === "facebook")
  assert.equal(buildBriefing(props).actions.some((i) => i.id === "connections"), false)
  props.accounts[0]!.canPublish = false
  const item = buildBriefing(props).actions.find((i) => i.id === "connections")!
  assert.match(item.detail, /Facebook/)
  assert.doesNotMatch(item.detail, /Instagram/)
})

test("strategy revisions remain decisions even with an active strategy; fresh work and missing foundation are not calm states", () => {
  const props = input()
  props.strategy.latest = { ...active, id: "revision", status: "proposed" }
  assert.ok(buildBriefing(props).decisions.some((i) => i.id === "strategy-review"))
  props.planning.run = null
  props.planning.posts = null
  assert.ok(buildBriefing(props).actions.some((i) => i.id === "plan-start"))
  props.planning.basis = null
  assert.ok(buildBriefing(props).actions.some((i) => i.id === "brand-basis"))
})

test("approved copy is never reported as published or full operational health", () => {
  const props = input()
  props.planning.run!.status = "approved"
  props.planning.posts!.approvedAt = run.updatedAt
  const html = renderToStaticMarkup(createElement(Overview, { ...props, brand: { id: run.brandId, name: "Test", ready: true, createdAt: run.createdAt, knowledge: {} }, readAt: run.updatedAt, delivery: { availability: "available", checkedAt: run.updatedAt, publishingEnabled: true, items: [] } }))
  assert.match(html, /გეგმასა და კონტენტზე გადაწყვეტილება არ გელით/)
  assert.match(html, /ეს გამოქვეყნების დადასტურებას არ ნიშნავს/)
  assert.match(html, /ყველა არხის უწყვეტი გამართულობა ამ გვერდით არ დასტურდება/)
})

test("Brand keeps all offers and source evidence within a closed full analysis", () => {
  const dossier = run.payload.basis
  const doc = new JSDOM(renderToStaticMarkup(createElement(BrandBrief, { dossier, brandId: run.brandId }))).window.document
  const full = [...doc.querySelectorAll("details")].find((d) => d.querySelector("summary")?.textContent?.includes("სრული ანალიზი"))!
  assert.equal(full.open, false)
  assert.equal(full.querySelectorAll(".bd-offers article").length, dossier.payload.understanding!.offers.length)
  assert.equal(full.querySelectorAll(".bd-citation").length > 0, true)
  assert.equal(full.querySelector("#bd-goals"), null, "completed Brand must not repeat onboarding next steps")
})

test("weekly objective precedes quantities; advanced details collapse while current revisions remain usable", () => {
  const props = input()
  const doc = new JSDOM(renderToStaticMarkup(createElement(WeeklyPlanningClient, { initial: props.planning, initialPriority: "", brandId: run.brandId, ownerId: run.ownerId, week: run.week }))).window.document
  const objective = doc.querySelector(".wp-objective")!
  const cadence = doc.querySelector(".wp-cadence")!
  assert.ok(objective.compareDocumentPosition(cadence) & 4)
  assert.equal(doc.querySelector<HTMLDetailsElement>(".wp-report > details")!.open, false)
  assert.equal(doc.querySelector<HTMLDetailsElement>(".wp-cadence > details")!.open, false)
  assert.ok([...doc.querySelectorAll("button")].some((b) => b.textContent === "გეგმის დაზუსტება" && !b.disabled))
})
