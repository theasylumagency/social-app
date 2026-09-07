import assert from "node:assert/strict"
import test from "node:test"
import { advanceWeeklyPlanning, compilePlanningContext } from "../src/application/weekly-planning/advance"
import { validateSchema } from "../src/blueprints/social/brand-discovery/validation"
import { resolveAudienceLandscape } from "../src/blueprints/social/audience-resolution"
import type { FounderAudienceStance } from "../src/blueprints/social/audience"
import { planningFixture, completePlanningFixture, planningOutput, planningReasoner } from "./weekly-planning-fixture"
import type { BrandModelCall } from "../src/infrastructure/models/brand-reasoning"
import { validatePlanningProse } from "../src/blueprints/social/weekly-planning/validation"

test("reference keys are accepted for mapping but rejected in founder-facing Georgian prose", async () => {
  assert.deepEqual(validatePlanningProse({ primaryAudienceKey: "a1", brandGoalKeys: ["g1"], text: "აუდიტორიას შეფასების გზა ვაჩვენოთ" }, ["a1", "g1", "d1"]), [])
  assert.equal(validatePlanningProse({ checks: { voice: "a1-ის საჭიროება g1-ს ემსახურება" }, concerns: [{ message: "იხილეთ d1", directionKeys: ["d1"] }] }, ["a1", "g1", "d1"]).length, 2)
  const run = await planningFixture()
  await advanceWeeklyPlanning(run, async (call) => {
    const value = planningOutput(call) as { weeklyObjective: { rationale: string } }
    value.weeklyObjective.rationale = "ფოკუსი a1-ის პრობლემაზეა"
    assert.ok(call.validate!(value).some((error) => error.includes("opaque reference")))
    return planningReasoner()(call)
  })
})

test("weekly context carries confirmed selected goals, founder disagreement, envelope and honest absence of results", async () => {
  const run = await planningFixture()
  const p = run.payload.basis.payload
  const stance = { audienceHypothesisId: p.hypotheses[0]!.id, stance: "disagree", note: "ეს ჯგუფი იშვიათად მოდის", createdAt: p.hypotheses[0]!.createdAt, updatedAt: p.hypotheses[0]!.createdAt } as FounderAudienceStance
  p.feedback.stances = [stance]
  p.landscape = resolveAudienceLandscape({ brandId: p.landscape!.brandId, hypotheses: p.hypotheses, founderStances: p.feedback.stances, founderProvidedAudiences: [] }, p.landscape!.generatedAt)
  run.payload.priority = "გვკითხავენ, რა ფოტო გამოგვიგზავნონ"
  const context = compilePlanningContext(run)
  assert.equal(context.selectedBrandGoals.length, 1)
  assert.equal(context.selectedBrandGoals[0]!.title, p.goals[0]!.title)
  assert.equal(context.audiences[0]!.influence, "limited")
  assert.equal(context.audiences[0]!.founderNote, stance.note)
  assert.equal(context.userPriority, run.payload.priority)
  assert.deepEqual(context.communicationEnvelope.framingRules, p.envelope!.framingRules)
  assert.deepEqual(context.recentResults, [])
  assert.deepEqual(context.eligibleProof, [])
  assert.equal(context.dataAvailability.priorPlansAreResults, false)
  assert.ok(!JSON.stringify(context).includes(run.brandId))
})
test("all six stages assemble a reviewable canonical week with application-owned references and dates", async () => {
  const run = await planningFixture()
  const original = structuredClone(run)
  const calls: BrandModelCall[] = []
  const ready = await completePlanningFixture(run, calls)
  assert.deepEqual(calls.map((c) => c.step), ["weekly_objective", "weekly_focus", "weekly_directions", "weekly_adaptation", "weekly_experiment", "weekly_review"])
  assert.deepEqual(run, original)
  const plan = ready.payload.plan!
  assert.equal(plan.state, "awaitingReview")
  assert.equal(plan.startsOn, "2026-09-07")
  assert.equal(plan.endsOn, "2026-09-13")
  assert.equal(plan.communicationEnvelopeId, run.payload.basis.payload.envelope!.id)
  assert.deepEqual(plan.contentDirections.map((d) => d.order), [0, 1, 2])
  assert.equal(plan.contentDirections[0]?.audienceDirection.primaryAudience.id, run.payload.basis.payload.hypotheses[0]!.id)
  assert.equal(plan.experimentDecision.experiment, null)
  assert.deepEqual((calls[1]!.input as { weeklyObjective: unknown }).weeklyObjective, ready.payload.objective)
  assert.deepEqual(ready.payload.basis, run.payload.basis)
})
test("unknown audiences, out-of-focus assignments and fabricated direction keys cannot be assembled", async () => {
  const ready = await completePlanningFixture(await planningFixture())
  type TestOutput = { focus: { primaryAudienceKey: string; secondaryAudienceKeys: string[] }; directions: { primaryAudienceKey: string; contentDirectionKey: string }[] }
  for (const [step, mutate] of [
    ["focus", (v: TestOutput) => { v.focus.primaryAudienceKey = "a99" }],
    ["focus", (v: TestOutput) => { v.focus.secondaryAudienceKeys = ["a1"] }],
    ["adaptation", (v: TestOutput) => { v.directions[0]!.primaryAudienceKey = "a99" }],
    ["adaptation", (v: TestOutput) => { v.directions[0]!.contentDirectionKey = "invented" }],
    ["adaptation", (v: TestOutput) => { v.directions.pop() }],
  ] as const) {
    await assert.rejects(() => advanceWeeklyPlanning({ ...ready, step }, async (call) => {
      const value = planningOutput(call) as TestOutput
      mutate(value)
      assert.ok(call.validate!(value).length)
      throw Error("rejected")
    }), /rejected/)
  }
})
test("nullable experiment fields reject malformed values and no-experiment cannot carry hidden experiment content", async () => {
  assert.ok(validateSchema({ injected: true }, { type: ["string", "null"] }).length)
  assert.deepEqual(validateSchema(null, { type: ["string", "null"] }), [])
  const ready = await completePlanningFixture(await planningFixture())
  await assert.rejects(() => advanceWeeklyPlanning({ ...ready, step: "experiment" }, async (call) => {
    const value = planningOutput(call) as { experimentDecision: { experiment: { hypothesis: string | null } } }
    value.experimentDecision.experiment.hypothesis = "Run an unrequested experiment"
    assert.ok(call.validate!(value).length)
    throw Error("rejected")
  }), /rejected/)
})
test("revision intent and previous plans remain intent, while a failed stage preserves completed decisions", async () => {
  const run = await planningFixture()
  run.payload.revisionNote = "ამ კვირაში ახსენი მხოლოდ შეფასების პირველი ნაბიჯი"
  run.payload.previousVersion = { week: run.week, objective: "Previous intention", directions: ["Old direction"], experiment: null }
  const objective = await advanceWeeklyPlanning(run, planningReasoner())
  const next = { ...run, ...objective }
  const snapshot = structuredClone(next)
  await assert.rejects(() => advanceWeeklyPlanning(next, async (call) => {
    const context = call.input as ReturnType<typeof compilePlanningContext>
    assert.equal(context.revisionNote, run.payload.revisionNote)
    assert.equal(context.previousVersion?.objective, "Previous intention")
    assert.deepEqual(context.recentResults, [])
    throw Error("Temporary model failure")
  }), /Temporary model failure/)
  assert.deepEqual(next, snapshot)
})
