import assert from "node:assert/strict"
import test from "node:test"
import { randomUUID } from "node:crypto"
import sharp from "sharp"
import { assertVisualEnabled, creditCostForSuccessfulGeneration, readVisualPolicy, VISUAL_MODEL_DEFAULT } from "../src/application/visuals/policy"
import { parseVisualInput, readVisualJson } from "../src/application/visuals/input"
import { generateImageFromPrompt } from "../src/infrastructure/openai/image-generation"
import { SUBSCRIPTION_PLANS } from "../src/application/subscriptions/policy"

test("visual policy seeds only explicit non-production environments; models and quality are server configured", () => {
  for (const mode of ["development", "demo", "test"]) {
    assert.equal(readVisualPolicy({ VISUAL_MODE: mode, NODE_ENV: "production" }).seedCredits, 20)
  }
  assert.equal(readVisualPolicy({ NODE_ENV: "development" }).seedCredits, 20)
  assert.equal(readVisualPolicy({ NODE_ENV: "test" }).seedCredits, 20)
  for (const env of [{}, { NODE_ENV: "production" }, { VISUAL_MODE: "production", NODE_ENV: "development" }, { VISUAL_MODE: "disabled" }]) {
    assert.equal(readVisualPolicy(env).seedCredits, 0)
  }
  assert.equal(readVisualPolicy({}).model, VISUAL_MODEL_DEFAULT)
  assert.equal(readVisualPolicy({ OPENAI_IMAGE_MODEL: "gpt-image-2.5-flare", OPENAI_IMAGE_QUALITY: "low" }).model, "gpt-image-2.5-flare")
  assert.throws(() => readVisualPolicy({ VISUAL_MODE: "typo" }))
  assert.throws(() => readVisualPolicy({ OPENAI_IMAGE_QUALITY: "typo" }))
  assert.throws(() => assertVisualEnabled(readVisualPolicy({ VISUAL_MODE: "disabled" }), "key"))
  assert.throws(() => assertVisualEnabled(readVisualPolicy({}), ""))
  assert.equal(creditCostForSuccessfulGeneration(), 1)
  assert.deepEqual(Object.values(SUBSCRIPTION_PLANS).map((p) => p.visualCredits), [20, 60, 200])
})

test("input validation rejects malformed targets, oversized prompts and unsupported edit requests", async () => {
  const valid = { requestId: randomUUID(), prompt: "  A warm studio photograph  " }
  assert.equal(parseVisualInput(valid).prompt, "A warm studio photograph")
  for (const value of [null, [], {}, { ...valid, prompt: " " }, { ...valid, prompt: "x".repeat(4001) }, { ...valid, requestId: "bad" }, { ...valid, brandId: "" }, { ...valid, requestKind: "edit" }, { ...valid, target: { runId: randomUUID(), postKey: "p1", slot: -1 } }, { ...valid, target: { runId: randomUUID(), postKey: "p99", slot: 0 } }]) assert.throws(() => parseVisualInput(value))
  await assert.rejects(readVisualJson(new Request("https://example.test", { method: "POST", body: "x".repeat(24_001) })), /დიდია/)
  await assert.rejects(readVisualJson(new Request("https://example.test", { method: "POST", body: "{" })), /ფორმატი/)
})

const request = { prompt: "A blue ceramic bowl", model: VISUAL_MODEL_DEFAULT, quality: "medium" as const, aspectRatio: "4:5" as const }
test("OpenAI adapter requests one image, preserves request/usage evidence and persists valid webp bytes", async () => {
  const png = await sharp({ create: { width: 32, height: 40, channels: 3, background: "blue" } }).png().toBuffer()
  let calls = 0
  const image = await generateImageFromPrompt(request, { apiKey: "test-key", fetch: async (url, options) => {
    calls++
    assert.equal(url, "https://api.openai.com/v1/images/generations")
    const body = JSON.parse(String(options?.body))
    assert.equal(body.n, 1); assert.equal(body.model, VISUAL_MODEL_DEFAULT)
    assert.equal(body.size, "1024x1280"); assert.equal(body.output_format, "webp")
    return Response.json({ data: [{ b64_json: png.toString("base64") }], usage: { total_tokens: 12 } }, { headers: { "x-request-id": "req-test" } })
  } })
  assert.equal(calls, 1); assert.equal(image.width, 32); assert.equal(image.height, 40)
  assert.equal((await sharp(image.content).metadata()).format, "webp")
  assert.equal(image.providerRequestId, "req-test"); assert.equal(image.providerCostUsd, null)
  assert.deepEqual(image.metadata.usage, { total_tokens: 12 })
})

test("provider refusal, empty, malformed, network and non-image responses never retry automatically", async () => {
  for (const reply of [() => Response.json({ error: { message: "secret provider detail" } }, { status: 429 }), () => Response.json({ data: [] }), () => Response.json({ data: [{ b64_json: "" }] }), () => Response.json({ data: [{ b64_json: Buffer.from("not an image").toString("base64") }] }), () => new Response("{"), () => { throw Error("network failed") }]) {
    let calls = 0
    await assert.rejects(generateImageFromPrompt(request, { apiKey: "test-key", fetch: async () => { calls++; return reply() } }))
    assert.equal(calls, 1)
  }
})
