import assert from "node:assert/strict"
import test from "node:test"
import { randomUUID } from "node:crypto"
import { emptyDiscovery, splitListLines, type DiscoverySession } from "../src/blueprints/social/brand-discovery/model"
import { validateUnderstanding } from "../src/blueprints/social/brand-discovery/validation"
import { advanceDiscovery } from "../src/application/brand-discovery/advance"
import { createBrandReasoner, type BrandModelCall, type BrandModelRun } from "../src/infrastructure/models/brand-reasoning"
import { AUDIENCE_HYPOTHESIS_OUTPUT_SCHEMA } from "../src/blueprints/social/brand-discovery/schemas"
import { note, understanding, fixtureOutput, fixtureReasoner, completeFixture } from "./brand-discovery-fixture"

const initial = (): DiscoverySession => ({ id: randomUUID(), ownerId: "owner", brandId: null, revision: 1, status: "queued", step: "sources", payload: emptyDiscovery({ website: "", notes: note, language: "ka" }), error: null, updatedAt: new Date().toISOString(), leaseUntil: null })

test("commas remain inside complete offers and only newlines separate entries", () => {
  assert.deepEqual(splitListLines(" Staff, management, and analytics\nOther\r\nOther\n"), ["Staff, management, and analytics", "Other"])
})
test("source failure needs honest fallback, never fabricated successful crawl", async () => {
  const session = initial(); session.payload.input.website = "https://example.test"
  const withNotes = await advanceDiscovery(session, { reason: fixtureReasoner(), capture: async () => { throw Error() } })
  assert.equal(withNotes.payload.sources[0]?.key, "founder")
  assert.equal(withNotes.payload.sourceWarnings.length, 1)
  session.payload.input.notes = ""
  await assert.rejects(() => advanceDiscovery(session, { reason: fixtureReasoner(), capture: async () => { throw Error() } }), /SOURCE_UNAVAILABLE/)
})
test("full process resolves evidence IDs and keeps goals separate from facts", async () => {
  const calls: BrandModelCall[] = []
  const ready = await completeFixture(initial(), calls)
  assert.deepEqual(calls.map((c) => c.step), ["understanding", "audiences", "profiles", "envelope", "goals"])
  assert.equal(ready.payload.hypotheses[0]?.evidenceIds[0], ready.payload.evidence[0]?.id)
  assert.equal(ready.payload.envelope?.landscapeVersion, 1)
  assert.equal(ready.payload.goals[0]?.audienceIds[0], ready.payload.hypotheses[0]?.id)
  assert.equal(ready.payload.feedback.selectedGoalIds, null)
  assert.deepEqual(ready.payload.feedback.stances, [])
  assert.equal(ready.payload.sources[0]?.capturedAt, "2026-09-06T10:00:00.000Z")
})
test("invented citations and unknown model authority are rejected, valid repair accepted", async () => {
  const s = initial(); const sourced = await advanceDiscovery(s, { reason: fixtureReasoner(), capture: async () => [] })
  const wrong = structuredClone(understanding); wrong.offers[0]!.exactExcerpt = "A quotation that never occurred in the provided material"
  assert.ok(validateUnderstanding(wrong, sourced.payload.sources).length)
  const call: BrandModelCall = { step: "audiences", version: "test", prompt: "test", input: {}, schema: AUDIENCE_HYPOTHESIS_OUTPUT_SCHEMA }
  const output = fixtureOutput(call) as { segments: Record<string, unknown>[] }
  const bad = structuredClone(output); bad.segments[0]!.influence = "strong"
  let count = 0; const records: BrandModelRun[] = []
  const reason = createBrandReasoner(async (run) => { records.push(run) }, { apiKey: "test-only", fetch: async () => new Response(JSON.stringify({ status: "completed", output: [{ content: [{ type: "output_text", text: JSON.stringify(count++ === 0 ? bad : output) }] }] }), { status: 200 }) })
  assert.deepEqual(await reason(call), output)
  assert.equal(records.length, 2)
  assert.ok(records[0]!.validationErrors.some((e) => e.includes("influence")))
  assert.deepEqual(records[1]!.validationErrors, [])
})
test("unknown evidence and inflated confidence cannot enter the audience landscape", async () => {
  const ready = await completeFixture(initial())
  const audienceSession = { ...ready, step: "audiences" as const }
  for (const change of [{ evidenceKeys: ["not-an-evidence"] }, { evidenceKeys: [], confidenceBand: "strong" }, { relevantOffers: ["invented service"] }]) {
    const reason = async (call: BrandModelCall) => { const value = fixtureOutput(call) as { segments: Record<string, unknown>[] }; Object.assign(value.segments[0]!, change); assert.ok(call.validate!(value).length); throw new Error("contract rejected") }
    await assert.rejects(() => advanceDiscovery(audienceSession, { reason, capture: async () => [] }), /contract rejected/)
  }
})
