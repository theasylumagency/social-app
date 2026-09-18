import assert from "node:assert/strict"
import test from "node:test"
import { decideNote, interpretChannelPolicy, interpretOperatingRule, targetHash, INTERPRETATION_SCHEMA, type Interpretation, type NoteContext, type Statement } from "../src/application/contextual-notes/model"
import { validateSchema } from "../src/blueprints/social/brand-discovery/validation"
import { createTranscriber, speechConfig } from "../src/infrastructure/speech/transcription"
import { limitedBody } from "../src/app/_server/limited-body"
import { operatingRuleEnforcement, operatingRuleScope, operatingRuleViolations, ruleApplies, ruleScopeOverlaps, subtractRuleScope, type OperatingRuleDraft } from "../src/core/domain/operating-policy"
import { validateVariantOperatingRules } from "../src/blueprints/social/weekly-planning/post-context"
import { POST_EDITORIAL_PROMPT } from "../src/blueprints/social/weekly-planning/post-editorial"

export const noteContext: NoteContext = { brandId: "brand:test", section: "week", week: "2026-09-14", postKey: null, channel: null, runId: null }
export function interpreted(kind: Statement["kind"], scope: Statement["scope"], action: Interpretation["action"], quote = "მოკლე."): Interpretation {
  return { statements: [{ quote, kind, scope, meaning: quote, actionable: true }], response: "მიზანს მოქმედი გეგმის საფუძველზე ვაფასებთ.", clarification: "", action, instruction: "არჩეული ტექსტი შეამოკლე და შეინარჩუნე პოსტის მიზანი.", ambiguous: false }
}
test("temporary weekly production constraints apply locally; general plan revisions require consequence confirmation", () => {
  const v = interpreted("constraint", "week", "revise_plan", "ამ კვირაში ვიდეოს ვერ გადავიღებთ.")
  assert.equal(decideNote(v, noteContext).mode, "apply")
  assert.equal(decideNote(interpreted("instruction", "week", "revise_plan"), noteContext).mode, "confirm")
})
test("noisy objectives and objections do not authorize state changes, even if model suggests an action", () => {
  for (const [kind, quote] of [["objective_reminder", "აუუუ, ეგეთი რაღეცეები საერთოდ არ მაინტერესებსმე უფრო ჩემი ტრაქტარისგაყიდვა მინდა"], ["challenge", "სამი საგანმანათლებლო პოსტი ზედმეტი მგონია."], ["emotion", "ეს საშინელებაა."], ["speculation", "იქნებ ასე ჯობდეს"], ["question", "რატომ?"]] as const) {
    assert.equal(decideNote(interpreted(kind, "week", "revise_plan", quote), noteContext).action, "none")
  }
})
test("explicit standing rules and channel policy require consequence confirmation", () => {
  const standing = interpreted("standing_rule", "ongoing", "set_operating_rule", "ამიერიდან ემოჯი საერთოდ არ გამოიყენოთ.")
  standing.instruction = standing.statements[0]!.quote
  assert.deepEqual(interpretOperatingRule(standing)?.scope.channels.include, "all")
  assert.equal(decideNote(standing, noteContext).action, "set_operating_rule")
  assert.equal(decideNote(standing, noteContext).mode, "confirm")
  const channel = interpreted("channel_policy", "channel", "set_channel_policy", "Instagram-ს არ ვენდობი. მოდი ამოვიღოთ.")
  channel.instruction = channel.statements[0]!.quote
  assert.deepEqual(interpretChannelPolicy(channel), { channel: "instagram", active: false })
  assert.equal(decideNote(channel, noteContext).mode, "confirm")
})
test("short and tone feedback resolve to the selected post and channel, never a permanent rule", () => {
  const selected: NoteContext = { ...noteContext, section: "content", postKey: "p1", channel: "facebook", runId: "run" }
  for (const quote of ["მოკლე.", "ძალიან ოფიციალურია."]) assert.equal(decideNote(interpreted("draft_correction", "post", "revise_post", quote), selected).mode, "apply")
  assert.equal(decideNote(interpreted("draft_correction", "post", "revise_post"), { ...selected, postKey: null }).mode, "clarify")
})
test("vague requests ask one question; independent challenge does not block a clear weekly constraint", () => {
  const value = interpreted("instruction", "unclear", "revise_plan", "მოდი ეს ცოტა სხვანაირად გავაკეთოთ.")
  value.ambiguous = true; value.clarification = "რაოდენობა გსურთ შეიცვალოს თუ მიმართულება?"
  assert.equal(decideNote(value, noteContext).message, value.clarification)
  const multi = interpreted("constraint", "week", "revise_plan")
  multi.statements.push({ ...multi.statements[0]!, kind: "challenge", scope: "week" })
  assert.equal(decideNote(multi, noteContext).mode, "apply")
  assert.equal(multi.statements.length, 2)
})
test("typed rules have deterministic scope/conflict and validation behavior", () => {
  const global = interpretOperatingRule({ ...interpreted("standing_rule", "ongoing", "set_operating_rule", "ამიერიდან ემოჯი საერთოდ არ გამოიყენოთ."), instruction: "ამიერიდან ემოჯი საერთოდ არ გამოიყენოთ." })!
  const instagram = interpretOperatingRule({ ...interpreted("standing_rule", "ongoing", "set_operating_rule", "Instagram-ზე ერთი ემოჯი შეიძლება გამოვიყენოთ."), instruction: "Instagram-ზე ერთი ემოჯი შეიძლება გამოვიყენოთ." })!
  assert.equal(ruleScopeOverlaps(global.scope, instagram.scope), true)
  assert.equal(global.effect, "forbid")
  assert.equal(instagram.effect, "allow")
  assert.deepEqual(operatingRuleViolations("მოგესალმებით 😊", [global]), ["Active operating rule forbids emoji"])
})
test("channel and content-type scopes intersect, while unknown dimensions never broaden a narrow rule", () => {
  const rule: OperatingRuleDraft = { kind: "emoji", effect: "allow", parameter: "1", directive: "ერთი ემოჯი შეიძლება.", scope: operatingRuleScope({ channel: "instagram", contentType: "advertising" }) }
  assert.equal(ruleApplies(rule, { channel: "instagram", contentType: "advertising", campaign: null, communicationElement: "caption" }), true)
  assert.equal(ruleApplies(rule, { channel: "facebook", contentType: "advertising", campaign: null, communicationElement: "caption" }), false)
  assert.equal(ruleApplies(rule, { channel: "instagram", contentType: "organic", campaign: null, communicationElement: "caption" }), false)
  assert.equal(ruleApplies(rule, { channel: "instagram", campaign: null, communicationElement: "caption" }), false)
  const residual = subtractRuleScope(operatingRuleScope(), operatingRuleScope({ contentType: "advertising" }))[0]!
  assert.equal(ruleApplies({ ...rule, scope: residual }, { channel: "instagram", campaign: null, communicationElement: "caption" }), false)
})
test("communication-element scope validates only the mapped generated field", () => {
  const rule: OperatingRuleDraft = { kind: "emoji", effect: "forbid", parameter: null, directive: "ქეფშენში ემოჯი არ გამოიყენოთ.", scope: operatingRuleScope({ communicationElement: "caption" }) }
  const variant = { channel: "instagram" as const, caption: "სუფთა ქეფშენი", script: "ვიდეო 😊", onScreenText: [], frames: [] }
  assert.deepEqual(validateVariantOperatingRules(variant, [rule]), [])
  assert.deepEqual(validateVariantOperatingRules({ ...variant, caption: "ქეფშენი 😊" }, [rule]), ["Active operating rule forbids emoji"])
})
test("residual scope subtraction also preserves campaign and communication-element remainders", () => {
  const base: OperatingRuleDraft = { kind: "price", effect: "forbid", parameter: null, directive: "ფასი არ ახსენოთ.", scope: operatingRuleScope() }
  const elementResidual = subtractRuleScope(base.scope, operatingRuleScope({ communicationElement: "caption" }))[0]!
  assert.equal(ruleApplies({ ...base, scope: elementResidual }, { channel: "facebook", contentType: "organic", campaign: null, communicationElement: "script" }), true)
  assert.equal(ruleApplies({ ...base, scope: elementResidual }, { channel: "facebook", contentType: "organic", campaign: null, communicationElement: "caption" }), false)
  const campaign = { ...base, scope: operatingRuleScope({ campaign: "შემოდგომა" }) }
  assert.equal(ruleApplies(campaign, { channel: "facebook", contentType: "organic", campaign: "შემოდგომა", communicationElement: "caption" }), true)
  assert.equal(ruleApplies(campaign, { channel: "facebook", contentType: "organic", campaign: null, communicationElement: "caption" }), false)
})
test("Georgian address form follows the semantic editorial path", () => {
  const rule: OperatingRuleDraft = { kind: "address_form", effect: "require", parameter: "formal", directive: "აუდიტორიას თქვენობით მიმართეთ.", scope: operatingRuleScope() }
  assert.equal(operatingRuleEnforcement(rule), "semantic")
  assert.deepEqual(operatingRuleViolations("შენ ნახე შეთავაზება", [rule]), [])
  assert.match(POST_EDITORIAL_PROMPT, /address_form\/formal[\s\S]*Georgian phrasing/)
})
test("generic target hashes are stable across object key order", () => {
  assert.equal(targetHash({ direction: "A", order: 1 }), targetHash({ order: 1, direction: "A" }))
})
test("brand facts require an explicit draft consequence confirmation and valid semantic schema", () => {
  const v = interpreted("correction", "brand", "revise_brand")
  assert.equal(decideNote(v, { ...noteContext, section: "brand" }).mode, "confirm")
  assert.deepEqual(validateSchema(v, INTERPRETATION_SCHEMA), [])
  assert.notDeepEqual(validateSchema({ ...v, action: "delete_account" }, INTERPRETATION_SCHEMA), [])
})
test("STT configuration selects explicit provider and model, rejects unknown or incomplete settings", () => {
  const env = { SPEECH_TO_TEXT_PROVIDER: "openai", SPEECH_TO_TEXT_MODEL: "test-model", OPENAI_API_KEY: "test-key" }
  assert.equal(speechConfig(env).model, "test-model")
  assert.equal(speechConfig(env).endpoint, "https://api.openai.com/v1/audio/transcriptions")
  for (const change of [{ SPEECH_TO_TEXT_PROVIDER: "unknown" }, { SPEECH_TO_TEXT_MODEL: "" }, { OPENAI_API_KEY: "" }]) assert.throws(() => speechConfig({ ...env, ...change }))
  const compatible = { SPEECH_TO_TEXT_PROVIDER: "openai-compatible", SPEECH_TO_TEXT_MODEL: "different-model", SPEECH_TO_TEXT_API_KEY: "other-key", SPEECH_TO_TEXT_ENDPOINT: "https://speech.example.test/transcribe" }
  assert.equal(speechConfig(compatible).apiKey, "other-key")
  assert.throws(() => speechConfig({ ...compatible, SPEECH_TO_TEXT_ENDPOINT: "http://speech.example.test" }))
  assert.throws(() => speechConfig({ ...compatible, SPEECH_TO_TEXT_ENDPOINT: "https://user:secret@speech.example.test" }))
  const elevenlabs = { SPEECH_TO_TEXT_PROVIDER: "elevenlabs", SPEECH_TO_TEXT_MODEL: "scribe_v2", ELEVENLABS_API_KEY: "eleven-key" }
  assert.deepEqual(speechConfig(elevenlabs), { provider: "elevenlabs", model: "scribe_v2", apiKey: "eleven-key", endpoint: "https://api.elevenlabs.io/v1/speech-to-text" })
  assert.throws(() => speechConfig({ ...elevenlabs, ELEVENLABS_API_KEY: "" }))
})
test("OpenAI voice adapter retains its existing request shape and returns text only", async () => {
  const config = speechConfig({ SPEECH_TO_TEXT_PROVIDER: "openai", SPEECH_TO_TEXT_MODEL: "configured-model", OPENAI_API_KEY: "test-key" })
  const adapter = createTranscriber(config, async (url, init) => {
    assert.equal(url, config.endpoint)
    assert.deepEqual(init!.headers, { authorization: "Bearer test-key" })
    const form = init!.body as FormData
    assert.equal(form.get("model"), "configured-model")
    assert.equal(form.get("response_format"), "json")
    assert.equal(form.get("language"), "ka")
    assert.equal(typeof form.get("prompt"), "string")
    return Response.json({ text: "  ამ კვირაში ვიდეოს ვერ გადავიღებთ.  " })
  })
  assert.equal(await adapter(new File(["audio"], "note.webm", { type: "audio/webm" })), "ამ კვირაში ვიდეოს ვერ გადავიღებთ.")
  await assert.rejects(() => adapter(new File(["not audio"], "note.txt", { type: "text/plain" })))
  await assert.rejects(() => createTranscriber(config, async () => Response.json({ text: "" }))(new File(["audio"], "note.webm", { type: "audio/webm" })))
})
test("ElevenLabs voice adapter sends Scribe v2 fields, xi-api-key auth, and response text", async () => {
  const config = speechConfig({ SPEECH_TO_TEXT_PROVIDER: "elevenlabs", SPEECH_TO_TEXT_MODEL: "scribe_v2", ELEVENLABS_API_KEY: "eleven-key" })
  const adapter = createTranscriber(config, async (url, init) => {
    assert.equal(url, "https://api.elevenlabs.io/v1/speech-to-text")
    assert.equal(init!.method, "POST")
    assert.deepEqual(init!.headers, { "xi-api-key": "eleven-key" })
    const form = init!.body as FormData
    assert.equal((form.get("file") as File).name, "note.webm")
    assert.equal(form.get("model_id"), "scribe_v2")
    assert.equal(form.get("language_code"), "kat")
    assert.equal(form.get("no_verbatim"), "false")
    assert.equal(form.get("tag_audio_events"), "false")
    assert.equal(form.get("num_speakers"), "1")
    assert.equal(form.get("model"), null)
    assert.equal(form.get("response_format"), null)
    assert.equal(form.get("language"), null)
    assert.equal(form.get("prompt"), null)
    return Response.json({ text: "  ნედლი ტექსტი  " })
  })
  assert.equal(await adapter(new File(["audio"], "note.webm", { type: "audio/webm" })), "ნედლი ტექსტი")
})
test("ElevenLabs provider errors and invalid responses use the existing transcriber errors", async () => {
  const config = speechConfig({ SPEECH_TO_TEXT_PROVIDER: "elevenlabs", SPEECH_TO_TEXT_MODEL: "scribe_v2", ELEVENLABS_API_KEY: "eleven-key" })
  const file = new File(["audio"], "note.webm", { type: "audio/webm" })
  await assert.rejects(() => createTranscriber(config, async () => new Response("unavailable", { status: 503 }))(file), /ხმის ამოცნობა ვერ დასრულდა/)
  await assert.rejects(() => createTranscriber(config, async () => Response.json({ text: "" }))(file), /ჩანაწერში ტექსტი ვერ ამოვიცანით/)
})
test("streaming body limit rejects oversized uploads without trusting Content-Length", async () => {
  await assert.rejects(() => limitedBody(new Request("https://example.test", { method: "POST", body: "1234567" }), 5))
  assert.equal(new TextDecoder().decode(await limitedBody(new Request("https://example.test", { method: "POST", body: "123" }), 5)), "123")
})
