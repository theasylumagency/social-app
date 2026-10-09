import { captureWeeklyApproval } from "../src/application/weekly-planning/approval-evidence"
import assert from "node:assert/strict"
import test from "node:test"
import { randomUUID } from "node:crypto"
import type { Pool } from "pg"
import { socialDeliveryFixture } from "./social-delivery-fixture"
import { reviewFixture } from "./weekly-review-fixture"
import { subscribeFixture, strategicBrandFixture } from "./strategic-integration-fixture"
import { currentWeek } from "../src/application/dashboard/model"
import { approvePlanningRun, beginWeeklyPlanning, readPlanningView } from "../src/infrastructure/postgres/weekly-planning-store"
import { readPlanningStatus } from "../src/infrastructure/postgres/weekly-planning-status"
import { readStrategyView } from "../src/infrastructure/postgres/social-strategy-store"
import { readPublicKnowledge, readPublicKnowledgeView, savePublicFact, PublicKnowledgeConflict, type SavePublicFact } from "../src/infrastructure/postgres/public-knowledge-store"
import { publicKnowledgeContext } from "../src/blueprints/social/public-knowledge"
import { scheduleApprovedPost } from "../src/application/publishing/schedule-approved-post"
import { PostgresSocialPublicationStore } from "../src/infrastructure/postgres/social-publication-store"
import { PostgresSocialPublishStore } from "../src/infrastructure/postgres/social-publish-store"
import { readDeliveryRecords } from "../src/infrastructure/postgres/delivery-view-store"
import { deliveryItem } from "../src/application/publishing/delivery-view"
import { createZernioPublisher } from "../src/infrastructure/zernio/publisher"
import { SOCIAL_CONTENT_MODES } from "../src/blueprints/social/tokens"
import type { PlanningRun } from "../src/blueprints/social/weekly-planning/model"
import type { PostsBatch } from "../src/blueprints/social/weekly-planning/posts"
import type { SocialContentPublisherInput } from "../src/blueprints/social"

