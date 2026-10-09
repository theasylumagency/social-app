import assert from "node:assert/strict"
import test from "node:test"
import { weeklyInstructionMessages } from "./fixtures/weekly-instructions"
import { bindWeeklyDirectives, validateWeeklyDirectives, validateDirectiveSchedule, type WeeklyDirectiveProposal } from "../src/application/weekly-planning/instruction-contract"
import { scheduleFixture } from "./weekly-posts-fixture"

const source = { items: weeklyInstructionMessages }
const text = (id: string) => source.items.find(item => item.id === id)!.text
const target = { brandId: "brand", runId: "run", runVersion: 3, week: "2026-10-05" }
const proposal = (): WeeklyDirectiveProposal => ({ cadence: [], direction: { intent: "unspecified", quote: "" },
  period: { kind: "unspecified", minimumWeeks: null, maximumWeeks: null, countingBasis: "unspecified", quote: "" }, formatChanges: [] })

test("the five human-authored meanings fit one contract without strategy/time invention", () => {
  const first = proposal()
  first.cadence = [{ channel: "instagram", mode: "set", quantity: 3, quote: text("U01") }, { channel: "facebook", mode: "set", quantity: 5, quote: text("U01") }]
  first.direction = { intent: "keep", quote: "მომწონს მიმარტულება" }
  first.period = { ...first.period, kind: "selectedWeek", quote: "ამ კვირაში" }
  const bound = bindWeeklyDirectives({ proposal: first, text: text("U01"), noteId: "U01", target })
  assert.deepEqual(bound.errors, [])
  assert.deepEqual(bound.directives!.requiredCadence, { instagram: 3, facebook: 5 })
  assert.deepEqual(bound.directives!.target, target)
  assert.equal(bound.directives!.source.text, text("U01"))
  assert.ok(validateDirectiveSchedule(scheduleFixture(), bound.directives!).some(issue => issue.includes("facebook")))

  const second = proposal()
  second.direction = { intent: "reconsider", quote: text("U02") }
  assert.deepEqual(validateWeeklyDirectives(second, text("U02")), [])
  assert.equal(second.period.kind, "unspecified")

  const third = proposal()
  third.cadence = [{ channel: "instagram", mode: "set", quantity: 2, quote: text("U03") }, { channel: "facebook", mode: "delegated", quantity: null, quote: text("U03") }]
  third.period = { kind: "durationWeeks", minimumWeeks: 3, maximumWeeks: 4, countingBasis: "perWeek", quote: text("U03") }
  assert.deepEqual(validateWeeklyDirectives(third, text("U03")), [])
  assert.deepEqual(bindWeeklyDirectives({ proposal: third, text: text("U03"), noteId: "U03", target }).errors, ["multiWeekPlanningNeedsClarification"])

  const fourth = proposal()
  fourth.cadence = ["facebook", "instagram"].map(channel => ({ channel: channel as "facebook" | "instagram", mode: "delta", quantity: 1, quote: text("U04") }))
  const delta = bindWeeklyDirectives({ proposal: fourth, text: text("U04"), noteId: "U04", target, baselineCounts: { facebook: 2, instagram: 3 } })
  assert.deepEqual(delta.directives!.requiredCadence, { facebook: 3, instagram: 4 })
  assert.equal(delta.directives!.proposal.period.kind, "unspecified")
  assert.ok(bindWeeklyDirectives({ proposal: fourth, text: text("U04"), noteId: "U04", target }).errors.includes("missingBaseline"))

  const fifth = proposal()
  fifth.cadence = [{ channel: "facebook", mode: "delta", quantity: 1, quote: text("U05") }, { channel: "instagram", mode: "delta", quantity: -2, quote: text("U05") }]
  fifth.formatChanges = [{ from: "reel", to: "carousel", quote: "ეხლა ვიდეო პოსტები შევცვალოთ კარუსელებით" }]
  fifth.period = { ...fifth.period, kind: "selectedWeek", quote: "ამ კვირაში" }
  const replaced = bindWeeklyDirectives({ proposal: fifth, text: text("U05"), noteId: "U05", target, baselineCounts: { facebook: 3, instagram: 3 } })
  assert.deepEqual(replaced.directives!.requiredCadence, { facebook: 4, instagram: 1 })
  assert.equal(replaced.directives!.proposal.direction.intent, "unspecified")
  const wrong = scheduleFixture(); wrong.posts[0]!.format = "reel"
  assert.ok(validateDirectiveSchedule(wrong, replaced.directives!).some(issue => issue.includes("reintroduce reel")))
})

test("bad provenance, duplicate scope and out-of-range deltas cannot produce executable directives", () => {
  const value = proposal()
  value.cadence = [{ channel: "facebook", mode: "delta", quantity: 1, quote: text("U04") }]
  assert.ok(bindWeeklyDirectives({ proposal: value, text: text("U04"), noteId: "U04", target, baselineCounts: { facebook: 5, instagram: 0 } }).errors.includes("cadenceOutOfBounds"))
  assert.ok(validateWeeklyDirectives(value, "other source").length)
  value.cadence.push({ ...value.cadence[0]! })
  assert.ok(validateWeeklyDirectives(value, text("U04")).includes("Contradictory or repeated channel condition"))
  assert.ok(bindWeeklyDirectives({ proposal: { cadence: null } as never, text: "text", noteId: "note", target }).errors.length)
})
