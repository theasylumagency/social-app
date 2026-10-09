import assert from "node:assert/strict"
import test from "node:test"
import { act, createElement } from "react"
import { createRoot } from "react-dom/client"
import { JSDOM } from "jsdom"
import { WeeklyPostsClient } from "../src/app/workspace/weekly-posts-client"
import { SocialScheduleControls } from "../src/app/workspace/social-schedule-controls"
import { weeklyApprovalFixture } from "./weekly-approval-fixture"
import type { SavedSchedule } from "../src/app/workspace/social-schedule-model"

test("the weekly parent reads once, keeps all rows through filters and submits only the reviewed subset once", async t => {
  const dom = new JSDOM("<!doctype html><div id='root'></div>", { url: "http://localhost" }), { run, posts } = weeklyApprovalFixture()
  run.week = "2030-01-07"
  posts.payload.outline!.posts.push({ ...structuredClone(posts.payload.outline!.posts[0]!), title: "Second checklist" })
  posts.payload.copies.p2 = structuredClone(posts.payload.copies.p1!)
  let reads = 0, writes = 0, payload: Record<string, unknown> = {}, finish: (() => void) | undefined
  const globals = { window: dom.window, document: dom.window.document, navigator: dom.window.navigator, IS_REACT_ACT_ENVIRONMENT: true,
    fetch: async (url: string, options?: RequestInit) => {
      assert.ok(url.startsWith("/api/social/schedules"))
      if (!options?.method) { reads++; return Response.json({ capturedAt: "2029-12-01T00:00:00Z", accounts: [{ id: "account", name: "Page", channel: "facebook", connected: true, canPublish: true }], schedules: [] }) }
      writes++; payload = JSON.parse(String(options.body)); await new Promise<void>(resolve => { finish = resolve }); return Response.json({ count: 1 }, { status: 201 })
    } }
  const originals = Object.keys(globals).map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)] as const)
  for (const [key, value] of Object.entries(globals)) Object.defineProperty(globalThis, key, { configurable: true, value })
  const container = dom.window.document.getElementById("root")!, root = createRoot(container)
  t.after(async () => { await act(async () => root.unmount()); dom.window.close(); for (const [key, descriptor] of originals) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else Reflect.deleteProperty(globalThis, key) } })
  const noAction = () => { throw Error("No generation action expected") }
  await act(async () => root.render(createElement(WeeklyPostsClient, { run, batch: posts, assets: [], onAssets: noAction, onStart: noAction, onRetry: noAction, busy: false })))
  assert.equal(reads, 1); assert.equal(writes, 0); assert.equal(container.querySelectorAll(".ws-panel").length, 1); assert.equal(container.querySelectorAll(".ws-row").length, 2)
  const filter = [...container.querySelectorAll<HTMLButtonElement>(".fp-channel-tabs button")].find(b => b.textContent?.startsWith("Instagram"))!
  await act(async () => filter.click())
  assert.equal(reads, 1); assert.equal(container.querySelectorAll(".ws-row").length, 2)
  const select = container.querySelector<HTMLSelectElement>(".ws-row select")!
  const dateInput = container.querySelector<HTMLInputElement>(".ws-row input[type='datetime-local']")!
  await act(async () => { dateInput.value = "2030-01-09T15:30"; dateInput.dispatchEvent(new dom.window.Event("input", { bubbles: true })); select.value = "account"; select.dispatchEvent(new dom.window.Event("change", { bubbles: true })) })
  const checkbox = container.querySelector<HTMLInputElement>(".ws-row input[type='checkbox']")!
  assert.equal(checkbox.disabled, false)
  await act(async () => checkbox.click())
  const button = (label: string) => { const b = [...container.querySelectorAll<HTMLButtonElement>("button")].find(b => b.textContent === label); assert.ok(b, label); return b }
  await act(async () => button("არჩეული განრიგის გადამოწმება").click())
  assert.equal(writes, 0)
  await act(async () => { const b = button("ჯგუფის განრიგის დადასტურება"); b.click(); b.click() })
  assert.equal(writes, 1)
  assert.deepEqual(payload.selections, [{ postKey: "p1", channel: "facebook", publishingAccountId: "account", timeContext: { timeZone: "Asia/Tbilisi", localDateTime: "2030-01-09T15:30", disambiguation: null } }])
  await act(async () => finish!())
  assert.equal(reads, 2); assert.match(container.textContent!, /არჩეული ჯგუფის განრიგი შენახულია/u)
})

test("uncertain cancellation retries reuse the operation id; conflicts never label an unknown publication cancelled", async t => {
  const dom = new JSDOM("<!doctype html><div id='root'></div>", { url: "http://localhost" }), { run, posts } = weeklyApprovalFixture()
  const saved: SavedSchedule = { publicationInputId: "input", supersededByInputId: null, approvalId: posts.approvalEvidence!.id, postKey: "p1", publishingAccountId: "account",
    schedule: { id: "schedule", channel: "facebook", draftVersion: 1, publishAt: "2030-01-07T08:00:00Z" }, lifecycle: { status: "scheduled", revision: 0, publishAt: "2030-01-07T08:00:00Z" }, delivery: { state: "notStarted", attemptCount: 0 } }
  const ids: string[] = []
  const globals = { window: dom.window, document: dom.window.document, navigator: dom.window.navigator, IS_REACT_ACT_ENVIRONMENT: true,
    fetch: async (_url: string, options?: RequestInit) => {
      if (!options?.method) return Response.json({ capturedAt: "2029-12-01T00:00:00Z", accounts: [], schedules: [saved] })
      const body = JSON.parse(String(options.body)); ids.push(body.operationId); assert.equal(body.expectedRevision, 0)
      if (ids.length === 1) throw TypeError("Network lost")
      saved.delivery = { state: "unknown", attemptCount: 1 }
      return Response.json({ message: "გაგზავნის მცდელობა უკვე დაწყებულია." }, { status: 409 })
    } }
  const originals = Object.keys(globals).map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)] as const)
  for (const [key, value] of Object.entries(globals)) Object.defineProperty(globalThis, key, { configurable: true, value })
  const container = dom.window.document.getElementById("root")!, root = createRoot(container)
  t.after(async () => { await act(async () => root.unmount()); dom.window.close(); for (const [key, descriptor] of originals) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else Reflect.deleteProperty(globalThis, key) } })
  await act(async () => root.render(createElement(SocialScheduleControls, { run, batch: posts, assets: [] })))
  const click = async (label: string) => { const b = [...container.querySelectorAll<HTMLButtonElement>("button")].find(b => b.textContent === label); assert.ok(b, label); await act(async () => b.click()) }
  await click("განრიგიდან გაუქმება"); await click("გაუქმების დადასტურება")
  assert.match(container.textContent!, /სერვერის პასუხი ვერ მივიღეთ/u)
  assert.equal(container.querySelector(".ws-status")!.textContent, "დაგეგმილია")
  await click("გაუქმების დადასტურება")
  assert.equal(ids[0], ids[1]); assert.equal(ids.length, 2)
  assert.equal(container.querySelector(".ws-status")!.textContent, "დაგეგმილია")
  assert.ok(container.querySelector("[role='alert']"))
  await click("სტატუსის განახლება")
  assert.equal(container.querySelector(".ws-status")!.textContent, "შედეგი ჯერ უცნობია")
  assert.equal([...container.querySelectorAll("button")].some(b => b.textContent === "განრიგიდან გაუქმება"), false)
})
