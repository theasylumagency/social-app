import assert from "node:assert/strict"
import test from "node:test"
import { act, createElement } from "react"
import { createRoot } from "react-dom/client"
import { renderToStaticMarkup } from "react-dom/server"
import { JSDOM } from "jsdom"
import { WeeklyPostsClient } from "../src/app/workspace/weekly-posts-client"
import { WeeklyPlanningClient } from "../src/app/workspace/weekly-planning-client"
import { postsPresentation, postPresentation, changedCopyParts } from "../src/app/workspace/weekly-posts-presentation"
import { applyPostReview, type PostsBatch, type PostsReview } from "../src/blueprints/social/weekly-planning/posts"
import { resizePostSchedule } from "../src/blueprints/social/weekly-planning/cadence"
import { completePlanningFixture, planningFixture } from "./weekly-planning-fixture"
import { copyFixture, scheduleFixture, editorialFixture } from "./weekly-posts-fixture"
import { distinctSequence } from "./weekly-sequence-fixture"

const run = await completePlanningFixture(await planningFixture())
function batchFixture(): PostsBatch {
  return { runId: run.id, status: "running", step: "writing", payload: { outline: { ...scheduleFixture(), posts: scheduleFixture().posts.slice(0, 2) }, copies: {}, review: null, repairs: 0, sequenceReview: distinctSequence(2) }, error: null, leaseUntil: null, approvedAt: null, updatedAt: "2026-09-08T10:00:00Z" }
}
const noAction = () => { throw Error("A presentation action must not request generation or mutate assets") }
function posts(batch: PostsBatch, readOnly = false) {
  return createElement(WeeklyPostsClient, { run, batch, assets: [], onAssets: noAction, onStart: noAction, onRetry: noAction, onRepair: noAction, busy: false, readOnly })
}
function triggerRepair(batch: PostsBatch, keys = ["p1"]) {
  batch.payload.copies = { p1: copyFixture(), p2: copyFixture() }
  const editorial = editorialFixture(keys)
  editorial.posts.forEach((post) => post.issues.push({ dimension: "brandFidelity", observedText: "რა ჩანს ფოტოზე", basis: "ბრენდის ხმა", repairInstruction: `შეინარჩუნეთ ბრენდის ხმა ${post.postKey}` }))
  const review: PostsReview = { summary: "დასაზუსტებელია", issues: keys.map((postKey) => ({ postKey, severity: "blocking", message: `ზედმეტი დაპირება ${postKey}` })), editorial }
  review.issues.push({ postKey: "p2", severity: "advisory", message: "არასავალდებულო რჩევა" })
  batch.step = applyPostReview(batch.payload, review)
  return review
}
function finish(batch: PostsBatch) {
  for (const key of Object.keys(batch.payload.repairDrafts ?? {})) {
    const copy = copyFixture()
    copy.variants.forEach((v) => { v.caption = `გადამუშავებული ტექსტი ${key}` })
    batch.payload.copies[key] = copy
  }
  batch.step = applyPostReview(batch.payload, { summary: "შემოწმებულია", issues: [] })
  batch.status = "ready"
}

test("Posts receives an active generation dialog; Weekly Plan and previous posts do not", () => {
  const batch = batchFixture()
  for (const status of ["queued", "running"] as const) {
    batch.status = status
    const initial = { run, approved: null, history: [], basis: run.payload.basis, stale: false, posts: batch }
    const props = { initial, initialPriority: "", brandId: run.brandId, ownerId: run.ownerId, week: run.week }
    assert.match(renderToStaticMarkup(createElement(WeeklyPlanningClient, { ...props, mode: "content" })), /<dialog/)
    assert.doesNotMatch(renderToStaticMarkup(createElement(WeeklyPlanningClient, { ...props, mode: "week" })), /<dialog|fp-progress-dialog/)
  }
  assert.doesNotMatch(renderToStaticMarkup(posts(batch, true)), /<dialog/)
  for (const status of ["ready", "failed"] as const) {
    batch.status = status
    assert.doesNotMatch(renderToStaticMarkup(posts(batch)), /<dialog/)
  }
})

