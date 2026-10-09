import type { PlanningRun } from "../src/blueprints/social/weekly-planning/model"
import type { PostsPayload } from "../src/blueprints/social/weekly-planning/posts"
import { POST_EDITORIAL_DIMENSIONS } from "../src/blueprints/social/weekly-planning/post-editorial"
import { captureWeeklyReview, reviewDigest } from "../src/application/weekly-planning/review-evidence"

/** Explicit mocked reviewer outputs for lineage tests; not a quality benchmark. */
export function reviewFixture(run: PlanningRun, payload: PostsPayload, reviewedAt: string) {
  return captureWeeklyReview(run, payload, { summary: "Fixture factual review", issues: [] }, {
    posts: payload.outline!.posts.map((_, i) => ({ postKey: `p${i + 1}`, dimensions: POST_EDITORIAL_DIMENSIONS.map(dimension => ({ dimension, rating: "acceptable", note: "Fixture reviewer assessment" })), issues: [] })),
  }, ["post_review", "post_editorial"].map(step => ({ id: `fixture-${step}`, step, model: "fixture", promptVersion: "fixture-v1", inputHash: reviewDigest({ step }), durationMs: 1, usage: {}, validationErrors: [] })), reviewedAt)
}
