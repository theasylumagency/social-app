import { duplicateCopyIssues } from "../../blueprints/social/weekly-planning/duplicate-hygiene"
import type { PlanningRun } from "../../blueprints/social/weekly-planning/model"
import { compilePlanningContext } from "./advance"
import type { BrandReasoner } from "../../infrastructure/models/brand-reasoning"
import { POST_COPY_SCHEMA, POSTS_REVIEW_SCHEMA, independentPostScheduleSchema, validatePostSchedule, validatePostCopy, type PostSchedule, type PostCopy, type PostsPayload, type PostsReview } from "../../blueprints/social/weekly-planning/posts"
import { POST_SCHEDULE_PROMPT, POST_WRITER_PROMPT, POSTS_REVIEW_PROMPT } from "../../blueprints/social/weekly-planning/prompts/posts"
import { validatePlanningProse } from "../../blueprints/social/weekly-planning/validation"
import { spreadPostDays } from "../../blueprints/social/weekly-planning/cadence"
import { compilePostGenerationContext, compilePostEditorialContext, validateVariantOperatingRules } from "../../blueprints/social/weekly-planning/post-context"
import { POST_EDITORIAL_PROMPT, POST_EDITORIAL_SCHEMA, validatePostEditorialReview, consolidatePostReviews, type PostEditorialReview } from "../../blueprints/social/weekly-planning/post-editorial"
import { CREATIVE_REVIEW_SCHEMA, consolidateCreativeReview, selectedCreativeDirection, validateCreativeReview, validateCreativeSelection, type CreativeReview, type CreativeReviewInput } from "../../blueprints/social/creative/model"
import { CREATIVE_CRITIC_PROMPT } from "../../blueprints/social/creative/prompts"
import { channelPlanCadence, validateChannelExecutions, validateChannelPlan } from "../../blueprints/social/weekly-planning/channel-plan"
import { channelPlanningContext, fixedChannelPlan, permittedPostChannels } from "./channel-plan"