test("progress follows the worker's actual sequence stage and combined review, with no timed substeps", () => {
  const batch = batchFixture()
  batch.step = "outline"; batch.payload.outline = null
  assert.equal(postsPresentation(batch).phase, "outline")
  batch.payload.outline = scheduleFixture(); batch.step = "writing"; delete batch.payload.sequenceReview
  assert.equal(postsPresentation(batch).phase, "sequence")
  batch.payload.sequenceReview = distinctSequence(3)
  assert.equal(postsPresentation(batch).phase, "writing")
  batch.step = "review"
  assert.equal(postsPresentation(batch).phase, "review")
  assert.match(postsPresentation(batch).title, /ბრენდის ხმას.*ფაქტებს/)
})

test("written copy is provisional and a single repair preserves work without implying all posts were repaired", () => {
  const batch = batchFixture()
  batch.payload.copies.p1 = copyFixture()
  assert.match(renderToStaticMarkup(posts(batch)), /პირველი ვერსია — შემოწმება მიმდინარეობს/)
  triggerRepair(batch)
  assert.equal(postsPresentation(batch).written, 2)
  assert.deepEqual(postsPresentation(batch).repairKeys, ["p1"])
  assert.match(postsPresentation(batch).repairMessage!, /1 პოსტს დაზუსტება დასჭირდა/)
  assert.doesNotMatch(postsPresentation(batch).repairMessage!, /2 პოსტს/)
  assert.equal(postsPresentation(batch).phase, "repair")
  assert.equal(postPresentation(batch, "p1").accepted, false)
  const html = renderToStaticMarkup(posts(batch))
  assert.match(html, /პირველი ვერსია — გასწორება მიმდინარეობს/)
  assert.match(html, /რა ჩანს ფოტოზე/)
  assert.equal((html.match(/რატომ შეიცვალა ეს ტექსტი/g) ?? []).length, 1)
  batch.payload.copies.p1 = copyFixture(); batch.step = "review"
  assert.equal(postsPresentation(batch).phase, "review")
  assert.match(postPresentation(batch, "p1").label, /გადამუშავებული ვერსია/)
})

test("two repairs report two distinct posts, regardless of channel count", () => {
  const batch = batchFixture()
  triggerRepair(batch, ["p1", "p2"])
  assert.equal(postsPresentation(batch).written, 2)
  assert.match(postsPresentation(batch).repairMessage!, /2 პოსტს დაზუსტება დასჭირდა/)
  finish(batch)
  assert.match(postsPresentation(batch).completion!, /2 ტექსტი გადავამუშავეთ/)
})

test("final review preserves the first draft and the original per-post blocking issue", () => {
  const batch = batchFixture()
  const review = triggerRepair(batch)
  const original = structuredClone(batch.payload.repairDrafts)
  // Snapshot cannot be changed by later review mutations.
  review.issues[0]!.message = "შემდგომი ცვლილება"
  finish(batch)
  assert.deepEqual(batch.payload.repairDrafts, original)
  assert.deepEqual(batch.payload.review!.issues, [])
  const state = postPresentation(batch, "p1")
  assert.equal(state.accepted, true)
  assert.deepEqual(state.feedback!.issues.map((issue) => issue.message), ["ზედმეტი დაპირება p1"])
  assert.deepEqual(state.feedback!.instructions, ["შეინარჩუნეთ ბრენდის ხმა p1"])
  const html = renderToStaticMarkup(posts(batch))
  assert.match(html, /fp-first-draft/)
  assert.match(html, /fp-final-copy/)
  assert.match(html, /გადამუშავებული ტექსტი p1/)
  assert.match(html, /ზედმეტი დაპირება p1/)
  assert.doesNotMatch(html, /შემდგომი ცვლილება|არასავალდებულო რჩევა/)
  assert.match(postsPresentation(batch).completion!, /2 პოსტი მზადაა.*1 ტექსტი გადავამუშავეთ/)
  assert.equal(batch.payload.repairs, 1)
})

