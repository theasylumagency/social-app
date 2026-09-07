import assert from "node:assert/strict"
import test from "node:test"
import { readFileSync } from "node:fs"
import { compileBrandVoice } from "../src/blueprints/social/brand-voice"
import { BUSINESS_UNDERSTANDING_SCHEMA } from "../src/blueprints/social/brand-discovery/schemas"
import { validateSchema, validateUnderstanding } from "../src/blueprints/social/brand-discovery/validation"
import { compilePostGenerationContext, compilePostEditorialContext } from "../src/blueprints/social/weekly-planning/post-context"
import { POST_EDITORIAL_SCHEMA, consolidatePostReviews, validatePostEditorialReview, type PostEditorialReview } from "../src/blueprints/social/weekly-planning/post-editorial"
import { applyPostReview, type PostsPayload } from "../src/blueprints/social/weekly-planning/posts"
import { postsContext, writePost, reviewPosts } from "../src/application/weekly-planning/posts"
import type { BrandModelCall, BrandReasoner } from "../src/infrastructure/models/brand-reasoning"
import { completePlanningFixture, planningFixture } from "./weekly-planning-fixture"
import { understanding } from "./brand-discovery-fixture"
import { copyFixture, editorialFixture, scheduleFixture } from "./weekly-posts-fixture"
import { almostAnotherVoice, almostAnotherSources, almostAnotherPost, flattenedFragments } from "./fixtures/almost-another-voice"

async function distinctiveRun() {
  const run = await completePlanningFixture(await planningFixture())
  const basis = run.payload.basis.payload
  basis.understanding = { ...basis.understanding!, name: "Almost Another", summary: "პოლიტიკური ესეისტიკისა და სპეკულაციური ფიქციის ავტორული პროექტი", positioning: "პოლიტიკური ანალიზი და დამოუკიდებელი ნარატიული ფორმები", voice: structuredClone(almostAnotherVoice), constraints: [] }
  basis.sources = structuredClone(almostAnotherSources)
  run.payload.directions[0] = { direction: almostAnotherPost.brief.job, purpose: almostAnotherPost.brief.takeaway, rationale: "შრომა და პოლიტიკური ძალაუფლება" }
  return run
}
function flatteningReview(): PostEditorialReview {
  const review = editorialFixture(["p1"])
  review.posts[0]!.dimensions.find((d) => d.dimension === "brandFidelity")!.rating = "weak"
  review.posts[0]!.issues = [{ dimension: "brandFidelity", observedText: "neither outcome is predetermined...", basis: almostAnotherVoice.behaviors![0]!.instruction, repairInstruction: "Facebook-ის დასკვნაში აღადგინეთ მკვეთრი ინტერპრეტაციული თეზისი; გაურკვევლობა შეინარჩუნეთ კონკრეტულ შედეგთან, ფაქტების დამატების გარეშე." }]
  return review
}

test("fixture retains supplied source evidence and labels the incomplete failure sample honestly", () => {
  const report = readFileSync(new URL("../docs/ai/task01/Almost Another Brand Discovery output.md", import.meta.url), "utf8")
  const task = readFileSync(new URL("../docs/ai/task01/Astra Task — Brand Voice Fidelity.md", import.meta.url), "utf8")
  for (const ref of almostAnotherVoice.examples) assert.ok(report.includes(ref.exactExcerpt))
  for (const trait of almostAnotherVoice.traits) assert.ok(report.includes(trait))
  for (const fragment of flattenedFragments.variants[0]!.caption.split("\n\n")) assert.ok(task.includes(fragment))
})

test("voice behavior citations are validated and old/generic dossiers do not acquire fabricated intensity", () => {
  const voice = compileBrandVoice(almostAnotherVoice, almostAnotherSources)
  assert.equal(voice.behaviors.length, 2)
  assert.equal(voice.references.length, 2)
  assert.equal(voice.referenceUse, "styleOnly")
  assert.equal(voice.languageRules[0], almostAnotherVoice.principles[0])
  assert.deepEqual(validateSchema(understanding, BUSINESS_UNDERSTANDING_SCHEMA), [])
  const invalid = structuredClone(understanding)
  invalid.voice.behaviors = [{ ...almostAnotherVoice.behaviors![0]!, exactExcerpt: "This quotation is invented and absent from all sources." }]
  assert.ok(validateUnderstanding(invalid, almostAnotherSources).some((e) => e.includes("Unverifiable")))
  assert.deepEqual(compileBrandVoice(invalid.voice, almostAnotherSources).behaviors, [])
  const legacy = structuredClone(almostAnotherVoice); delete legacy.behaviors
  assert.equal(compileBrandVoice(legacy, almostAnotherSources).references.length, 2)
  assert.deepEqual(compileBrandVoice(legacy, almostAnotherSources).behaviors, [])
  const ordinary = compileBrandVoice(understanding.voice, [])
  assert.deepEqual(ordinary.behaviors, [])
  assert.deepEqual(ordinary.references, [])
  assert.deepEqual(ordinary.primaryTone, understanding.voice.traits)
})

