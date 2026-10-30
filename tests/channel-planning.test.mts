import assert from "node:assert/strict"
import test from "node:test"
import { createChannelPlan, channelPlanningContext } from "../src/application/weekly-planning/channel-plan"
import { createPostSchedule, writePost } from "../src/application/weekly-planning/posts"
import { CHANNEL_PLAN_SCHEMA, validateChannelPlan, validateChannelExecutions, type WeeklyChannelPlan } from "../src/blueprints/social/weekly-planning/channel-plan"
import { emptyPosts, independentPostScheduleSchema, POST_SCHEDULE_SCHEMA, validatePostSchedule } from "../src/blueprints/social/weekly-planning/posts"
import { resizePostSchedule } from "../src/blueprints/social/weekly-planning/cadence"
import { validateSchema } from "../src/blueprints/social/brand-discovery/validation"
import type { BrandReasoner, BrandModelCall } from "../src/infrastructure/models/brand-reasoning"
import { completePlanningFixture, planningFixture } from "./weekly-planning-fixture"
import { scheduleFixture, copyFixture } from "./weekly-posts-fixture"

const channelPlan = (): WeeklyChannelPlan => ({ channels: [
  { channel: "facebook", count: 1, role: "ნივთის მფლობელის კითხვის განხილვა", reason: "ერთი ამბავი კვირის მიზანს ემსახურება", omissionReason: null },
  { channel: "instagram", count: 1, role: "შეფასების გზის ვიზუალურად ჩვენება", reason: "ერთი თვალსაჩინო მაგალითი", omissionReason: null },
] })
const constraints = { allowed: ["facebook", "instagram"] as const, requested: null, retained: { facebook: 0, instagram: 0 } }
const mockReasoner = (respond: (call: BrandModelCall) => unknown): BrandReasoner => async <T,>(call: BrandModelCall) => {
  const value = respond(call)
  assert.deepEqual(validateSchema(value, call.schema), [])
  assert.deepEqual(call.validate?.(value) ?? [], [])
  return value as T
}
const noModel: BrandReasoner = async () => { throw Error("This decision must not call a model") }
function independentSchedule() {
  const outline = scheduleFixture(), post = outline.posts[0]!
  // One idea, two independently executable formats, including their own media requirements.
  outline.posts = [
    { ...post, channels: [post.channels[0]!], format: "text", visual: { kind: "none", description: "ვიზუალი საჭირო არ არის", aspectRatio: "none", frames: [] } },
    { ...structuredClone(post), channels: [post.channels[1]!], format: "carousel", visual: { kind: "slides", description: "კითხვა და ორი ხედი", aspectRatio: "4:5", frames: ["კითხვა", "დეტალი"] } },
  ]
  return outline
}

test("channel decisions cannot silently omit Facebook, duplicate channels or leave a zero unexplained", () => {
  assert.deepEqual(validateSchema(channelPlan(), CHANNEL_PLAN_SCHEMA), [])
  assert.deepEqual(validateChannelPlan(channelPlan(), constraints), [])
  assert.ok(validateChannelPlan({ channels: [channelPlan().channels[1]!] }, constraints).length)
  assert.ok(validateChannelPlan({ channels: [channelPlan().channels[1]!, channelPlan().channels[1]!] }, constraints).length)
  const zero = channelPlan(); zero.channels[0]!.count = 0
  for (const reason of [null, "", "   "]) {
    zero.channels[0]!.omissionReason = reason
    assert.ok(validateChannelPlan(zero, constraints).length)
  }
  zero.channels[0]!.omissionReason = "თქვენი მითითებით ამ კვირის კამპანია მხოლოდ Instagram-ზე ტარდება."
  assert.deepEqual(validateChannelPlan(zero, constraints), [])
  for (const count of [-1, 1.5, 6, NaN]) {
    const bad = channelPlan(); bad.channels[0]!.count = count
    assert.ok(validateChannelPlan(bad, constraints).length)
  }
  assert.ok(validateChannelPlan(channelPlan(), { ...constraints, allowed: ["instagram"] }).length)
  assert.ok(validateChannelPlan(channelPlan(), { ...constraints, requested: { facebook: 2, instagram: 1 } }).length)
  assert.ok(validateChannelPlan(channelPlan(), { ...constraints, retained: { facebook: 2, instagram: 0 } }).length)
})