test("unresolved blockers and failed generation cannot claim accepted final copies", () => {
  const batch = batchFixture()
  triggerRepair(batch)
  batch.payload.copies.p1 = copyFixture()
  batch.step = applyPostReview(batch.payload, { summary: "დასაზუსტებელია", issues: [{ postKey: "p1", severity: "blocking", message: "კვლავ დასაზუსტებელია" }] })
  batch.status = "ready"
  assert.equal(batch.payload.repairs, 1)
  assert.equal(postPresentation(batch, "p1").accepted, false)
  assert.equal(postsPresentation(batch).complete, false)
  assert.doesNotMatch(postsPresentation(batch).completion!, /მზადაა და შემოწმებულია/)
  batch.status = "failed"
  assert.match(postPresentation(batch, "p1").label, /დაუმთავრებელია/)
  assert.equal(postsPresentation(batch).completion, null)
  assert.match(renderToStaticMarkup(posts(batch)), /fp-first-draft/)
})

test("no-repair and legacy batches remain clean; unavailable historical reasons are not fabricated", () => {
  const batch = batchFixture()
  batch.payload.copies = { p1: copyFixture(), p2: copyFixture() }
  batch.status = "ready"; batch.step = "ready"; batch.payload.review = { summary: "შემოწმებულია", issues: [] }
  batch.payload.repairs = 1 // A counter alone is not evidence that these posts were repaired.
  assert.equal(postsPresentation(batch).completion, "2 პოსტი მზადაა და შემოწმებულია.")
  assert.doesNotMatch(renderToStaticMarkup(posts(batch)), /რატომ შეიცვალა ეს ტექსტი|fp-first-draft|<dialog/)
  batch.payload.repairDrafts = { p1: copyFixture() }
  batch.payload.review.issues = [{ postKey: "p1", severity: "blocking", message: "ახალი შემოწმების მიზეზი" }]
  assert.equal(postPresentation(batch, "p1").feedback, undefined)
  assert.match(renderToStaticMarkup(posts(batch)), /გასწორების მიზეზი ცალკე შენახული არ არის/)
  delete batch.payload.copies.p1; batch.status = "running"; batch.step = "writing"
  assert.equal(postPresentation(batch, "p1").feedback!.issues[0]!.message, "ახალი შემოწმების მიზეზი")
})

test("history follows retained post keys and channel variants after cadence edits", () => {
  const batch = batchFixture()
  batch.payload.outline!.posts[0]!.channels = [{ channel: "facebook", reason: "მიზანი" }]
  triggerRepair(batch, ["p2"]); finish(batch)
  const resized = resizePostSchedule(batch.payload, { facebook: 0, instagram: 1 })
  assert.deepEqual(resized.mapping, [{ from: "p2", to: "p1" }])
  assert.equal(resized.payload.repairDrafts!.p1!.variants.length, 1)
  assert.equal(resized.payload.repairDrafts!.p1!.variants[0]!.channel, "instagram")
  assert.equal(resized.payload.repairFeedback!.p1!.issues[0]!.postKey, "p1")
  assert.equal(resized.payload.repairFeedback!.p1!.issues[0]!.message, "ზედმეტი დაპირება p2")
  assert.equal(resized.payload.copies.p1!.variants[0]!.caption, "გადამუშავებული ტექსტი p2")
})

test("change summary compares captions, frames, scripts and screen text deterministically", () => {
  const first = copyFixture().variants[0]!
  const next = { ...first, caption: "ახალი", frames: [{ heading: "სათაური", body: "ტექსტი" }], script: "სცენარი", onScreenText: ["ეკრანი"] }
  assert.equal(changedCopyParts(first, next).length, 4)
  assert.deepEqual(changedCopyParts(first, structuredClone(first)), [])
})

