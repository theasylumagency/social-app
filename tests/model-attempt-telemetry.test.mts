import assert from "node:assert/strict"
import test from "node:test"
import { createHash } from "node:crypto"
import { createBrandReasoner, type BrandModelCall, type BrandModelRun } from "../src/infrastructure/models/brand-reasoning"

const call: BrandModelCall = { step: "telemetry", version: "v1", prompt: "Preserve voice", input: { private: "არ გამოაჩინო" }, schema: { type: "object", additionalProperties: false, required: ["ok"], properties: { ok: { type: "boolean" } } } }
const response = (value: unknown) => new Response(JSON.stringify({ model: "resolved-model", usage: { input_tokens: 10, output_tokens: 5 }, output: [{ content: [{ type: "output_text", text: JSON.stringify(value) }] }] }))

test("telemetry distinguishes transport retries from validation repairs and fingerprints each actual request", async () => {
  const rows: BrandModelRun[] = [], requests: string[] = []
  const reason = createBrandReasoner(async row => { rows.push(row) }, { apiKey: "never-log-key", model: "pinned", reasoningEffort: "low", sleep: async () => {}, fetch: async (_url, init) => {
    requests.push(String(init?.body))
    if (requests.length === 1) return response({ bad: true })
    if (requests.length === 2) return new Response("secret-provider-body", { status: 503 })
    return response({ ok: true })
  } })
  await reason(call)
  assert.equal(rows.length, 3)
  assert.equal(new Set(rows.map(row => row.telemetry!.logicalCallId)).size, 1)
  assert.deepEqual(rows.map(row => [row.telemetry!.requestOrdinal, row.telemetry!.validationAttempt, row.telemetry!.kind, row.telemetry!.outcome]), [
    [1, 1, "initial", "validation_failure"], [2, 2, "validation_repair", "provider_failure"], [3, 2, "transport_retry", "accepted"] ])
  assert.equal(requests[1], requests[2])
  assert.equal(new Set(rows.map(row => row.inputHash)).size, 1)
  rows.forEach((row, index) => {
    const telemetry = row.telemetry!, body = JSON.parse(requests[index]!)
    assert.equal(telemetry.requestHash, createHash("sha256").update(requests[index]!).digest("hex"))
    assert.equal(telemetry.inputBytes, Buffer.byteLength(body.input))
    assert.equal(telemetry.instructionsBytes, Buffer.byteLength(body.instructions))
    assert.equal(telemetry.schemaBytes, Buffer.byteLength(JSON.stringify(call.schema)))
    assert.equal(telemetry.reasoningEffort, "low")
    assert.ok(telemetry.requestDurationMs >= 0 && telemetry.validationDurationMs >= 0)
    assert.ok(Date.parse(telemetry.completedAt) >= Date.parse(telemetry.startedAt))
  })
  assert.equal(rows[2]!.telemetry!.responseModel, "resolved-model")
  assert.doesNotMatch(JSON.stringify(rows), /never-log-key|secret-provider-body|არ გამოაჩინო/)
})

test("parallel calls have separate identities; a throwing validator still records its paid receipt", async () => {
  const rows: BrandModelRun[] = []
  const reason = createBrandReasoner(async row => { rows.push(row) }, { apiKey: "test", fetch: async () => response({ ok: true }) })
  await Promise.all([reason(call), reason(call)])
  assert.equal(new Set(rows.map(row => row.telemetry!.logicalCallId)).size, 2)
  await assert.rejects(reason({ ...call, validate: () => { throw Error("private-validator-detail") } }), /private-validator-detail/)
  assert.equal(rows.at(-1)!.telemetry!.outcome, "validator_exception")
  assert.deepEqual(rows.at(-1)!.usage, { input_tokens: 10, output_tokens: 5 })
  assert.doesNotMatch(JSON.stringify(rows), /private-validator-detail/)
})
