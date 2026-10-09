import { randomUUID } from "node:crypto"
import type { PlanningRun } from "../../blueprints/social/weekly-planning/model"
import type { PostsBatch, PostsPayload } from "../../blueprints/social/weekly-planning/posts"
import type { WeeklyApprovalEvidence } from "../../blueprints/social/weekly-planning/review-evidence"
import { assertCurrentWeeklyReview, reviewDigest } from "./review-evidence"
export const weeklyBatchDigest = (payload: PostsPayload) => reviewDigest({ outline: payload.outline, copies: payload.copies })
export function captureWeeklyApproval(run: PlanningRun, payload: PostsPayload, actorId: string, approvedAt: string): WeeklyApprovalEvidence {
  const evidence = assertCurrentWeeklyReview(run, payload)
  if (!actorId || !Number.isFinite(Date.parse(approvedAt)) || Date.parse(approvedAt) < Date.parse(evidence.reviewedAt)) throw Error("Approval predates reviewed content")
  return { version: 1, id: randomUUID(), actorId, approvedAt, runId: run.id, runVersion: run.version, reviewDigest: reviewDigest(evidence), batchDigest: weeklyBatchDigest(payload) }
}
export function assertCurrentWeeklyApproval(run: PlanningRun, posts: PostsBatch) {
  const evidence = assertCurrentWeeklyReview(run, posts.payload), a = posts.approvalEvidence
  if (!a || a.version !== 1 || !a.id || a.runId !== run.id || a.runVersion !== run.version || a.actorId !== posts.approvedByUserId || a.approvedAt !== posts.approvedAt
    || a.reviewDigest !== reviewDigest(evidence) || a.batchDigest !== weeklyBatchDigest(posts.payload) || Date.parse(a.approvedAt) < Date.parse(evidence.reviewedAt)) throw Error("Content needs approval bound to its current review and modes")
  return a
}
