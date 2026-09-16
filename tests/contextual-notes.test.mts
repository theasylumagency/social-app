import assert from "node:assert/strict"
import test from "node:test"
import { decideNote, interpretChannelPolicy, interpretOperatingRule, targetHash, INTERPRETATION_SCHEMA, type Interpretation, type NoteContext, type Statement } from "../src/application/contextual-notes/model"
import { validateSchema } from "../src/blueprints/social/brand-discovery/validation"
import { createTranscriber, speechConfig } from "../src/infrastructure/speech/transcription"
import { limitedBody } from "../src/app/_server/limited-body"
import { operatingRuleViolations, ruleScopeOverlaps } from "../src/core/domain/operating-policy"

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
  assert.deepEqual(interpretOperatingRule(standing)?.scope.channel, "all")
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
})
test("voice adapter sends configured model and returns text only; no persistence or semantic action", async () => {
  const config = speechConfig({ SPEECH_TO_TEXT_PROVIDER: "openai", SPEECH_TO_TEXT_MODEL: "configured-model", OPENAI_API_KEY: "test-key" })
  const adapter = createTranscriber(config, async (url, init) => {
    assert.equal(url, config.endpoint)
    const form = init!.body as FormData
    assert.equal(form.get("model"), "configured-model")
    assert.equal(form.get("response_format"), "json")
    return Response.json({ text: "  ამ კვირაში ვიდეოს ვერ გადავიღებთ.  " })
  })
  assert.equal(await adapter(new File(["audio"], "note.webm", { type: "audio/webm" })), "ამ კვირაში ვიდეოს ვერ გადავიღებთ.")
  await assert.rejects(() => adapter(new File(["not audio"], "note.txt", { type: "text/plain" })))
  await assert.rejects(() => createTranscriber(config, async () => Response.json({ text: "" }))(new File(["audio"], "note.webm", { type: "audio/webm" })))
})
test("streaming body limit rejects oversized uploads without trusting Content-Length", async () => {
  await assert.rejects(() => limitedBody(new Request("https://example.test", { method: "POST", body: "1234567" }), 5))
  assert.equal(new TextDecoder().decode(await limitedBody(new Request("https://example.test", { method: "POST", body: "123" }), 5)), "123")
})
