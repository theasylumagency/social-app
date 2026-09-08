from pathlib import Path
def edit(path,old,new):
 p=Path(path); s=p.read_text(encoding='utf-8')
 if old not in s: raise RuntimeError(f'Missing {path}: {old[:60]}')
 p.write_text(s.replace(old,new),encoding='utf-8')
edit('tests/weekly-planning-fixture.ts','import assert','import { approvedStrategy } from "./social-strategy-fixture"\nimport assert')
edit('tests/weekly-planning-fixture.ts','discovery.payload.feedback.selectedGoalIds = [discovery.payload.goals[0]!.id]','discovery.payload.feedback.selectedGoalIds = []')
edit('tests/weekly-planning-fixture.ts','payload: { basis, priority:','payload: { socialStrategy: approvedStrategy(basis), basis, priority:')
edit('tests/brand-discovery.test.mts','["understanding", "audiences", "profiles", "envelope", "goals"]','["understanding", "audiences", "profiles", "envelope"]')
edit('tests/brand-discovery.test.mts','assert.equal(ready.payload.goals[0]?.audienceIds[0], ready.payload.hypotheses[0]?.id)','assert.deepEqual(ready.payload.goals, [])')
edit('tests/brand-discovery.test.mts','assert.equal(ready.payload.feedback.selectedGoalIds, null)','assert.deepEqual(ready.payload.feedback.selectedGoalIds, [])')
edit('tests/weekly-posts.test.mts','["weekly_strategy", "weekly_review"]','["weekly_strategy"]')
edit('tests/weekly-planning.test.mts','p.goals[0]!.title','run.payload.socialStrategy!.payload.proposal!.objective')
edit('tests/weekly-planning.test.mts','assert.ok(!JSON.stringify(context).includes(run.brandId))','assert.equal(context.strategyVersion?.id, run.payload.socialStrategy?.id)')
edit('tests/weekly-planning.test.mts','all six stages assemble','one model call assembles')
edit('tests/weekly-planning.test.mts','["weekly_objective", "weekly_focus", "weekly_directions", "weekly_adaptation", "weekly_experiment", "weekly_review"]','["weekly_strategy"]')
edit('tests/weekly-planning.test.mts','assert.deepEqual((calls[1]!.input as { weeklyObjective: unknown }).weeklyObjective, ready.payload.objective)','assert.equal(calls.length, 1)')
edit('tests/weekly-planning.test.mts','directions: { primaryAudienceKey: string; contentDirectionKey: string }[]','audienceDirections: { primaryAudienceKey: string; contentDirectionKey: string }[]')
edit('tests/weekly-planning.test.mts','v.directions','v.audienceDirections')
edit('tests/weekly-planning.test.mts','const next = { ...run, ...objective }','const next = { ...run, ...objective, step: "objective" as const }')
# Obsolete paid novelty evaluation commands are deliberately retired, not kept alive with adapters.
for path in ['scripts/weekly-sequence-eval.mts','scripts/weekly-sequence-generation-eval.mts']:
 Path(path).unlink()
p=Path('package.json'); s=p.read_text(encoding='utf-8'); s='\n'.join(l for l in s.splitlines() if '"eval:weekly-sequence"' not in l); p.write_text(s+'\n',encoding='utf-8')
# Replace the novelty suite with lexical hygiene and legacy reading behavior.
Path('tests/weekly-sequence.test.mts').write_text('''import assert from "node:assert/strict"
import test from "node:test"
import { nearVerbatim, duplicateCopyIssues } from "../src/blueprints/social/weekly-planning/duplicate-hygiene"
import { recentEditorialWork } from "../src/blueprints/social/weekly-planning/sequence"
import { emptyPosts } from "../src/blueprints/social/weekly-planning/posts"
import { planningFixture } from "./weekly-planning-fixture"
import { copyFixture, scheduleFixture } from "./weekly-posts-fixture"

test("same strategic idea in different copy is allowed across weeks", () => {
  assert.equal(nearVerbatim("დაზიანების ფოტო საწყისი შეფასებისთვის გამოგვიგზავნეთ.", "პირველი ნაბიჯი ნივთის სურათით იწყება; საბოლოო შესაძლებლობას ადგილზე განვიხილავთ."), false)
})
test("exact and near-verbatim copy is caught, including unicode punctuation", () => {
  assert.ok(nearVerbatim("ფოტო — შეფასებისთვის!", "ფოტო შეფასებისთვის"))
  const text = Array.from({ length: 40 }, (_, i) => `word${i}`).join(" ")
  assert.ok(nearVerbatim(text, text.replace("word15", "changed")))
  assert.equal(nearVerbatim(text, "unrelated useful post"), false)
})
test("cross-channel variants of one post are allowed; separate duplicate posts are blocked", () => {
  const payload = { ...emptyPosts(), outline: scheduleFixture(), copies: { p1: copyFixture() } }
  assert.deepEqual(duplicateCopyIssues(payload), [])
  assert.deepEqual(duplicateCopyIssues({ ...payload, copies: { ...payload.copies, p2: copyFixture() } }).map((i) => i.postKey), ["p2"])
})
test("legacy title-only history stays readable and does not imply publication", async () => {
  const run = await planningFixture()
  run.payload.priorWeeks = [{ week: "2026-08-31", objective: "old", directions: ["ძველი მიმართულება"], experiment: null }]
  const history = recentEditorialWork(run.payload, run.week)
  assert.equal(history[0]?.status, "unknown")
  assert.equal(history[0]?.job, "ძველი მიმართულება")
})
''',encoding='utf-8')
# No trial promises remain in onboarding or emails.
edit('src/app/(auth)/auth-form.tsx','შექმენი ანგარიში. საცდელი 14 დღე პირველი ბრენდის გამართვის შემდეგ დაიწყება.','შექმენი ანგარიში და აირჩიე გამოწერა. ტესტირებისას თანხა არ ჩამოიჭრება.')
edit('src/app/(auth)/layout.tsx','<span aria-hidden="true">14</span><div><strong>დღე გამოსაცდელად</strong><p>ერთი ბრენდი · ბარათის გარეშე<br />გამოსახულების გენერაცია ფასიან ტარიფზეა.</p>','<span aria-hidden="true">U</span><div><strong>ერთი სივრცე თქვენი ბრენდებისთვის</strong><p>1, 3 ან 10 ბრენდი · შესაძლებელია გაუმჯობესება<br />ტესტირებისას — სატესტო გადახდა.</p>')
edit('src/app/workspace/weekly-posts-client.tsx','საცდელ გეგმაში გენერაცია არ შედის; საკუთარი გამოსახულების ატვირთვა შეგიძლიათ.','საკუთარი გამოსახულების ატვირთვა შეგიძლიათ.')
edit('src/blueprints/social/weekly-planning/compact-strategy.ts','  if (s.audienceDirections.length !== s.directions.length)','  if (new Set(focus).size !== focus.length || s.focus.secondaryAudienceKeys.length > 1) errors.push("Select distinct primary and at most one secondary audience")\n  if (new Set(s.audienceDirections.map((d) => d.contentDirectionKey)).size !== s.directions.length) errors.push("Map each direction once")\n  if (s.audienceDirections.length !== s.directions.length)')
