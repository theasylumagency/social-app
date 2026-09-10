import assert from "node:assert/strict"
import test from "node:test"
import { act, createElement } from "react"
import { createRoot } from "react-dom/client"
import { JSDOM } from "jsdom"
import { VisualGenerationPanel, VisualsProvider } from "../src/app/workspace/visual-generation-panel"
import { scheduleFixture } from "./weekly-posts-fixture"

test("visual panel loads on demand, shows pending/success/failure, attaches and blocks exhausted credits", async (t) => {
  const dom = new JSDOM("<!doctype html><html><body><div id='root'></div></body></html>", { url: "http://localhost" })
  const runId = "11111111-1111-4111-8111-111111111111"
  const generationId = "22222222-2222-4222-8222-222222222222"
  const row = { id: generationId, brandId: "brand", prompt: "A blue bowl", model: "test-model", requestKind: "generate", target: { runId, postKey: "p1", slot: 0 }, status: "pending", error: null as string | null, imageUrl: null as string | null, width: 32, height: 40, createdAt: "2026-09-10T10:00:00Z", completedAt: null as string | null }
  let rows: typeof row[] = []; let available = 20; let submissionCount = 0; let attachmentCount = 0; let readCount = 0; let attached = false; let loseResponse = true
  const requestIds: string[] = []
  const globals = { window: dom.window, document: dom.window.document, navigator: dom.window.navigator, IS_REACT_ACT_ENVIRONMENT: true,
    fetch: async (url: string, options?: RequestInit) => {
      if (url.startsWith("/api/visuals?")) { readCount++; return Response.json({ generations: rows, remainingCredits: 20, availableCredits: available, reservedCredits: 20 - available, enabled: true, mode: "demo", message: null }) }
      if (url === "/api/visuals/generate") {
        submissionCount++; const body = JSON.parse(String(options?.body)); requestIds.push(body.requestId)
        assert.equal(body.target.postKey, "p1"); assert.equal(body.target.slot, 0)
        if (loseResponse) { loseResponse = false; throw Error("Connection interrupted") }
        rows = [structuredClone(row)]; available = 19
        return Response.json({ generation: row }, { status: 202 })
      }
      if (url === "/api/visuals/attach") { attachmentCount++; assert.equal(JSON.parse(String(options?.body)).generationId, generationId); return Response.json({ assets: [] }) }
      throw Error(`Unexpected request: ${url}`)
    } }
  const originals = Object.keys(globals).map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)] as const)
  for (const [key, value] of Object.entries(globals)) Object.defineProperty(globalThis, key, { configurable: true, value })
  const container = dom.window.document.getElementById("root")!
  const root = createRoot(container)
  t.after(async () => { await act(async () => root.unmount()); dom.window.close(); for (const [key, descriptor] of originals) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else Reflect.deleteProperty(globalThis, key) } })
  await act(async () => root.render(createElement(VisualsProvider, { runId }, createElement(VisualGenerationPanel, { runId, brandId: "brand", postKey: "p1", post: scheduleFixture().posts[0]!, disabled: false, onAssets: () => { attached = true } }))))
  assert.equal(readCount, 0, "closed panels do not start requests")
  const button = (text: string) => { const b = [...container.querySelectorAll("button")].find((b) => b.textContent?.includes(text)); assert.ok(b, text); return b }
  const click = async (text: string) => { await act(async () => button(text).click()) }
  await act(async () => { const panel = container.querySelector("details")!; panel.open = true; panel.dispatchEvent(new dom.window.Event("toggle")); await new Promise((resolve) => setTimeout(resolve, 10)) })
  assert.ok(readCount > 0); assert.match(container.textContent!, /20 კრედიტი/)
  await click("სურათის შექმნა")
  assert.match(container.textContent!, /Connection interrupted/)
  await click("სურათის შექმნა")
  assert.equal(requestIds[0], requestIds[1], "same uncertain submission reuses its idempotency key")
  assert.equal(button("სურათი იქმნება").disabled, true)
  assert.match(container.textContent!, /გვერდის დატოვების/)
  rows = [{ ...row, status: "succeeded", imageUrl: `/api/visuals/assets?id=${generationId}`, completedAt: "2026-09-10T10:01:00Z" }]
  await click("სტატუსის განახლება")
  assert.ok(container.querySelector(".fp-generated-result img"))
  await click("პოსტზე დამატება")
  assert.equal(attached, true); assert.equal(attachmentCount, 1); assert.equal(submissionCount, 2)
  assert.equal(button("ახალი ვერსია").disabled, false)
  available = 0; rows = [{ ...row, status: "failed", error: "კრედიტი არ ჩამოჭრილა" }]
  await click("სტატუსის განახლება")
  assert.equal(button("სურათის შექმნა").disabled, true)
  assert.match(container.textContent!, /კრედიტი არ ჩამოჭრილა/)
})