test("post scope excludes unrelated goals/audiences and global communication jobs while retaining voice", async () => {
  const run = await distinctiveRun()
  const basis = run.payload.basis.payload
  const unrelated = { ...basis.hypotheses[0]!, id: "unrelated-audience" as typeof basis.hypotheses[number]["id"], name: "UNRELATED_AUDIENCE" }
  const entry = structuredClone(basis.landscape!.entries[0]!)
  if (entry.source !== "operator") throw Error("fixture must use operator audience")
  basis.landscape = { ...basis.landscape!, entries: [...basis.landscape!.entries, { ...entry, audience: unrelated }] }
  basis.profiles = [...basis.profiles, { ...basis.profiles[0]!, audience: { source: "operator", id: unrelated.id }, communicationGoal: "UNRELATED_PROFILE_JOB" }]
  basis.profiles[0] = { ...basis.profiles[0]!, communicationGoal: "ALWAYS_EXPLAIN_PROJECT" }
  basis.envelope = { ...basis.envelope!, rationale: "ALWAYS_EXPLAIN_ALL_FORMATS" }
  basis.goals.push({ ...basis.goals[0]!, id: "extra-goal", title: "UNRELATED_GOAL" })
  basis.feedback.selectedGoalIds!.push("extra-goal")
  const scoped = compilePostGenerationContext(run, almostAnotherPost)
  const serialized = JSON.stringify(scoped)
  for (const forbidden of ["UNRELATED_AUDIENCE", "UNRELATED_PROFILE_JOB", "ALWAYS_EXPLAIN_PROJECT", "ALWAYS_EXPLAIN_ALL_FORMATS", "UNRELATED_GOAL"]) assert.ok(!serialized.includes(forbidden), forbidden)
  assert.deepEqual(scoped.task.brief, almostAnotherPost.brief)
  assert.deepEqual(scoped.voice, compileBrandVoice(almostAnotherVoice, almostAnotherSources))
  assert.deepEqual(scoped.publicFacts, [])
  assert.deepEqual(scoped.eligibleProof, [])
  assert.equal(postsContext(run).selectedBrandGoals.length, 1)
  assert.equal(postsContext(run).audiences.length, 1)
  assert.equal(postsContext(run).communicationProfiles.length, 1)
  const editorial = compilePostEditorialContext(run, almostAnotherPost)
  for (const key of ["publicFacts", "eligibleProof", "evidenceSummary", "sources", "selectedBrandGoals", "constraints"]) assert.ok(!(key in editorial))
})

test("semantic flattening feedback needs actual draft text and a supplied brand expectation", async () => {
  const run = await distinctiveRun()
  const inputs = [{ postKey: "p1", draft: flattenedFragments, voice: compilePostGenerationContext(run, almostAnotherPost).voice }]
  const review = flatteningReview()
  assert.deepEqual(validateSchema(review, POST_EDITORIAL_SCHEMA), [])
  assert.deepEqual(validatePostEditorialReview(review, inputs), [])
  const bad = structuredClone(review)
  bad.posts[0]!.issues[0]!.basis = "Invent a confrontational identity"
  assert.ok(validatePostEditorialReview(bad, inputs).some((e) => e.includes("voice criterion")))
  bad.posts[0]!.issues[0]!.observedText = "This passage was never written"
  assert.ok(validatePostEditorialReview(bad, inputs).some((e) => e.includes("exact draft")))
  const missing = structuredClone(review); missing.posts[0]!.issues = []
  assert.ok(validatePostEditorialReview(missing, inputs).some((e) => e.includes("repair issue")))
  assert.ok(validatePostEditorialReview({ posts: [] }, inputs).length)
  assert.ok(validatePostEditorialReview({ posts: [review.posts[0]!, review.posts[0]!] }, inputs).length)
  const ordinaryInputs = [{ ...inputs[0]!, voice: compileBrandVoice(understanding.voice, []) }]
  assert.ok(validatePostEditorialReview(review, ordinaryInputs).some((e) => e.includes("voice criterion")))
  assert.deepEqual(validatePostEditorialReview(editorialFixture(["p1"]), ordinaryInputs), [])
})

