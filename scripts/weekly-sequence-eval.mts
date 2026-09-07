import assert from "node:assert/strict"
import { mkdir, writeFile } from "node:fs/promises"
import { createBrandReasoner, type BrandModelRun } from "../src/infrastructure/models/brand-reasoning"
import { postStageModel } from "../src/infrastructure/models/runtime-policy"
import { reviewPostSequence } from "../src/application/weekly-planning/posts"
import { sequenceIssues } from "../src/blueprints/social/weekly-planning/sequence"
import { emptyPosts } from "../src/blueprints/social/weekly-planning/posts"
import { planningFixture } from "../tests/weekly-planning-fixture"
import { scheduleFixture } from "../tests/weekly-posts-fixture"
import { ordinaryPosts, suppliedWeek } from "../tests/weekly-sequence-fixture"

// Opt-in live evaluation: calls the configured reviewer, never mutates account or brand state.
const first = suppliedWeek(1), second = suppliedWeek(2), ordinary = ordinaryPosts()
const paraphrase = { ...ordinary[1]!, title: "ერთი სურათი სრულ პასუხს ვერ გვაძლევს", brief: { ...ordinary[1]!.brief, job: "დისტანციური დათვალიერებით დაპირების შეუძლებლობის განმარტება", takeaway: "გამოსახულება შიდა მდგომარეობას ვერ ადასტურებს და შედეგს ვერ გვპირდება" } }
const substantive = [
  ["თუ შემოსავალი შრომას აღარ მოითხოვს, ვის ეკუთვნის გადაწყვეტილება?", "საბაზისო შემოსავლისა და პოლიტიკური ავტონომიის კავშირის გამოკვლევა", "შემოსავლის დამოუკიდებლობა პოლიტიკური ძალაუფლების დამოუკიდებლობას თავისთავად არ ნიშნავს", "შემოსავლის მიღება და განაწილების წესის განსაზღვრა სხვადასხვა ძალაუფლებაა", "ჰიპოთეტურ სისტემაში მოქალაქე შემოსავალს იღებს, მაგრამ წესს ვერ ცვლის"],
  ["ვინ არის მოქალაქე სისტემაში, რომელსაც მხოლოდ მოსახლეობა სჭირდება?", "მოქალაქეობასა და ადმინისტრაციულ აღრიცხვას შორის პოლიტიკური კონფლიქტის გაშლა", "ადამიანების საჭიროებების აღრიცხვა არ უდრის მათთვის გადაწყვეტილების უფლების მიცემას", "ადმინისტრაციული ზრუნვა და პოლიტიკური მონაწილეობა შეიძლება ერთმანეთს დაშორდეს", "ორი თანმიმდევრული პოზიცია: ეფექტიანი განაწილება და თვითმმართველობა"],
  ["ავტომატიზაციის შემდეგ თავისუფალი დრო ვის ეკუთვნის?", "შრომისგან გათავისუფლებისა და დროის კონტროლის განსხვავების შესწავლა", "ნაკლები სამუშაო დრო თავისუფლებას მხოლოდ მაშინ ზრდის, თუ დარჩენილი დროის განკარგვაც ადამიანს შეუძლია", "ჰიპოთეტური სერვისი ადამიანს საქმეს უმცირებს, მაგრამ მუდმივ ხელმისაწვდომობას ითხოვს", "კონფლიქტი: დროის დაზოგვა და დროის ავტონომია"],
].map(([title, job, takeaway, ...points], i) => ({ ...ordinary[i]!, title: title!, brief: { ...ordinary[i]!.brief, job: job!, takeaway: takeaway!, points } }))
const scenarios = [
  { name: "almost-another-cross-week", posts: second, history: first, expected: "block" },
  { name: "almost-another-within-week", posts: [first[0]!, second[0]!], history: [], expected: "block" },
  { name: "almost-another-substantive-progress", posts: substantive, history: first, expected: "pass" },
  { name: "ordinary-within-week-paraphrase", posts: [ordinary[1]!, paraphrase], history: [], expected: "block" },
  { name: "ordinary-cross-week-paraphrase", posts: [paraphrase], history: [ordinary[1]!], expected: "block" },
  { name: "ordinary-narrow-useful-week", posts: ordinary, history: [], expected: "pass" },
  { name: "ordinary-same-topic-progress", posts: [ordinary[0]!, ordinary[2]!], history: [ordinary[1]!], expected: "pass" },
  { name: "ordinary-requested-repeat", posts: [paraphrase], history: [ordinary[1]!], expected: "pass", priority: "ამ კვირაში იგივე განმარტება გაიმეორეთ ახალი მკითხველებისთვის: ფოტო სრულ შეფასებას და შედეგის გარანტიას ვერ შეცვლის." },
] as const
await mkdir("evals/results/weekly-sequence", { recursive: true })
const results = []
for (const scenario of scenarios) {
  const selected = process.argv.find((a) => a.startsWith("--case="))?.slice(7)
  if (selected && scenario.name !== selected) continue
  const run = await planningFixture()
  run.week = "2026-09-21"
  run.payload.priority = "priority" in scenario ? scenario.priority : ""
  run.payload.objective = { objective: scenario.name.startsWith("almost") ? "მკითხველმა დაინახოს პროექტის ინტელექტუალური ღირებულება პოლიტიკური საკითხის გააზრებაში" : "მფლობელმა შეძლოს ნივთის შეკეთების შეფასებისთვის მომზადება", rationale: "მკითხველისთვის სასარგებლო პროგრესი", deliberateOmissions: [] }
  run.payload.priorWeeks = scenario.history.length ? [{ week: "2026-09-14", objective: run.payload.objective.objective, directions: [], experiment: null, status: "ready", posts: scenario.history.map((p) => ({ title: p.title, ...p.brief })) }] : []
  const audit: BrandModelRun[] = []
  const review = await reviewPostSequence(run, { ...emptyPosts(), outline: { ...scheduleFixture(), posts: [...scenario.posts] } }, createBrandReasoner(async (r) => { audit.push(r) }, { model: postStageModel("review"), reasoningEffort: "low" }))
  const blocked = sequenceIssues(review).length > 0
  const issues = sequenceIssues(review)
  const passed = blocked === (scenario.expected === "block") && (scenario.name !== "almost-another-cross-week" || ["p1", "p2", "p3"].every((key) => issues.some((i) => i.postKey === key)))
  results.push({ name: scenario.name, expected: scenario.expected, passed, review, audit })
  await writeFile(`evals/results/weekly-sequence/${selected ?? "latest"}.json`, JSON.stringify({ evaluatedAt: new Date().toISOString(), results }, null, 2))
  console.log(JSON.stringify({ name: scenario.name, passed, blockingIssues: sequenceIssues(review).length }))
}
assert.ok(results.length && results.every((r) => r.passed), "See evals/results/weekly-sequence for failing semantic cases")
