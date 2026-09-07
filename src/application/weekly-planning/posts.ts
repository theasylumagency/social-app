import type { PlanningRun } from "../../blueprints/social/weekly-planning/model"
import { compilePlanningContext } from "./advance"
import type { BrandReasoner } from "../../infrastructure/models/brand-reasoning"
import { POST_SCHEDULE_SCHEMA, POST_COPY_SCHEMA, POSTS_REVIEW_SCHEMA, validatePostSchedule, validatePostCopy, type PostSchedule, type PostCopy, type PostsPayload, type PostsReview } from "../../blueprints/social/weekly-planning/posts"
import { POST_SCHEDULE_PROMPT, POST_WRITER_PROMPT, POSTS_REVIEW_PROMPT } from "../../blueprints/social/weekly-planning/prompts/posts"
import { validatePlanningProse } from "../../blueprints/social/weekly-planning/validation"

export function postsContext(run: PlanningRun) {
  const context = compilePlanningContext(run)
  return { ...context, contentAudienceDirections: run.payload.adaptation, executionPolicy: { channelsAreRecommendations: true, publishingEnabled: false, imageGenerationEnabled: false, founderUploadAvailable: true, trialIncludesGeneration: false } }
}
function keys(run: PlanningRun) {
  const c = compilePlanningContext(run)
  return [...c.audiences.map((a) => a.audienceKey), ...c.selectedBrandGoals.map((g) => g.goalKey), ...c.contentDirections.map((d) => d.contentDirectionKey), ...Array.from({ length: 5 }, (_, i) => `p${i + 1}`)]
}
export async function createPostSchedule(run: PlanningRun, reason: BrandReasoner) {
  return reason<PostSchedule>({ step: "post_schedule", version: "founder-post-schedule-v1", prompt: POST_SCHEDULE_PROMPT, input: postsContext(run), schema: POST_SCHEDULE_SCHEMA, validate: (v) => [...validatePostSchedule(v as PostSchedule, run.payload.directions.map((_, i) => `d${i + 1}`)), ...validatePlanningProse(v, keys(run))] })
}
export async function writePost(run: PlanningRun, payload: PostsPayload, key: string, reason: BrandReasoner) {
  const post = payload.outline!.posts[Number(key.slice(1)) - 1]!
  return reason<PostCopy>({ step: `post_writer_${key}`, version: "founder-post-writer-v1", prompt: POST_WRITER_PROMPT, input: { ...postsContext(run), weeklyOutline: payload.outline, post, reviewFeedback: payload.review?.issues.filter((i) => i.postKey === key) ?? [] }, schema: POST_COPY_SCHEMA, validate: (v) => [...validatePostCopy(v as PostCopy, post), ...validatePlanningProse(v, keys(run))] })
}
export async function reviewPosts(run: PlanningRun, payload: PostsPayload, reason: BrandReasoner) {
  const postKeys = payload.outline!.posts.map((_, i) => `p${i + 1}`)
  return reason<PostsReview>({ step: "post_review", version: "founder-post-review-v1", prompt: POSTS_REVIEW_PROMPT, input: { ...postsContext(run), weeklyOutline: payload.outline, drafts: payload.copies }, schema: POSTS_REVIEW_SCHEMA, validate: (v) => [...((v as PostsReview).issues.some((i) => !postKeys.includes(i.postKey)) ? ["Unknown post key"] : []), ...validatePlanningProse(v, keys(run))] })
}
