import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import test from "node:test"
import { socialDeliveryFixture } from "./social-delivery-fixture"
import { approvedPublicationFixture } from "./publication-bundle-fixture"
import { scheduleApprovedPost } from "../src/application/publishing/schedule-approved-post"
import { PostgresSocialPublicationStore } from "../src/infrastructure/postgres/social-publication-store"
import { SOCIAL_CONTENT_MODES } from "../src/blueprints/social/tokens"
import { cancelSocialContentSchedule, rescheduleSocialContent } from "../src/blueprints/social/content-schedule-lifecycle"
import { createIsoDateTime } from "../src/core/domain/primitives"
import type { PlanningRun } from "../src/blueprints/social/weekly-planning/model"
import type { PostsBatch } from "../src/blueprints/social/weekly-planning/posts"

test("approved weekly post fans out to independent canonical-account schedules with lifecycle events", async (t) => {
  const { pool } = await socialDeliveryFixture(t)
  await pool.query(`INSERT INTO social_publishing_accounts(id,brand_id,channel,native_account_ref,display_name)
    VALUES('instagram-account','brand','instagram','native-instagram','Instagram')`)
  await pool.query(`INSERT INTO social_provider_account_bindings(id,publishing_account_id,brand_id,channel,provider,provider_profile_ref,
    provider_account_ref,connection_status,can_publish,can_fetch_analytics,capabilities,connected_at)
    VALUES('instagram-binding','instagram-account','brand','instagram','zernio','provider-profile','provider-instagram','connected',true,true,'{"publish":true,"analytics":true}',now())`)
  const fixture = approvedPublicationFixture()
  const createdAt = "2026-09-09T10:00:00.000Z"
  const planning = { id: fixture.sourceWeeklyRunId, ownerId: "owner", brandId: "brand", week: "2026-09-07", version: 1,
    status: "approved", step: "ready", error: null, leaseUntil: null, createdAt, updatedAt: createdAt,
    payload: { basis: { payload: { input: { language: "ka" } } }, plan: { id: "weekly-plan", state: "approved",
      contentDirections: [{ id: "direction", audienceDirection: { primaryAudience: { source: "brand", id: "audience" }, secondaryAudiences: [], bias: "balanced" } }] } } } as unknown as PlanningRun
  const post = { directionKey: "d1", dayOffset: 1, title: "Post", why: "A useful reason", format: "image",
    channels: [{ channel: "facebook", reason: "Facebook fit" }, { channel: "instagram", reason: "Instagram fit" }],
    brief: { job: "Explain", takeaway: "A clear takeaway", points: ["First point", "Second point"], mustNotSay: ["Unsupported"] },
    visual: { kind: "photo", description: "Product image", aspectRatio: "1:1", frames: ["Product"] } }
  const posts = { runId: planning.id, status: "ready", step: "ready", error: null, leaseUntil: null, approvedAt: createdAt,
    approvedByUserId: "owner", updatedAt: createdAt, payload: { outline: { summary: "Summary", cadenceReason: "Reason", channelReason: "Reason", posts: [post] },
      copies: { p1: { variants: [{ channel: "facebook", caption: "Facebook copy", frames: [], script: "", onScreenText: [] },
        { channel: "instagram", caption: "Instagram copy", frames: [], script: "", onScreenText: [] }] } }, review: { summary: "Approved", issues: [] }, repairs: 0 } } as unknown as PostsBatch
  const approvedPosts = posts
  await pool.query(`INSERT INTO weekly_planning_runs(id,owner_user_id,brand_id,week_start,version,status,step,payload)
    VALUES($1,'owner','brand','2026-09-07',1,'approved','ready',$2::jsonb)`, [planning.id, JSON.stringify(planning.payload)])
  await pool.query(`INSERT INTO weekly_post_batches(run_id,status,step,payload,approved_at,approved_by_user_id)
    VALUES($1,'ready','ready',$2::jsonb,$3,'owner')`, [planning.id, JSON.stringify(posts.payload), createdAt])
  const assetId = randomUUID()
  await pool.query(`INSERT INTO weekly_post_assets(id,run_id,post_key,slot,name,width,height,content)
    VALUES($1,$2,'p1',0,'image.webp',10,10,$3)`, [assetId, planning.id, Buffer.from("image")])
  const store = new PostgresSocialPublicationStore(pool)
  const schedules = await scheduleApprovedPost({ ownerId: "owner", actorId: "owner", run: planning, posts: approvedPosts,
    assets: [{ id: assetId, postKey: "p1", slot: 0, width: 10, height: 10, name: "image.webp" }], postKey: "p1",
    destinations: [{ channel: "facebook", publishingAccountId: "account", publishAt: "2026-09-09T11:00:00.000Z", contentMode: SOCIAL_CONTENT_MODES.educational },
      { channel: "instagram", publishingAccountId: "instagram-account", publishAt: "2026-09-09T11:05:00.000Z", contentMode: SOCIAL_CONTENT_MODES.educational }], now: createdAt }, store)
  assert.equal(schedules.length, 2)
  assert.equal(new Set(schedules.map((item) => item.schedule.id)).size, 2)
  assert.deepEqual(new Set(schedules.map((item) => item.publishingAccountId)), new Set(["account", "instagram-account"]))
  assert.equal((await pool.query("SELECT count(*)::int n FROM social_provider_publish_requests")).rows[0].n, 0)

  const first = schedules[0]!
  const changed = rescheduleSocialContent({ id: `event:${randomUUID()}` as never, schedule: first.schedule, currentState: first.lifecycle,
    publishAt: createIsoDateTime("2026-09-09T11:30:00.000Z"), changedBy: "owner" as never,
    changedAt: createIsoDateTime("2026-09-09T10:05:00.000Z") })
  await store.appendScheduleEvent({ ownerId: "owner", brandId: "brand" }, changed.event)
  const cancelled = cancelSocialContentSchedule({ id: `event:${randomUUID()}` as never, schedule: first.schedule, currentState: changed.state,
    reason: "Changed plan", changedBy: "owner" as never, changedAt: createIsoDateTime("2026-09-09T10:06:00.000Z") })
  await store.appendScheduleEvent({ ownerId: "owner", brandId: "brand" }, cancelled.event)
  const loaded = (await store.listSchedules({ ownerId: "owner", brandId: "brand", sourceRunId: planning.id })).find((item) => item.schedule.id === first.schedule.id)
  assert.equal(loaded?.lifecycle.status, "cancelled")
  assert.equal(loaded?.lifecycle.revision, 2)
})

test("scheduling rejects missing media and invalid exact times", async (t) => {
  const { pool } = await socialDeliveryFixture(t)
  const store = new PostgresSocialPublicationStore(pool)
  const fixture = approvedPublicationFixture()
  const planning = { id: fixture.sourceWeeklyRunId, brandId: "brand", status: "approved", payload: { plan: { state: "approved" } } } as unknown as PlanningRun
  const posts = { status: "ready", approvedAt: "2026-09-09T10:00:00.000Z", approvedByUserId: "owner", payload: { outline: { posts: [{ format: "image", visual: { frames: [{}] } }] } } } as unknown as PostsBatch
  await assert.rejects(scheduleApprovedPost({ ownerId: "owner", actorId: "owner", run: planning, posts, assets: [], postKey: "p1",
    destinations: [{ channel: "facebook", publishingAccountId: "account", publishAt: "2026-09-09T09:00:00.000Z", contentMode: SOCIAL_CONTENT_MODES.educational }],
    now: "2026-09-09T10:00:00.000Z" }, store))
})