test("Writer receives the compiled voice and consolidated repair, while safety and editorial calls stay separate", async () => {
  const run = await distinctiveRun()
  const payload: PostsPayload = { outline: { ...scheduleFixture(), posts: [almostAnotherPost] }, copies: { p1: flattenedFragments }, repairs: 0, review: null }
  const calls: BrandModelCall[] = []
  // A semantic reviewer test double: tests orchestration/contracts, not live-model quality.
  const reason: BrandReasoner = async <T,>(call: BrandModelCall) => {
    calls.push(call)
    const output = call.step === "post_editorial" ? flatteningReview() : call.step === "post_review" ? { summary: "ფაქტობრივი დარღვევა არ გამოვლენილა", issues: [] } : flattenedFragments
    assert.deepEqual(validateSchema(output, call.schema), [])
    assert.deepEqual(call.validate?.(output), [])
    return output as T
  }
  const reviewed = await reviewPosts(run, payload, reason)
  assert.deepEqual(calls.map((c) => c.step).sort(), ["post_editorial", "post_review"])
  assert.equal(reviewed.issues[0]!.severity, "blocking", "safety pass cannot hide material flattening")
  assert.equal(reviewed.editorial!.posts[0]!.dimensions[0]!.rating, "weak")
  const editorialInput = JSON.stringify(calls.find((c) => c.step === "post_editorial")!.input)
  assert.ok(!editorialInput.includes('"eligibleProof"'))
  assert.equal(applyPostReview(payload, reviewed), "writing")
  await writePost(run, payload, "p1", reason)
  const writer = calls.at(-1)!.input as Record<string, unknown>
  assert.deepEqual(writer.voice, compileBrandVoice(almostAnotherVoice, almostAnotherSources))
  assert.deepEqual(writer.previousDraft, flattenedFragments)
  assert.deepEqual(writer.reviewFeedback, reviewed.issues)
  for (const forbidden of ["weeklyOutline", "selectedBrandGoals", "communicationProfiles", "evidenceSummary", "priorPlans"]) assert.ok(!(forbidden in writer))
  payload.copies.p1 = flattenedFragments
  assert.equal(applyPostReview(payload, reviewed), "ready")
  assert.equal(payload.repairs, 1)
  assert.equal(payload.review!.issues[0]!.severity, "blocking", "unresolved quality remains an approval blocker")
})

test("consolidated repair preserves siblings and ordinary acceptable copy needs no automatic repair", () => {
  const payload: PostsPayload = { outline: scheduleFixture(), copies: { p1: flattenedFragments, p2: copyFixture() }, repairs: 0, review: null }
  const sibling = payload.copies.p2
  const review = consolidatePostReviews({ summary: "შესასწორებელია", issues: [{ postKey: "p1", severity: "blocking", message: "მაგალითი მონიშნეთ როგორც ინტერპრეტაცია" }] }, flatteningReview())
  assert.equal(review.issues.length, 2)
  assert.equal(applyPostReview(payload, review), "writing")
  assert.equal(payload.copies.p2, sibling)
  assert.deepEqual(payload.repairDrafts!.p1, flattenedFragments)
  assert.equal(payload.repairs, 1)
  const ordinary: PostsPayload = { outline: scheduleFixture(), copies: { p1: copyFixture() }, repairs: 0, review: null }
  assert.equal(applyPostReview(ordinary, consolidatePostReviews({ summary: "შემოწმებულია", issues: [] }, editorialFixture(["p1"]))), "ready")
  assert.equal(ordinary.repairs, 0)
})

test("failed editorial analysis cannot be silently converted into safety-only acceptance", async () => {
  const run = await distinctiveRun()
  const payload: PostsPayload = { outline: { ...scheduleFixture(), posts: [almostAnotherPost] }, copies: { p1: flattenedFragments }, repairs: 0, review: null }
  await assert.rejects(reviewPosts(run, payload, async <T,>(call: BrandModelCall) => {
    if (call.step === "post_editorial") throw Error("editorial unavailable")
    return { summary: "შემოწმებულია", issues: [] } as T
  }), /editorial unavailable/)
  assert.equal(payload.review, null)
})
