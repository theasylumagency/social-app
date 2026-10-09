import { createHash } from "node:crypto"
import type { PlanningRun } from "../../blueprints/social/weekly-planning/model"
import type { PostCopy, PostOutline, PostsPayload, PostsReview } from "../../blueprints/social/weekly-planning/posts"
import type { PostEditorialReview } from "../../blueprints/social/weekly-planning/post-editorial"
import type { WeeklyPostReviewEvidence } from "../../blueprints/social/weekly-planning/review-evidence"
import type { BrandModelRun } from "../../infrastructure/models/brand-reasoning"
import { deterministicPostReviewIssues, weeklyReviewBlocker } from "./review-policy"

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical)
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => [k, canonical(v)]))
  return value
}
export const reviewDigest = (value: unknown) => createHash("sha256").update(JSON.stringify(canonical(value))).digest("hex")
export const reviewedPostDigest = (post: PostOutline, copy: PostCopy) => reviewDigest({ post, copy })
export function reviewContextSnapshot(run: PlanningRun, payload: PostsPayload) {
  return { basisId: run.payload.basis.sessionId, basisRevision: run.payload.basis.revision,
    language: run.payload.basis.payload.input.language, operatingRules: structuredClone(payload.operatingRules ?? run.payload.operatingRules ?? []) }
}
export function reviewContextDigest(run: PlanningRun, payload: PostsPayload) { return reviewDigest({ ...reviewContextSnapshot(run, payload), publicKnowledge: run.payload.publicKnowledge }) }
export function captureWeeklyReview(run: PlanningRun, payload: PostsPayload, safety: PostsReview, editorial: PostEditorialReview, runs: readonly BrandModelRun[], reviewedAt: string): WeeklyPostReviewEvidence {
  const modelRuns = (["post_review", "post_editorial"] as const).map(step => {
    const r = runs.findLast(r => r.step === step && r.validationErrors.length === 0)
    if (!r) throw Error("Missing successful review model run")
    return { id: r.id, step, model: r.model, promptVersion: r.promptVersion, inputHash: r.inputHash }
  })
  return { version: 2, policyVersion: "weekly-review-v2", context: reviewContextSnapshot(run, payload), repairCount: payload.repairs,
    deterministicIssues: deterministicPostReviewIssues(run, payload), batchDigest: reviewDigest({ outline: payload.outline, copies: payload.copies }),
    postModes: Object.fromEntries(payload.outline!.posts.map((post, i) => [`p${i + 1}`, post.contentMode!])),
    runId: run.id, runVersion: run.version, reviewedAt, contextDigest: reviewContextDigest(run, payload),
    ...(run.payload.publicKnowledge ? { publicKnowledge: structuredClone(run.payload.publicKnowledge) } : {}),
    postDigests: Object.fromEntries(payload.outline!.posts.map((post, i) => [`p${i + 1}`, reviewedPostDigest(post, payload.copies[`p${i + 1}`]!)])),
    safety: structuredClone({ summary: safety.summary, issues: safety.issues }), editorial: structuredClone(editorial), modelRuns }
}
export function assertCurrentWeeklyReview(run: PlanningRun, payload: PostsPayload, postKey?: string) {
  const evidence = payload.reviewEvidence
  const posts = payload.outline?.posts ?? [], keys = posts.map((_, i) => `p${i + 1}`)
  if (!evidence || evidence.version !== 2 || !keys.length || (postKey && !keys.includes(postKey)) || evidence.runId !== run.id || evidence.runVersion !== run.version || evidence.contextDigest !== reviewContextDigest(run, payload)
    || reviewDigest(evidence.publicKnowledge ?? null) !== reviewDigest(run.payload.publicKnowledge ?? null)
    || reviewDigest(evidence.context) !== reviewDigest(reviewContextSnapshot(run, payload)) || evidence.repairCount !== payload.repairs
    || evidence.batchDigest !== reviewDigest({ outline: payload.outline, copies: payload.copies })
    || Object.keys(evidence.postDigests).length !== keys.length || Object.keys(payload.copies).length !== keys.length
    || posts.some((post, i) => !payload.copies[keys[i]!] || evidence.postDigests[keys[i]!] !== reviewedPostDigest(post, payload.copies[keys[i]!]!) || evidence.postModes[keys[i]!] !== post.contentMode)) throw Error("Content needs a current factual and editorial review")
  if (weeklyReviewBlocker(evidence) || payload.review?.issues.some(i => i.severity === "blocking")
    || reviewDigest(deterministicPostReviewIssues(run, payload)) !== reviewDigest(evidence.deterministicIssues)) throw Error("Content review is blocking")
  return evidence
}
