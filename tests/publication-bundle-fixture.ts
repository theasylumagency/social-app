import { materializeApprovedPost } from "../src/application/publishing/materialize-approved-post"
import { SOCIAL_CONTENT_MODES } from "../src/blueprints/social/tokens"
import type { PlanningRun } from "../src/blueprints/social/weekly-planning/model"
import type { PostsBatch } from "../src/blueprints/social/weekly-planning/posts"

export function approvedPublicationFixture(channel: "facebook" | "instagram" = "facebook") {
  const createdAt = "2026-09-09T10:00:00.000Z"
  const run = { id: "11111111-1111-4111-8111-111111111111", ownerId: "owner", brandId: "brand", week: "2026-09-07", version: 1,
    status: "approved", step: "ready", error: null, leaseUntil: null, createdAt, updatedAt: createdAt,
    payload: { basis: { payload: { input: { language: "ka" } } }, plan: { id: "weekly-plan", state: "approved",
      contentDirections: [{ id: "direction", audienceDirection: { primaryAudience: { source: "brand", id: "audience" }, secondaryAudiences: [], bias: "balanced" } }] } } } as unknown as PlanningRun
  const posts = { runId: run.id, status: "ready", step: "ready", error: null, leaseUntil: null, approvedAt: createdAt,
    approvedByUserId: "owner", updatedAt: createdAt, payload: { outline: { summary: "Summary", cadenceReason: "Reason", channelReason: "Reason", posts: [{
      directionKey: "d1", dayOffset: 1, title: "Post", why: "A useful reason", format: "image",
      channels: [{ channel, reason: "This channel fits" }], brief: { job: "Explain", takeaway: "A clear takeaway",
        points: ["First point", "Second point"], mustNotSay: ["Unsupported claim"] },
      visual: { kind: "photo", description: "A real product image", aspectRatio: "1:1", frames: ["Product"] },
    }] }, copies: { p1: { variants: [{ channel, caption: "Approved caption", frames: [], script: "", onScreenText: [] }] } },
    review: { summary: "Approved", issues: [] }, repairs: 0 } } as unknown as PostsBatch
  return materializeApprovedPost({ run, posts, postKey: "p1", channel, contentMode: SOCIAL_CONTENT_MODES.educational })
}
