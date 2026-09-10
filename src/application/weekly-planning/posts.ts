import { duplicateCopyIssues } from "../../blueprints/social/weekly-planning/duplicate-hygiene"
import { operatingChannels } from "../../blueprints/social/strategy/model"
import type { PlanningRun } from "../../blueprints/social/weekly-planning/model"
import { compilePlanningContext } from "./advance"
import type { BrandReasoner } from "../../infrastructure/models/brand-reasoning"
import { POST_SCHEDULE_SCHEMA, POST_COPY_SCHEMA, POSTS_REVIEW_SCHEMA, validatePostSchedule, validatePostCopy, type PostSchedule, type PostCopy, type PostsPayload, type PostsReview } from "../../blueprints/social/weekly-planning/posts"
import { POST_SCHEDULE_PROMPT, POST_WRITER_PROMPT, POSTS_REVIEW_PROMPT } from "../../blueprints/social/weekly-planning/prompts/posts"
import { validatePlanningProse } from "../../blueprints/social/weekly-planning/validation"
import { spreadPostDays, validateCadence } from "../../blueprints/social/weekly-planning/cadence"
import { compilePostGenerationContext, compilePostEditorialContext } from "../../blueprints/social/weekly-planning/post-context"
import { POST_EDITORIAL_PROMPT, POST_EDITORIAL_SCHEMA, validatePostEditorialReview, consolidatePostReviews, type PostEditorialReview } from "../../blueprints/social/weekly-planning/post-editorial"

export function postsContext(run: PlanningRun) {
  const context = compilePlanningContext(run)
  const focus = run.payload.focus
  const audienceKeys = focus ? [focus.primaryAudienceKey, ...focus.secondaryAudienceKeys] : context.audiences.map((a) => a.audienceKey)
  return { ...context,
    selectedBrandGoals: context.selectedBrandGoals.filter((g) => !run.payload.review || run.payload.review.brandGoalKeys.includes(g.goalKey)),
    audiences: context.audiences.filter((a) => audienceKeys.includes(a.audienceKey)),
    communicationProfiles: context.communicationProfiles.filter((p) => audienceKeys.includes(p.audienceKey)),
    requestedCadence: run.payload.cadence ?? null, contentAudienceDirections: run.payload.adaptation, executionPolicy: { channelsAreRecommendations: true, publishingEnabled: false, imageGenerationEnabled: false, founderUploadAvailable: true, billingMode: "simulated" } }
}
function keys(run: PlanningRun) {
  const c = compilePlanningContext(run)
  return [...c.audiences.map((a) => a.audienceKey), ...c.selectedBrandGoals.map((g) => g.goalKey), ...c.contentDirections.map((d) => d.contentDirectionKey), ...Array.from({ length: 10 }, (_, i) => `p${i + 1}`)]
}
export async function createPostSchedule(run: PlanningRun, reason: BrandReasoner, existing?: PostsPayload) {
  const allowed = run.payload.socialStrategy ? operatingChannels(run.payload.socialStrategy.payload.proposal) : ["facebook", "instagram"]
  if (!allowed.length) throw Error("რეკომენდებული არხებისთვის კონტენტის შესრულება ჯერ ცალკე გამართვას საჭიროებს.")
  const kept = existing?.outline?.posts ?? []
  const combine = (v: PostSchedule): PostSchedule => ({ ...v, posts: spreadPostDays([...kept, ...v.posts], run.week, run.payload.plannedOn) })
  const result = await reason<PostSchedule>({ step: "post_schedule", version: "founder-post-schedule-v5", prompt: POST_SCHEDULE_PROMPT, input: { ...postsContext(run), retainedPosts: kept }, schema: POST_SCHEDULE_SCHEMA, validate: (v) => {
    const value = combine(v as PostSchedule)
    return [...validatePostSchedule(value, run.payload.directions.map((_, i) => `d${i + 1}`)), ...(value.posts.some((p) => p.channels.some((c) => !allowed.includes(c.channel))) ? ["Use only channels permitted by the approved social strategy"] : []), ...(run.payload.cadence ? validateCadence(value.posts, run.payload.cadence) : value.posts.length < 2 || value.posts.length > 5 ? ["Recommend 2–5 unique posts"] : []), ...validatePlanningProse(v, keys(run))]
  } })
  return combine(result)
}
export async function writePost(run: PlanningRun, payload: PostsPayload, key: string, reason: BrandReasoner) {
  const post = payload.outline!.posts[Number(key.slice(1)) - 1]!
  return reason<PostCopy>({ step: `post_writer_${key}`, version: "founder-post-writer-v2", prompt: POST_WRITER_PROMPT, input: { ...compilePostGenerationContext(run, post), siblingJobs: payload.outline!.posts.filter((p) => p !== post).map((p) => ({ job: p.brief.job, takeaway: p.brief.takeaway })), previousDraft: payload.repairDrafts?.[key] ?? null, reviewFeedback: payload.review?.issues.filter((i) => i.postKey === key) ?? [] }, schema: POST_COPY_SCHEMA, validate: (v) => [...validatePostCopy(v as PostCopy, post), ...validatePlanningProse(v, keys(run))] })
}
export async function reviewPosts(run: PlanningRun, payload: PostsPayload, reason: BrandReasoner) {
  const postKeys = payload.outline!.posts.map((_, i) => `p${i + 1}`)
  const editorialPosts = payload.outline!.posts.map((post, i) => ({ postKey: postKeys[i]!, ...compilePostEditorialContext(run, post), draft: payload.copies[postKeys[i]!]! }))
  if (editorialPosts.some((p) => !p.draft)) throw Error("Cannot review incomplete post copies")
  // Independent calls share the existing worker stage/lease budget and one repair pass.
  const results = await Promise.allSettled([
    reason<PostsReview>({ step: "post_review", version: "founder-post-review-v2", prompt: POSTS_REVIEW_PROMPT, input: { postContexts: payload.outline!.posts.map((p, i) => ({ postKey: postKeys[i], ...compilePostGenerationContext(run, p) })), weeklyOutline: payload.outline, drafts: payload.copies }, schema: POSTS_REVIEW_SCHEMA, validate: (v) => [...((v as PostsReview).issues.some((i) => !postKeys.includes(i.postKey)) ? ["Unknown post key"] : []), ...validatePlanningProse(v, keys(run))] }),
    reason<PostEditorialReview>({ step: "post_editorial", version: "founder-post-editorial-v1", prompt: POST_EDITORIAL_PROMPT, input: { posts: editorialPosts }, schema: POST_EDITORIAL_SCHEMA, validate: (v) => [...validatePostEditorialReview(v as PostEditorialReview, editorialPosts), ...validatePlanningProse(v, keys(run))] }),
  ])
  const [safety, editorial] = results
  if (safety.status === "rejected") throw safety.reason
  if (editorial.status === "rejected") throw editorial.reason
  const combined = consolidatePostReviews(safety.value, editorial.value)
  return { ...combined, issues: [...combined.issues, ...duplicateCopyIssues(payload, run.payload.priorCopy)] }
}
