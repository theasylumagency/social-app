import { test } from "node:test"
import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { JSDOM } from "jsdom"
import { analyzeNoCallCohort, recommendation, ratio } from "./analysis.mjs"
import { validateHumanReference, verifyFrozen, type HumanReference, type HumanProposition } from "./review.mjs"
import { selectSample, sampleInputs, type SourceItem } from "./sample.mjs"
import { json } from "./common.mjs"
const queue = { sampleId: "unit-only", sampleHash: "unit-hash", referenceStatus: "unit engineering reference", items: [{ itemId: "A001", surfaces: [{ sourceId: "source", text: "😀 კონსულტაცია 150 ლარია." }] }] }
const reference = (): HumanReference => ({ sampleId: queue.sampleId, sampleHash: queue.sampleHash, referenceStatus: queue.referenceStatus, reviewer: "synthetic unit test", completedAt: "unit-only", blindAttestation: true,
 items: [{ itemId: "A001", reviewed: true, noMaterial: true, ineligibility: "correctlyIneligible", propositions: [], notes: "Synthetic unit data, never written as actual human labels." }] })
const proposition = (): HumanProposition => ({ sourceId: "source", excerpt: "კონსულტაცია 150 ლარია.", start: 2, end: Array.from(queue.items[0]!.surfaces[0]!.text).length,
 families: ["price"], polarity: "affirmed", service: { state: "known", mention: "კონსულტაცია" }, branch: { state: "notRequired", mention: "" }, time: "notRequired", amount: { state: "known", value: "150", currency: "GEL", basis: "exact" },
 consumerRequired: ["family", "polarity", "service", "amount"], sufficientForConsumer: true, consumers: ["Safety reviewer"], errorCouldChangeHandling: "yes", ifMissedAction: "missedNecessaryReviewOrRepair", ellipsis: [], notes: "Unit only" })
test("blind human completion requires matching sample, attestation and all posts", () => {
 assert.deepEqual(validateHumanReference(reference(), queue), [])
 const bad = reference(); bad.blindAttestation = false; bad.reviewer = ""; bad.sampleHash = "other"
 assert.ok(validateHumanReference(bad, queue).length >= 2)
 bad.items = []; assert.ok(validateHumanReference(bad, queue).length)
})
test("unreviewed drafts do not become completed human references", () => {
 const draft = reference(); draft.items = [{ ...draft.items[0]!, reviewed: false, noMaterial: false, ineligibility: "" as never }]
 assert.deepEqual(validateHumanReference(draft, queue, false), [])
 assert.ok(validateHumanReference(draft, queue, true).length)
})
test("no-material confirmation and miss finding cannot contradict propositions", () => {
 const ref = reference(); ref.items = [{ ...ref.items[0]!, noMaterial: false, propositions: [proposition()], ineligibility: "missedMaterial" }]
 assert.deepEqual(validateHumanReference(ref, queue), [])
 ref.items = [{ ...ref.items[0]!, noMaterial: true }]; assert.ok(validateHumanReference(ref, queue).length)
 ref.items = [{ ...ref.items[0]!, noMaterial: false, ineligibility: "correctlyIneligible" }]; assert.ok(validateHumanReference(ref, queue).length)
})
test("exact source span uses code points; invented quote and UTF-16 offset fail", () => {
 const p = proposition(), ref = reference(); ref.items = [{ ...ref.items[0]!, noMaterial: false, ineligibility: "missedMaterial", propositions: [p] }]
 assert.deepEqual(validateHumanReference(ref, queue), [])
 assert.ok(validateHumanReference({ ...ref, items: [{ ...ref.items[0]!, propositions: [{ ...p, start: 3 }] }] }, queue).length)
 assert.ok(validateHumanReference({ ...ref, items: [{ ...ref.items[0]!, propositions: [{ ...p, excerpt: "invented" }] }] }, queue).length)
})
test("unsupported family and missing consumer/action fields are rejected", () => {
 const ref = reference(), p = proposition(); ref.items = [{ ...ref.items[0]!, noMaterial: false, ineligibility: "missedMaterial", propositions: [{ ...p, families: ["guarantee" as never], consumers: [], ifMissedAction: "" as never }] }]
 assert.ok(validateHumanReference(ref, queue).length >= 3)
})
test("pending reference never becomes zero semantic misses or perfect accuracy", () => {
 const m = analyzeNoCallCohort(["A001"], null)
 assert.equal(m.eligibility.humanMaterialItems, null); assert.equal(m.eligibility.materialItemRecall, null)
 assert.equal(m.actions.missedMaterialActionPropositions, null)
 assert.equal(m.interpretation.completeObservation.accuracy, null)
 assert.equal(recommendation(null).choice, null)
})
test("negative-only human cohort has undefined recall and interpretation accuracy", () => {
 const m = analyzeNoCallCohort(["A001"], reference())
 assert.equal(m.eligibility.correctlyIneligibleItems, 1); assert.equal(m.eligibility.materialItemRecall, null)
 assert.equal(m.eligibility.unnecessaryInvocationRatePerReviewedItem, 0)
 assert.equal(m.eligibility.unnecessaryInvocationRatePerInvocation, null)
 assert.equal(m.usefulness.usefulObservationRate, null); assert.equal(m.usefulness.costPerUsefulObservation, null)
 assert.equal(recommendation(reference()).choice, "A")
})
test("human material no-call misses lower recall and remain separate from observation usefulness", () => {
 const ref = reference(); ref.items = [{ ...ref.items[0]!, noMaterial: false, ineligibility: "missedMaterial", propositions: [proposition()] }]
 const m = analyzeNoCallCohort(["A001"], ref)
 assert.equal(m.eligibility.materialItemRecall, 0); assert.equal(m.eligibility.materialPropositionRecall, 0)
 assert.equal(m.actions.missedMaterialActionPropositions, 1); assert.equal(m.usefulness.unservedHumanConsumerOpportunities, 1)
 assert.equal(m.usefulness.usefulObservations, 0); assert.equal(recommendation(ref).choice, "C")
 assert.throws(() => analyzeNoCallCohort(["A001", "A002"], ref), /INCOMPLETE/)
 assert.equal(ratio(0, 0), null)
})
const source = (id: string, date: string, kind: SourceItem["sourceKind"], text: string): SourceItem => ({ sourceId: id, sourceRevision: "rev", createdAt: date, sourceKind: kind, runId: "unit-only", postKey: id,
 copy: { variants: [{ channel: "instagram", caption: text, frames: [], script: "", onScreenText: [] }] }, serviceMentions: ["კონსულტაცია"], review: null,
 writerReceipts: [{ id: "unit-receipt", step: "unit", promptVersion: "unit", model: "synthetic unit", createdAt: date, inputHash: "unit" }] })