test("dialog dismissal and clipboard stay local across progressive repair updates", async (t) => {
  const dom = new JSDOM("<!doctype html><html><body><div id='root'></div></body></html>", { url: "http://localhost" })
  let networkCalls = 0
  const globals = { window: dom.window, document: dom.window.document, navigator: dom.window.navigator, IS_REACT_ACT_ENVIRONMENT: true, fetch: async () => { networkCalls++; throw Error("Presentation must not make a network request") } }
  const originals = Object.keys(globals).map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)] as const)
  for (const [key, value] of Object.entries(globals)) Object.defineProperty(globalThis, key, { configurable: true, value })
  // jsdom does not implement the browser's native dialog top layer/focus behavior.
  dom.window.HTMLDialogElement.prototype.showModal = function () { this.setAttribute("open", "") }
  dom.window.HTMLDialogElement.prototype.close = function () { this.removeAttribute("open") }
  let clipboard = ""
  Object.defineProperty(dom.window.navigator, "clipboard", { value: { writeText: async (value: string) => { clipboard = value } } })
  const container = dom.window.document.getElementById("root")!
  const root = createRoot(container)
  t.after(async () => {
    await act(async () => root.unmount())
    dom.window.close()
    for (const [key, descriptor] of originals) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else Reflect.deleteProperty(globalThis, key) }
  })
  const batch = batchFixture()
  const render = async () => { await act(async () => root.render(posts(structuredClone(batch)))) }
  const click = async (label: string, scope: Element = container) => {
    const button = [...scope.querySelectorAll("button")].find((node) => node.textContent === label)
    assert.ok(button, label)
    await act(async () => button.click())
  }
  await render()
  assert.ok(container.querySelector("dialog[open]"))
  const unchanged = structuredClone(batch)
  await click("დახურვა")
  assert.equal(container.querySelector("dialog"), null)
  assert.ok(container.querySelector(".fp-progress"))
  assert.deepEqual(batch, unchanged)
  batch.payload.copies.p1 = copyFixture()
  await render()
  assert.equal(container.querySelector("dialog"), null, "poll updates must not reopen a dismissed dialog")
  await click("ტექსტის კოპირება", container.querySelector("#post-1")!)
  assert.equal(clipboard, copyFixture().variants[0]!.caption)
  triggerRepair(batch)
  await render()
  assert.equal(container.querySelector("dialog"), null)
  assert.match(container.querySelector(".fp-progress")!.textContent!, /1 პოსტს/)
  await click("პროცესის ნახვა")
  assert.ok(container.querySelector("dialog[open]"))
  await act(async () => { container.querySelector("dialog")!.dispatchEvent(new dom.window.Event("cancel", { bubbles: false, cancelable: true })) })
  assert.equal(container.querySelector("dialog"), null, "Escape dismisses without generation callbacks")
  finish(batch); await render()
  const post = container.querySelector("#post-1")!
  const history = post.querySelector(".fp-repair-history") as HTMLDetailsElement
  assert.ok(history)
  assert.equal(history.open, false)
  history.open = true
  assert.match(history.querySelector(".fp-first-draft")!.textContent!, /რა ჩანს ფოტოზე/)
  assert.match(history.querySelector(".fp-final-copy")!.textContent!, /გადამუშავებული ტექსტი p1/)
  await click("ტექსტი დაკოპირებულია ✓", post)
  assert.equal(clipboard, "გადამუშავებული ტექსტი p1")
  assert.equal(networkCalls, 0)
  assert.equal(container.querySelector("dialog"), null)
  // A later explicit repair is a new active period and should offer progress again.
  batch.status = "queued"; batch.step = "writing"; delete batch.payload.copies.p1
  await render()
  assert.ok(container.querySelector("dialog[open]"))
})
