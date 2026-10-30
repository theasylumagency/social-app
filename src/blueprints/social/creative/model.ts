import type { JsonSchema } from "../brand-discovery/schemas"
import { validateReferences } from "../brand-discovery/validation"
import type { PostChannel, PostCopy, PostOutline, PostsPayload, PostsReview } from "../weekly-planning/posts"

/** Ideas are private creative material, never facts, policy or publication authority. */
export type CreativeInput = {
  business: string
  audiences: { name: string; situation: string }[]
  platforms: PostChannel[]
}
export type CreativeConcept = {
  title: string
  coreThought: string
  whyAudienceCares: string
  mechanism: string
  manifestations: string[]
  platforms: PostChannel[]
}
export type CreativeProposal = { directions: CreativeConcept[] }
export type CreativeDirection = CreativeConcept & { key: string }
export type CreativeExploration = {
  id: string
  input: CreativeInput
  directions: CreativeDirection[]
}
export type CreativeAssessment = {
  postKey: string
  channel: PostChannel
  assessment: "strong" | "acceptable" | "diluted" | "lost"
  reason: string
  repairDirection: string
}
export type CreativeReview = { posts: CreativeAssessment[] }
export type CreativeReviewInput = {
  postKey: string
  platform: PostChannel
  concept: CreativeDirection
  audiences: CreativeInput["audiences"]
  draft: PostCopy["variants"][number]
  plannedVisual: PostOutline["visual"]
}

const text = (maxLength = 650, minLength = 1) => ({ type: "string", minLength, maxLength })
const obj = (properties: Record<string, JsonSchema>): JsonSchema => ({ type: "object", additionalProperties: false, properties, required: Object.keys(properties) })
const list = (items: JsonSchema, minItems: number, maxItems: number) => ({ type: "array", items, minItems, maxItems })
const channel = { type: "string", enum: ["facebook", "instagram"] }
export const CREATIVE_EXPLORATION_SCHEMA = obj({ directions: list(obj({
  title: text(130), coreThought: text(), whyAudienceCares: text(), mechanism: text(),
  manifestations: list(text(400), 2, 3), platforms: list(channel, 1, 2),
}), 4, 6) })
export const CREATIVE_REVIEW_SCHEMA = obj({ posts: list(obj({
  postKey: text(10), channel,
  assessment: { type: "string", enum: ["strong", "acceptable", "diluted", "lost"] },
  reason: text(), repairDirection: text(650, 0),
}), 1, 20) })

export function validateCreativeProposal(value: CreativeProposal, input: CreativeInput): string[] {
  const errors: string[] = []
  const normalize = (text: string) => text.normalize("NFKC").trim().toLocaleLowerCase().replace(/\s+/gu, " ")
  for (const field of ["coreThought", "mechanism"] as const) {
    if (new Set(value.directions.map(d => normalize(d[field]))).size !== value.directions.length) errors.push(`Creative directions must have distinct ${field}`)
  }
  for (const direction of value.directions) errors.push(...validateReferences(direction.platforms, input.platforms, "creative platforms"))
  if (input.platforms.some(platform => !value.directions.some(d => d.platforms.includes(platform)))) errors.push("Explore every requested platform")
  return errors
}

export function selectedCreativeDirection(payload: PostsPayload, post: PostOutline): CreativeDirection | null {
  if (!post.creativeDirectionKey) return null // Backward-compatible saved posts.
  const direction = payload.creative?.directions.find(d => d.key === post.creativeDirectionKey)
  if (!direction) throw Error("Missing selected creative direction")
  if (post.channels.some(c => !direction.platforms.includes(c.channel))) throw Error("Creative direction does not support the selected channels")
  return direction
}

export function validateCreativeSelection(posts: PostOutline[], exploration: CreativeExploration): string[] {
  return posts.flatMap(post => {
    const direction = exploration.directions.find(d => d.key === post.creativeDirectionKey)
    if (!direction) return ["Select a supplied creative direction for every new post"]
    return post.channels.some(c => !direction.platforms.includes(c.channel)) ? ["Selected creative direction must support every post channel"] : []
  })
}

export function validateCreativeReview(value: CreativeReview, input: CreativeReviewInput[]): string[] {
  const pair = (key: string, channel: string) => `${key}:${channel}`
  const errors = validateReferences(value.posts.map(p => pair(p.postKey, p.channel)), input.map(p => pair(p.postKey, p.platform)), "creative review")
  if (value.posts.length !== input.length) errors.push("Assess every supplied post/channel exactly once")
  for (const post of value.posts) {
    if (needsCreativeRepair(post) !== !!post.repairDirection.trim()) errors.push("Only diluted/lost ideas require a concrete repair direction")
  }
  return errors
}

export const needsCreativeRepair = (post: CreativeAssessment) => post.assessment === "diluted" || post.assessment === "lost"

/** Creative feedback can request the shared repair pass, but cannot block approval. */
export function consolidateCreativeReview(review: PostsReview, creative: CreativeReview): PostsReview {
  return { ...review, creative, issues: [...review.issues, ...creative.posts.filter(needsCreativeRepair).map(p => ({
    postKey: p.postKey, severity: "advisory" as const, message: `${p.channel === "facebook" ? "Facebook" : "Instagram"}: ${p.reason} — ${p.repairDirection}`,
  }))] }
}
