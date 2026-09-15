import assert from "node:assert/strict"
import test from "node:test"
import { INTERPRETER_PROMPT, INTERPRETATION_SCHEMA, decideNote, type Interpretation, type NoteContext } from "../src/application/contextual-notes/model"
import { createBrandReasoner } from "../src/infrastructure/models/brand-reasoning"

const enabled = process.env.LIVE_CONTEXTUAL_NOTES === "1"
const base: NoteContext = { brandId: "synthetic-tractor-company", section: "week", week: "2026-09-14", postKey: null, runId: null, channel: null }
const cases = [
  { text: "ამ კვირაში ვიდეოს ვერ გადავიღებთ.", context: base, mode: "apply", kind: "constraint" },
  { text: "სამი საგანმანათლებლო პოსტი ზედმეტი მგონია.", context: base, mode: "explain", kind: "challenge" },
  { text: "ამიერიდან ემოჯი საერთოდ არ გამოიყენოთ.", context: base, mode: "explain", kind: "standing_rule" },
  { text: "აუუუ, ეგეთი რაღეცეები საერთოდ არ მაინტერესებსმე უფრო ჩემი ტრაქტარისგაყიდვა მინდა", context: base, mode: "explain", kind: "objective_reminder" },
  { text: "Instagram-ს არ ვენდობი. მოდი ამოვიღოთ.", context: base, mode: "explain", kind: "channel_policy" },
  { text: "ძალიან ოფიციალურია.", context: { ...base, section: "content", postKey: "p1", channel: "facebook", runId: "synthetic-run" }, mode: "apply", kind: "draft_correction" },
  { text: "მოკლე.", context: { ...base, section: "content", postKey: "p1", channel: "facebook", runId: "synthetic-run" }, mode: "apply", kind: "draft_correction" },
  { text: "მოდი ეს ცოტა სხვანაირად გავაკეთოთ.", context: base, mode: "clarify", kind: null },
] as const
test("live semantic acceptance A–H using synthetic context only; never executes domain operations", { skip: !enabled }, async t => {
  const reason = createBrandReasoner(async () => {}, { requestTimeoutMs: 40000, ...(process.env.OPENAI_CONTEXTUAL_NOTES_MODEL ? { model: process.env.OPENAI_CONTEXTUAL_NOTES_MODEL } : {}) })
  for (const fixture of cases) await t.test(fixture.text, async () => {
    const result = await reason<Interpretation>({ step: "contextual_notes", version: "contextual-notes-v1", prompt: INTERPRETER_PROMPT, schema: INTERPRETATION_SCHEMA,
      input: { message: fixture.text, context: fixture.context, brand: { business: "ყიდის ტრაქტორებს", objective: "ტრაქტორის გაყიდვა" }, plan: { objective: "დაეხმაროს მყიდველს საჭირო ტრაქტორის შერჩევაში", directions: ["გამოყენების მაგალითი", "შესაბამისი მოდელის შერჩევა", "შეძენის კითხვები"], rationale: "დამწყებ მყიდველს ჯერ შესაბამისობის დადგენა სჭირდება." }, selectedPost: fixture.context.section === "content" ? { caption: "გვსურს გაცნობოთ, რომ ჩვენი ორგანიზაცია გთავაზობთ ტრაქტორების ფართო ასორტიმენტს სასოფლო-სამეურნეო საქმიანობის მრავალფეროვანი საჭიროებებისთვის.", channel: "facebook" } : null },
      validate: v => (v as Interpretation).statements.every(s => fixture.text.includes(s.quote)) ? [] : ["Quote must match current raw input"],
    })
    assert.equal(decideNote(result, fixture.context).mode, fixture.mode, JSON.stringify(result))
    if (fixture.kind) assert.ok(result.statements.some(s => s.kind === fixture.kind || (fixture.kind === "constraint" && s.kind === "temporary_instruction")), JSON.stringify(result))
  })
})
