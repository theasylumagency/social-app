import type { PostsReview } from "./posts"
import type { PostEditorialReview } from "./post-editorial"

/** Actual model results and content identities, never a substitute claim-scanner audit. */
export type HistoricalWeeklyPostReviewEvidence = {
  version: 1
  runId: string
  runVersion: number
  reviewedAt: string
  contextDigest: string
  postDigests: Record<string, string>
  publicKnowledge?: import("../public-knowledge").PublicKnowledgeSnapshot
  safety: Pick<PostsReview, "summary" | "issues">
  editorial: PostEditorialReview
  modelRuns: { id: string; step: "post_review" | "post_editorial"; model: string; promptVersion: string; inputHash: string }[]
}
export type WeeklyReviewContext = {
  basisId: string; basisRevision: number; language: "ka" | "en"
  operatingRules: import("../../../core/domain/operating-policy").OperatingRule[]
}
export type WeeklyPostReviewEvidence = HistoricalWeeklyPostReviewEvidence | (Omit<HistoricalWeeklyPostReviewEvidence, "version"> & {
  version: 2; policyVersion: "weekly-review-v2"; context: WeeklyReviewContext
  postModes: Record<string, import("../tokens").SocialContentMode>
  deterministicIssues: PostsReview["issues"]; repairCount: number; batchDigest: string
})
export type WeeklyApprovalEvidence = {
  version: 1; id: string; actorId: string; approvedAt: string; runId: string; runVersion: number
  reviewDigest: string; batchDigest: string
}