export function postChannels(run: PlanningRun, includePaused = false) {
  return permittedPostChannels(run).filter(channel => includePaused || !run.payload.cadence || run.payload.cadence[channel] > 0)
}

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
  const channelPlan = existing?.channelPlan ?? fixedChannelPlan(run)
  if (!channelPlan) throw Error("Plan channel roles and counts before creating posts")
  const context = channelPlanningContext(run, existing)
  const planErrors = validateChannelPlan(channelPlan, { allowed: permittedPostChannels(run), requested: run.payload.cadence ?? null, retained: context.retainedCounts })
  if (planErrors.length) throw Error(`Invalid saved channel plan: ${planErrors.join("; ")}`)
  const cadence = channelPlanCadence(channelPlan)
  if (cadence.facebook + cadence.instagram === 0) return { summary: "ამ კვირაში პოსტების მომზადება შეჩერებულია.", cadenceReason: channelPlan.channels.map(c => c.omissionReason).join(" "), channelReason: channelPlan.channels.map(c => `${c.channel === "facebook" ? "Facebook" : "Instagram"}: ${c.omissionReason}`).join(" "), posts: [] }
  const kept = existing?.outline?.posts ?? []
  const combine = (v: PostSchedule): PostSchedule => ({ ...v, posts: spreadPostDays([...kept, ...v.posts], run.week, run.payload.plannedOn) })
  const result = await reason<PostSchedule>({ step: "post_schedule", version: "founder-post-schedule-v7", prompt: POST_SCHEDULE_PROMPT, input: { ...postsContext(run), channelPlan, requestedCadence: cadence, retainedPosts: kept, ...(existing?.creative ? { creativeDirections: existing.creative.directions } : {}) }, schema: independentPostScheduleSchema(existing?.creative), validate: (v) => {
    const value = combine(v as PostSchedule)
    return [...validatePostSchedule(value, run.payload.directions.map((_, i) => `d${i + 1}`)), ...validateChannelExecutions((v as PostSchedule).posts, value.posts, channelPlan), ...(existing?.creative ? validateCreativeSelection((v as PostSchedule).posts, existing.creative) : []), ...validatePlanningProse(v, [...keys(run), ...(existing?.creative?.directions.map(d => d.key) ?? [])])]
  } })
  return combine(result)
}
export async function writePost(run: PlanningRun, payload: PostsPayload, key: string, reason: BrandReasoner) {
  const post = payload.outline!.posts[Number(key.slice(1)) - 1]!
  const executionRun = payload.operatingRules ? { ...run, payload: { ...run.payload, operatingRules: payload.operatingRules } } : run
  const concept = selectedCreativeDirection(payload, post)
  return reason<PostCopy>({ step: `post_writer_${key}`, version: "founder-post-writer-v5", prompt: POST_WRITER_PROMPT, input: { ...compilePostGenerationContext(executionRun, post), ...(concept ? { creativeDirection: concept, plannedVisual: post.visual } : {}), channelRoles: payload.channelPlan?.channels.filter(c => post.channels.some(p => p.channel === c.channel)) ?? [], siblingJobs: payload.outline!.posts.filter(p => p !== post && p.channels.some(c => post.channels.some(selected => selected.channel === c.channel))).map(p => ({ job: p.brief.job, takeaway: p.brief.takeaway })), previousDraft: payload.repairDrafts?.[key] ?? null, reviewFeedback: payload.review?.issues.filter((i) => i.postKey === key) ?? [], repairInstructions: payload.repairFeedback?.[key]?.instructions ?? [] }, schema: POST_COPY_SCHEMA, validate: (v) => [...validatePostCopy(v as PostCopy, post), ...(v as PostCopy).variants.flatMap(variant => validateVariantOperatingRules(variant, executionRun.payload.operatingRules ?? [])), ...validatePlanningProse(v, [...keys(run), ...(payload.creative?.directions.map(d => d.key) ?? [])])] })
}
export function creativeReviewInput(run: PlanningRun, payload: PostsPayload): CreativeReviewInput[] {
  return payload.outline!.posts.flatMap((post, i) => {
    const concept = selectedCreativeDirection(payload, post)
    if (!concept) return []
    const postKey = `p${i + 1}`
    const draft = payload.copies[postKey]
    if (!draft) throw Error("Cannot review incomplete post copies")
    const audiences = compilePostGenerationContext(run, post).internalGuidance.audiences.map(({ name, situation }) => ({ name, situation }))
    return draft.variants.map(variant => ({ postKey, platform: variant.channel, concept, audiences, draft: variant, plannedVisual: post.visual }))
  })
}
export async function reviewCreativePosts(run: PlanningRun, payload: PostsPayload, reason: BrandReasoner): Promise<CreativeReview> {
  const posts = creativeReviewInput(run, payload)
  if (!posts.length) return { posts: [] }
  return reason<CreativeReview>({ step: "creative_critic", version: "creative-critic-v2", prompt: CREATIVE_CRITIC_PROMPT, input: { posts }, schema: CREATIVE_REVIEW_SCHEMA, validate: value => validateCreativeReview(value as CreativeReview, posts) })
}
export async function reviewPosts(run: PlanningRun, payload: PostsPayload, reason: BrandReasoner, creativeReason: BrandReasoner = reason) {
  const executionRun = payload.operatingRules ? { ...run, payload: { ...run.payload, operatingRules: payload.operatingRules } } : run
  const postKeys = payload.outline!.posts.map((_, i) => `p${i + 1}`)
  const editorialPosts = payload.outline!.posts.map((post, i) => ({ postKey: postKeys[i]!, ...compilePostEditorialContext(executionRun, post), draft: payload.copies[postKeys[i]!]! }))
  if (editorialPosts.some((p) => !p.draft)) throw Error("Cannot review incomplete post copies")
  // Independent calls share the existing worker stage/lease budget and one repair pass.
  const results = await Promise.allSettled([
    reason<PostsReview>({ step: "post_review", version: "founder-post-review-v2", prompt: POSTS_REVIEW_PROMPT, input: { postContexts: payload.outline!.posts.map((p, i) => ({ postKey: postKeys[i], ...compilePostGenerationContext(executionRun, p) })), weeklyOutline: payload.outline, drafts: payload.copies }, schema: POSTS_REVIEW_SCHEMA, validate: (v) => [...((v as PostsReview).issues.some((i) => !postKeys.includes(i.postKey)) ? ["Unknown post key"] : []), ...validatePlanningProse(v, keys(run))] }),
    reason<PostEditorialReview>({ step: "post_editorial", version: "founder-post-editorial-v1", prompt: POST_EDITORIAL_PROMPT, input: { posts: editorialPosts }, schema: POST_EDITORIAL_SCHEMA, validate: (v) => [...validatePostEditorialReview(v as PostEditorialReview, editorialPosts), ...validatePlanningProse(v, keys(run))] }),
    reviewCreativePosts(run, payload, creativeReason),
  ])
  const [safety, editorial, creative] = results
  if (safety.status === "rejected") throw safety.reason
  if (editorial.status === "rejected") throw editorial.reason
  if (creative.status === "rejected") throw creative.reason
  const standard = consolidatePostReviews(safety.value, editorial.value)
  const combined = creative.value.posts.length ? consolidateCreativeReview(standard, creative.value) : standard
  return { ...combined, issues: [...combined.issues, ...duplicateCopyIssues(payload, run.payload.priorCopy)] }
}