test("channel planning accounts for remaining dates and respects explicit counts without a model", async () => {
  const run = await completePlanningFixture(await planningFixture())
  run.week = "2026-10-26"; run.payload.plannedOn = "2026-10-30"
  assert.equal(channelPlanningContext(run).remainingDays, 3)
  const planned = await createChannelPlan(run, mockReasoner(call => {
    assert.equal(call.step, "post_channel_plan")
    const input = call.input as ReturnType<typeof channelPlanningContext>
    assert.deepEqual(input.channels.map(c => c.channel), ["facebook", "instagram"])
    assert.equal(input.remainingDays, 3)
    assert.equal(input.weeklyObjective, run.payload.objective!.objective)
    return channelPlan()
  }))
  assert.deepEqual(planned, channelPlan())
  run.payload.cadence = { facebook: 2, instagram: 0 }
  const fixed = await createChannelPlan(run, noModel)
  assert.deepEqual(fixed.channels.map(c => c.count), [2, 0])
  assert.ok(fixed.channels[1]!.omissionReason)
  run.payload.cadence = { facebook: 0, instagram: 0 }
  const paused = await createChannelPlan(run, noModel)
  const outline = await createPostSchedule(run, noModel, { ...emptyPosts(), channelPlan: paused })
  assert.deepEqual(outline.posts, [])
  delete run.payload.cadence
  run.payload.socialStrategy!.payload.proposal!.channels.forEach(c => { c.action = "doNotUse" })
  const disabled = await createChannelPlan(run, noModel)
  assert.deepEqual(disabled.channels.map(c => c.count), [0, 0])
})

test("a shared idea can have a Facebook story and an Instagram carousel; quotas and same-channel duplication stay enforced", async () => {
  const run = await completePlanningFixture(await planningFixture()), outline = independentSchedule()
  assert.deepEqual(validatePostSchedule(outline, ["d1"]), [])
  assert.deepEqual(validateChannelExecutions(outline.posts, outline.posts, channelPlan()), [])
  const shared = scheduleFixture()
  assert.deepEqual(validateSchema(shared, POST_SCHEDULE_SCHEMA), [], "legacy schedules remain readable")
  assert.ok(validateSchema(shared, independentPostScheduleSchema()).length)
  assert.ok(validateChannelExecutions(shared.posts, shared.posts, channelPlan()).some(e => e.includes("exactly one")))
  const scheduled = await createPostSchedule(run, mockReasoner(call => {
    const missingFacebook = { ...outline, posts: outline.posts.slice(1) }
    assert.ok(call.validate!(missingFacebook).some(e => e.includes("counts")))
    return outline
  }), { ...emptyPosts(), channelPlan: channelPlan() })
  assert.deepEqual(scheduled.posts.map(p => p.format), ["text", "carousel"])
  const repeated = structuredClone(outline); repeated.posts.push({ ...repeated.posts[1]! })
  assert.ok(validatePostSchedule(repeated, ["d1"]).some(e => e.includes("Duplicate post job")))
  await writePost(run, { ...emptyPosts(), channelPlan: channelPlan(), outline }, "p1", mockReasoner(call => {
    const input = call.input as { siblingJobs: unknown[]; channelRoles: WeeklyChannelPlan["channels"] }
    assert.deepEqual(input.siblingJobs, [], "cross-channel counterpart must not force a different central idea")
    assert.deepEqual(input.channelRoles.map(c => c.channel), ["facebook"])
    return { variants: [copyFixture().variants[0]!] }
  }))
})

test("cadence revisions preserve independent executions and copy while updating the channel explanation", () => {
  const source = { ...emptyPosts(), channelPlan: channelPlan(), outline: independentSchedule(), copies: { p1: { variants: [copyFixture().variants[0]!] } } }
  const revised = resizePostSchedule(source, { facebook: 1, instagram: 0 })
  assert.deepEqual(revised.payload.outline!.posts, source.outline.posts.slice(0, 1))
  assert.deepEqual(revised.payload.copies.p1, source.copies.p1)
  assert.deepEqual(revised.payload.channelPlan!.channels.map(c => c.count), [1, 0])
  assert.ok(revised.payload.channelPlan!.channels[1]!.omissionReason)
  assert.equal(revised.payload.channelPlan!.channels[0]!.role, source.channelPlan.channels[0]!.role)
  const grown = resizePostSchedule(revised.payload, { facebook: 1, instagram: 2 })
  assert.equal(grown.needsAdditions, true)
  assert.equal(grown.payload.channelPlan!.channels[1]!.omissionReason, null)
  assert.equal(source.channelPlan.channels[1]!.count, 1)
})