function input(brandId = "brand"): SavePublicFact {
  return { requestId: randomUUID(), brandId, id: randomUUID(), revision: 0, kind: "price", subject: "Consultation", statement: "Consultation costs 50 GEL.", permission: "publicUse", validUntil: new Date(Date.now()+86400000).toISOString(), confirmed: true }
}
async function source(pool: Pool, brandId: string, id = "evidence") {
  await pool.query("INSERT INTO sources(id,brand_id,kind,reference,created_at) VALUES($1,$2,'manual','{}',now())", [`source:${id}`, brandId])
  await pool.query("INSERT INTO source_snapshots(id,source_id,brand_id,captured_at,content_hash,content) VALUES($1,$2,$3,now(),'hash','{}')", [`snapshot:${id}`, `source:${id}`, brandId])
  await pool.query("INSERT INTO evidence(id,brand_id,snapshot_id,type,source_claim_mode,value,evidence_strength,excerpt) VALUES($1,$2,$3,'observation','explicit','{}','medium','Consultation costs 50 GEL. Terms apply.')", [id, brandId, `snapshot:${id}`])
}
async function ready(pool: Pool, factInput: SavePublicFact) {
  const knowledge = (await savePublicFact(pool, "owner", factInput)).snapshot
  const now = new Date().toISOString(), week = currentWeek()
  const run = { id: randomUUID(), brandId: factInput.brandId, ownerId: "owner", week, version: 1, status: "approved", step: "ready", error: null, leaseUntil: null, createdAt: now, updatedAt: now,
    payload: { publicKnowledge: knowledge, basis: { sessionId: "basis", revision: 1, payload: { input: { language: "ka" } } }, plan: { id: "plan", state: "approved", contentDirections: [{ id: "direction", audienceDirection: { primaryAudience: { source: "brand", id: "audience" }, secondaryAudiences: [], bias: "balanced" } }] } } } as unknown as PlanningRun
  const post = { contentMode: SOCIAL_CONTENT_MODES.educational, factKeys: [factInput.id], directionKey: "d1", dayOffset: 0, title: "Price", why: "Inform readers", format: "text", channels: [{ channel: "facebook", reason: "Text" }], brief: { job: "Explain price", takeaway: "Current price", points: ["Price", "Conditions"], mustNotSay: ["Unsupported promise"] }, visual: { kind: "none", description: "", aspectRatio: "none", frames: [] } }
  const posts = { runId: run.id, status: "ready", step: "ready", approvedAt: now, approvedByUserId: "owner", updatedAt: now, error: null, leaseUntil: null,
    payload: { outline: { summary: "Summary", cadenceReason: "Reason", channelReason: "Reason", posts: [post] }, copies: { p1: { variants: [{ channel: "facebook", caption: factInput.statement, frames: [], script: "", onScreenText: [] }], factualReferences: { factKeys: [factInput.id], proofKeys: knowledge.proofs.map(p => p.key) } } }, review: { summary: "Fixture review", issues: [] }, repairs: 0 } } as unknown as PostsBatch
  posts.payload.reviewEvidence = reviewFixture(run, posts.payload, now)
  posts.approvalEvidence = captureWeeklyApproval(run, posts.payload, "owner", now)
  await pool.query("INSERT INTO weekly_planning_runs(id,owner_user_id,brand_id,week_start,version,status,step,payload) VALUES($1,'owner',$2,$3,1,'approved','ready',$4::jsonb)", [run.id, run.brandId, week, JSON.stringify(run.payload)])
  await pool.query("INSERT INTO weekly_post_batches(run_id,status,step,payload,approved_at,approved_by_user_id,approval_evidence) VALUES($1,'ready','ready',$2::jsonb,$3,'owner',$4::jsonb)", [run.id, JSON.stringify(posts.payload), now, JSON.stringify(posts.approvalEvidence)])
  const store = new PostgresSocialPublicationStore(pool), publishAt = new Date(Date.parse(now)+1000).toISOString()
  const schedule = () => scheduleApprovedPost({ ownerId: "owner", actorId: "owner", run, posts, assets: [], postKey: "p1", destinations: [{ channel: "facebook", publishingAccountId: "account", publishAt, contentMode: SOCIAL_CONTENT_MODES.educational }], now }, store)
  return { run, posts, store, schedule, publishAt }
}
test("registry writes are owned, idempotent, conflict checked and preserve earlier snapshots", async t => {
  const { pool } = await socialDeliveryFixture(t), first = input()
  await assert.rejects(savePublicFact(pool, "other", first))
  await assert.rejects(savePublicFact(pool, "owner", { ...first, confirmed: false }))
  const view = await savePublicFact(pool, "owner", first)
  assert.equal(view.snapshot.facts[0]!.fact.provenance[0]!.kind, "founderDecision")
  assert.equal((await savePublicFact(pool, "owner", first)).snapshot.revision, 1)
  await assert.rejects(savePublicFact(pool, "owner", { ...first, statement: "Consultation costs 60 GEL." }), PublicKnowledgeConflict)
  const changes = await Promise.allSettled([50, 60].map(price => savePublicFact(pool, "owner", { ...first, requestId: randomUUID(), revision: 1, statement: `Consultation costs ${price} GEL.` })))
  assert.equal(changes.filter(c => c.status === "fulfilled").length, 1)
  assert.equal(changes.filter(c => c.status === "rejected").length, 1)
  assert.equal(view.snapshot.facts[0]!.revision, 1)
  assert.equal((await readPublicKnowledge(pool, "brand")).facts[0]!.revision, 2)
  await assert.rejects(savePublicFact(pool, "owner", { ...input(), subject: " Consultation " }), PublicKnowledgeConflict)
  assert.equal((await pool.query("SELECT count(*)::int n FROM brand_public_knowledge_events")).rows[0].n, 2)
})
test("proof needs exact owned source support and explicit public permission", async t => {
  const { pool } = await socialDeliveryFixture(t)
  await source(pool, "brand")
  const first = { ...input(), permission: "publicUseWithProof" as const, evidenceId: "evidence", sourcePublicConfirmed: false }
  await assert.rejects(savePublicFact(pool, "owner", first))
  await assert.rejects(savePublicFact(pool, "owner", { ...first, sourcePublicConfirmed: true, statement: "Consultation costs 25 GEL." }))
  await assert.rejects(savePublicFact(pool, "owner", { ...first, sourcePublicConfirmed: true, evidenceId: "missing" }))
  const view = await savePublicFact(pool, "owner", { ...first, sourcePublicConfirmed: true })
  assert.equal(publicKnowledgeContext(view.snapshot).eligibleProof.length, 1)
  assert.equal(view.snapshot.proofs[0]!.source.snapshotId, "snapshot:evidence")
  assert.equal(view.snapshot.proofs[0]!.assessment.policyVersion, "owner-verbatim-source-v1")
  const changed = await savePublicFact(pool, "owner", { ...first, requestId: randomUUID(), revision: 1, permission: "internalGuidance" })
  assert.deepEqual(publicKnowledgeContext(changed.snapshot).publicFacts, [])
  assert.equal(changed.snapshot.proofs.length, 0)
  assert.equal((await pool.query("SELECT count(*)::int n FROM brand_public_proofs")).rows[0].n, 1)
})
test("new plans capture confirmed registry facts while discovery grants none automatically", async t => {
  const { pool } = await socialDeliveryFixture(t)
  await subscribeFixture(pool, "owner")
  const brandId = await strategicBrandFixture(pool)
  assert.equal((await readPublicKnowledgeView(pool, "owner", brandId)).snapshot.facts.length, 0)
  const first = input(brandId); await savePublicFact(pool, "owner", first)
  const run = await beginWeeklyPlanning(pool, "owner", { id: randomUUID(), brandId, week: currentWeek(), priority: "" })
  const before = await readPlanningStatus(pool, "owner", brandId, currentWeek())
  assert.equal(run.payload.publicKnowledge?.facts[0]!.statement, first.statement)
  await savePublicFact(pool, "owner", { ...first, requestId: randomUUID(), revision: 1, statement: "Consultation costs 60 GEL." })
  assert.notEqual((await readPlanningStatus(pool, "owner", brandId, currentWeek()))!.revision, before!.revision)
  assert.equal(run.payload.publicKnowledge?.facts[0]!.statement, "Consultation costs 50 GEL.")
})
test("approval rechecks changed authority even on an already approved run", async t => {
  const { pool } = await socialDeliveryFixture(t)
  await subscribeFixture(pool, "owner")
  const brandId = await strategicBrandFixture(pool), first = input(brandId), fixture = await ready(pool, first)
  fixture.run.payload.socialStrategy = (await readStrategyView(pool, "owner", brandId)).active!
  await pool.query("UPDATE weekly_planning_runs SET payload=$2::jsonb WHERE id=$1", [fixture.run.id, JSON.stringify(fixture.run.payload)])
  await approvePlanningRun(pool, "owner", fixture.run.id, fixture.run.version)
  await savePublicFact(pool, "owner", { ...first, requestId: randomUUID(), revision: 1, statement: "Consultation costs 60 GEL." })
  await assert.rejects(approvePlanningRun(pool, "owner", fixture.run.id, fixture.run.version), /ფაქტი შეიცვალა/)
  const view = await readPlanningView(pool, "owner", brandId, currentWeek())
  assert.equal(view.stale, true)
  assert.match(view.factualBlocker!, /ფაქტი შეიცვალა/)
})
test("proof-backed publication carries its real source identity into the canonical brief", async t => {
  const { pool } = await socialDeliveryFixture(t)
  await source(pool, "brand")
  const first = { ...input(), permission: "publicUseWithProof" as const, evidenceId: "evidence", sourcePublicConfirmed: true }
  const fixture = await ready(pool, first)
  await fixture.schedule()
  const due = (await fixture.store.claimDue(fixture.publishAt, 3))[0]!
  assert.equal(due.bundle.contentBrief.evidenceMode, "proofRequired")
  assert.deepEqual(due.bundle.contentBrief.evidenceIds, ["evidence"])
  assert.ok("weeklyReview" in due.bundle && due.bundle.weeklyReview.publicKnowledge?.proofs[0]!.source.snapshotId === "snapshot:evidence")
})
test("changed facts block scheduling and expiry holds due publication with a visible reason", async t => {
  const { pool } = await socialDeliveryFixture(t), first = input()
  const fixture = await ready(pool, first)
  await fixture.schedule()
  const afterExpiry = new Date(Date.parse(first.validUntil)+1).toISOString()
  assert.deepEqual(await fixture.store.claimDue(afterExpiry, 3), [])
  assert.equal((await pool.query("SELECT count(*)::int n FROM social_publication_fact_holds")).rows[0].n, 1)
  assert.deepEqual(await fixture.store.claimDue(afterExpiry, 3), [])
  await savePublicFact(pool, "owner", { ...first, requestId: randomUUID(), revision: 1, statement: "Consultation costs 60 GEL." })
  await assert.rejects(fixture.schedule(), /ფაქტი შეიცვალა/)
  const record = (await readDeliveryRecords(pool, { ownerId: "owner", brandId: "brand" }))[0]!
  assert.equal(deliveryItem(record, { enabled: true, maxAttempts: 3, graceMs: 60000 }, afterExpiry).state, "factBlocked")
  assert.ok(record.factualBlocker)
  assert.equal((await pool.query("SELECT count(*)::int n FROM social_publish_attempts")).rows[0].n, 0)
})
test("fact withdrawal during media preparation blocks the final provider dispatch", async t => {
  const { pool } = await socialDeliveryFixture(t), first = input(), fixture = await ready(pool, first)
  await fixture.schedule()
  const due = (await fixture.store.claimDue(fixture.publishAt, 3))[0]!
  const journal = new PostgresSocialPublishStore(pool)
  const attempt = { id: due.attemptId, idempotencyKey: randomUUID(), attemptNumber: 1, contentId: due.schedule.contentId, draftId: due.schedule.draftId, draftVersion: due.schedule.draftVersion, scheduleId: due.schedule.id, scheduleRevision: 0, publishingAccountId: due.publishingAccountId, channel: due.schedule.channel, publishAt: due.schedule.publishAt, attemptedAt: fixture.publishAt } as SocialContentPublisherInput["attempt"]
  assert.deepEqual(await journal.claimAttempt(attempt), { status: "acquired" })
  let networkCalls = 0
  const publisher = createZernioPublisher({ journal, client: { async request() { networkCalls++; throw Error("Unexpected dispatch") } } as never,
    assets: { async load() { await savePublicFact(pool, "owner", { ...first, requestId: randomUUID(), revision: 1, permission: "blocked" }); return [] } }, media: { async upload() { throw Error("Unexpected media") } } as never,
    now: () => new Date().toISOString() as never })
  assert.deepEqual(await publisher({ attempt, draft: due.bundle.draft, contentExecutionSpec: due.bundle.contentExecutionSpec, publishingAccount: due.publishingAccount }), { status: "permanentFailure", errorCode: "publicFactsChanged" })
  assert.equal(networkCalls, 0)
  assert.equal((await journal.loadRequest(attempt.id))!.state, "readyToDispatch")
  assert.equal((await pool.query("SELECT dispatch_started_at FROM social_provider_publish_requests WHERE attempt_id=$1", [attempt.id])).rows[0].dispatch_started_at, null)
  assert.equal((await pool.query("SELECT count(*)::int n FROM social_publication_fact_holds")).rows[0].n, 1)
})