test("chronological source selection is stable, disjoint and excludes unverified copies", () => {
 const sources = [source("later", "2026-02-01", "savedCopy", "ჩვეულებრივი პოსტი"), source("first", "2026-01-01", "savedCopy", "პირველი პოსტი"), source("history", "2026-03-01", "repairDraft", "აღარ მოქმედებს ფასდაკლება."), { ...source("unverified", "2025-01-01", "savedCopy", "ფასი 100 ლარი"), writerReceipts: [] }]
 const forward = selectSample(sources, 1, 2), reverse = selectSample([...sources].reverse(), 1, 2)
 assert.deepEqual(forward, reverse); assert.equal(forward.eligibleSourcePool, 3)
 assert.equal(forward.items.filter(i => i.cohort === "A")[0]!.sourceId, "first")
 assert.equal(forward.items.filter(i => i.cohort === "B")[0]!.sourceId, "history")
 assert.equal(new Set(forward.items.map(i => i.sourceId)).size, forward.items.length)
})
test("duplicate public content is not counted as additional independent evidence", () => {
 const selected = selectSample([source("b", "2026-02-01", "repairDraft", "კონსულტაცია 150 ლარია."), source("a", "2026-01-01", "savedCopy", "კონსულტაცია 150 ლარია.")])
 assert.equal(selected.uniqueContentPool, 1); assert.equal(selected.items.length, 1)
 assert.equal(selected.items[0]!.sourceId, "a")
})
test("unchanged preparation retains ineligible full text without invented anchors", () => {
 const selected = selectSample([source("a", "2026-01-01", "savedCopy", "ეს ჩვეულებრივი პოსტია. მეორე წინადადებას ვერ ვწყვეტთ.")])
 const inputs = sampleInputs(selected.items[0]!)
 assert.equal(inputs.length, 1); assert.equal(inputs[0]!.task, null)
 assert.equal(inputs[0]!.source.text, selected.items[0]!.surfaces[0]!.text)
})
test("actual frozen blind payload excludes provider and reviewer metadata", async () => {
 await verifyFrozen()
 const real = await json("review/queue.json")
 assert.equal(real.items.length, 3)
 const forbidden = new Set(["model", "probabilityYes", "decisions", "answers", "safetyReviewer", "consolidatedReviewer", "writerReceipts", "configuration", "deadZone"])
 const check = (value: unknown) => { if (Array.isArray(value)) value.forEach(check); else if (value && typeof value === "object") for (const [key, v] of Object.entries(value)) { assert.ok(!forbidden.has(key), key); check(v) } }
 check(real)
 assert.ok(real.items.every((i: { surfaces: { preparedAnchor: unknown }[] }) => i.surfaces.every(s => !s.preparedAnchor)))
})
test("blind UI starts with no semantic labels and submits only synthetic test data", async () => {
 const html = await readFile(new URL("./review.html", import.meta.url), "utf8"), posted: unknown[] = []
 const dom = new JSDOM(html, { url: "http://127.0.0.1:1", runScripts: "dangerously", beforeParse(window) {
  window.HTMLElement.prototype.scrollIntoView = () => {}
  window.fetch = (async (url: string, init?: { body?: string }) => {
   if (url === "/queue") return { json: async () => ({ ...queue, items: [{ ...queue.items[0]!, surfaces: [{ ...queue.items[0]!.surfaces[0]!, channel: "test", surface: "caption", preparedAnchor: null }] }] }) }
   if (url === "/draft" && !init) return { json: async () => null }
   posted.push(JSON.parse(init!.body!)); return { ok: true, json: async () => ({ saved: true }) }
  }) as typeof window.fetch
 } })
 try {
  await new Promise(resolve => setTimeout(resolve, 30))
  const doc = dom.window.document
  assert.equal((doc.getElementById("noMaterial") as HTMLInputElement).checked, false)
  assert.equal((doc.getElementById("eligibility") as HTMLSelectElement).value, "")
  doc.getElementById("add")!.click()
  assert.equal((doc.getElementById("polarity") as HTMLSelectElement).value, "")
  assert.equal(doc.querySelectorAll('input[name="families"]:checked').length, 0)
  doc.getElementById("cancel")!.click()
  ;(doc.getElementById("noMaterial") as HTMLInputElement).checked = true
  ;(doc.getElementById("eligibility") as HTMLSelectElement).value = "correctlyIneligible"
  doc.getElementById("save")!.click(); await new Promise(resolve => setTimeout(resolve, 20))
  assert.equal(posted.length, 1)
  assert.equal((posted[0] as HumanReference).sampleId, "unit-only")
 } finally { dom.window.close() }
})
