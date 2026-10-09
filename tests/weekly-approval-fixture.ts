import { randomUUID } from "node:crypto"
import type { Pool } from "pg"
import type { PlanningRun } from "../src/blueprints/social/weekly-planning/model"
import type { PostsBatch } from "../src/blueprints/social/weekly-planning/posts"
import { SOCIAL_CONTENT_MODES } from "../src/blueprints/social/tokens"
import { captureWeeklyApproval } from "../src/application/weekly-planning/approval-evidence"
import { reviewFixture } from "./weekly-review-fixture"
import { scheduleApprovedPost } from "../src/application/publishing/schedule-approved-post"
import { PostgresSocialPublicationStore } from "../src/infrastructure/postgres/social-publication-store"

/** Complete mocked reviews for contract tests; this is not a model quality benchmark. */
export function weeklyApprovalFixture() {
  const now = new Date().toISOString()
  const run = { id: randomUUID(), version: 1, ownerId: "owner", brandId: "brand", week: "2026-10-05", status: "approved", step: "ready",
    error: null, leaseUntil: null, createdAt: now, updatedAt: now, payload: {
      basis: { sessionId: "basis", revision: 1, payload: { input: { language: "en" } } },
      plan: { id: "plan", state: "approved", contentDirections: [{ id: "direction", audienceDirection: {
        primaryAudience: { source: "brand", id: "audience" }, secondaryAudiences: [], bias: "balanced" } }] },
    } } as unknown as PlanningRun
  const posts = { runId: run.id, status: "ready", step: "ready", approvedAt: now, approvedByUserId: "owner", error: null, leaseUntil: null, updatedAt: now,
    payload: { outline: { summary: "Preparing a useful photo", cadenceReason: "One clear task", channelReason: "Readers can refer back",
      posts: [{ directionKey: "d1", dayOffset: 0, title: "Prepare the photo", why: "Help readers show a useful detail", format: "text",
        contentMode: SOCIAL_CONTENT_MODES.educational, factKeys: [], channels: [{ channel: "facebook", reason: "A practical checklist" }],
        brief: { job: "Explain photo preparation", takeaway: "Show both the whole item and the detail", points: ["Whole item", "Detail"], mustNotSay: ["Do not guarantee a result"] },
        visual: { kind: "none", aspectRatio: "none", description: "No visual is needed for this text checklist", frames: [] } }] },
      copies: { p1: { variants: [{ channel: "facebook", caption: "Photograph the whole item, then add a close view of the damaged detail.", frames: [], script: "", onScreenText: [] }] } },
      review: { summary: "Fixture review", issues: [] }, repairs: 0 } } as unknown as PostsBatch
  const renew = () => {
    const at = new Date().toISOString()
    posts.payload.reviewEvidence = reviewFixture(run, posts.payload, at)
    posts.approvedAt = at
    posts.approvalEvidence = captureWeeklyApproval(run, posts.payload, "owner", at)
  }
  renew()
  return { run, posts, renew, postKey: "p1", channel: "facebook" as const, contentMode: SOCIAL_CONTENT_MODES.educational }
}

export async function persistApprovalFixture(pool: Pool) {
  const fixture = weeklyApprovalFixture(), { run, posts } = fixture
  await pool.query(`INSERT INTO weekly_planning_runs(id,owner_user_id,brand_id,week_start,version,status,step,payload)
    VALUES($1,'owner','brand',$2,1,'approved','ready',$3::jsonb)`, [run.id, run.week, JSON.stringify(run.payload)])
  const persist = async () => {
    await pool.query(`INSERT INTO weekly_post_batches(run_id,status,step,payload,approved_at,approved_by_user_id,approval_evidence)
      VALUES($1,'ready','ready',$2::jsonb,$3,'owner',$4::jsonb) ON CONFLICT(run_id) DO UPDATE
      SET payload=excluded.payload,approved_at=excluded.approved_at,approval_evidence=excluded.approval_evidence`,
    [run.id, JSON.stringify(posts.payload), posts.approvedAt, JSON.stringify(posts.approvalEvidence)])
  }
  await persist()
  const store = new PostgresSocialPublicationStore(pool), publishAt = new Date(Date.now() + 10000).toISOString()
  const schedule = (replaceInputIds?: string[]) => scheduleApprovedPost({ ownerId: "owner", actorId: "owner", run, posts, assets: [], postKey: "p1",
    destinations: [{ channel: "facebook", publishingAccountId: "account", contentMode: posts.payload.outline!.posts[0]!.contentMode!, publishAt }],
    now: new Date().toISOString(), ...(replaceInputIds ? { replaceInputIds } : {}) }, store)
  return { ...fixture, store, persist, schedule, publishAt }
}
