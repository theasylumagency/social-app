import type { JsonSchema } from "../brand-discovery/schemas"
import type { PostEditorialReview } from "./post-editorial"
import type { SequenceReview } from "./sequence"

export type PostChannel = "facebook" | "instagram"
export type PostCadence = Record<PostChannel, number>
export const MAX_POSTS_PER_CHANNEL = 5
export function isPostCadence(value: unknown): value is PostCadence {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false
  const v = value as Record<string, unknown>
  return Object.keys(v).length === 2 && [v.facebook, v.instagram].every((n) => typeof n === "number" && Number.isInteger(n) && n >= 0 && n <= MAX_POSTS_PER_CHANNEL)
}
export function countPostChannels(posts: PostOutline[]): PostCadence {
  return posts.reduce((n, p) => { for (const c of p.channels) n[c.channel]++; return n }, { facebook: 0, instagram: 0 })
}
export type PostFormat = "text" | "image" | "carousel" | "story" | "reel"
export type PostOutline = {
  directionKey: string; dayOffset: number; title: string; why: string; format: PostFormat
  channels: { channel: PostChannel; reason: string }[]
  brief: { job: string; takeaway: string; points: string[]; mustNotSay: string[] }
  visual: { kind: "none" | "graphic" | "photo" | "slides" | "video"; description: string; aspectRatio: "none" | "1:1" | "4:5" | "9:16"; frames: string[] }
}
export type PostVariant = { channel: PostChannel; caption: string; frames: { heading: string; body: string }[]; script: string; onScreenText: string[] }
export type PostCopy = { variants: PostVariant[] }
export type PostSchedule = { summary: string; cadenceReason: string; channelReason: string; posts: PostOutline[] }
export type PostsReview = { summary: string; issues: { postKey: string; severity: "blocking" | "advisory"; message: string }[]; editorial?: PostEditorialReview }
export type PostRepairFeedback = { issues: PostsReview["issues"]; instructions: string[] }
export type PostsPayload = { outline: PostSchedule | null; copies: Record<string, PostCopy>; repairDrafts?: Record<string, PostCopy>; review: PostsReview | null; repairs: number; cadence?: PostCadence
  /** Decision evidence paired with repairDrafts; final review replaces review. */
  repairFeedback?: Record<string, PostRepairFeedback>
  sequenceReview?: SequenceReview
  sequenceRepairs?: number
  sequenceRetainedCount?: number
  sequenceFeedback?: { rejectedPosts: PostOutline[]; review: SequenceReview }
}
export type PostsBatch = { runId: string; status: "queued" | "running" | "ready" | "failed"; step: "outline" | "writing" | "review" | "ready"; payload: PostsPayload; error: string | null; leaseUntil: string | null; approvedAt: string | null; updatedAt: string }
export type PostAsset = { id: string; postKey: string; slot: number; width: number; height: number; name: string }
export const emptyPosts = (): PostsPayload => ({ outline: null, copies: {}, review: null, repairs: 0 })

export function postRepairFeedback(review: PostsReview, postKey: string): PostRepairFeedback {
  return {
    issues: review.issues.filter((issue) => issue.postKey === postKey && issue.severity === "blocking").map((issue) => ({ ...issue })),
    instructions: review.editorial?.posts.find((post) => post.postKey === postKey)?.issues.map((issue) => issue.repairInstruction) ?? [],
  }
}

/** One consolidated automatic Writer repair; unresolved issues remain approval blockers. */
export function applyPostReview(payload: PostsPayload, review: PostsReview): "writing" | "ready" {
  payload.review = review
  const blocked = review.issues.filter((i) => i.severity === "blocking")
  if (!blocked.length || payload.repairs >= 1) return "ready"
  payload.repairDrafts ??= {}
  for (const key of new Set(blocked.map((i) => i.postKey))) {
    const previous = payload.copies[key]
    if (previous) {
      payload.repairDrafts[key] = previous
      payload.repairFeedback ??= {}
      payload.repairFeedback[key] = postRepairFeedback(review, key)
    }
    delete payload.copies[key]
  }
  payload.repairs++
  return "writing"
}

const str = (maxLength = 1000, minLength = 1) => ({ type: "string", minLength, maxLength })
const list = (items: JsonSchema, minItems = 0, maxItems = 6) => ({ type: "array", items, minItems, maxItems })
const obj = (properties: Record<string, JsonSchema>): JsonSchema => ({ type: "object", additionalProperties: false, properties, required: Object.keys(properties) })
const enumeration = (...values: string[]) => ({ type: "string", enum: values })
export const POST_SCHEDULE_SCHEMA = obj({ summary: str(250), cadenceReason: str(650), channelReason: str(650), posts: list(obj({
  directionKey: str(10), dayOffset: { type: "integer", minimum: 0, maximum: 6 }, title: str(130), why: str(500), format: enumeration("text", "image", "carousel", "story", "reel"),
  channels: list(obj({ channel: enumeration("facebook", "instagram"), reason: str(350) }), 1, 2),
  brief: obj({ job: str(400), takeaway: str(400), points: list(str(400), 2, 5), mustNotSay: list(str(350), 1, 6) }),
  visual: obj({ kind: enumeration("none", "graphic", "photo", "slides", "video"), description: str(900), aspectRatio: enumeration("none", "1:1", "4:5", "9:16"), frames: list(str(400), 0, 6) }),
}), 1, 10) })
export const POST_COPY_SCHEMA = obj({ variants: list(obj({ channel: enumeration("facebook", "instagram"), caption: str(3000, 0), frames: list(obj({ heading: str(160, 0), body: str(500) }), 0, 6), script: str(1800, 0), onScreenText: list(str(180), 0, 6) }), 1, 2) })
export const POSTS_REVIEW_SCHEMA = obj({ summary: str(600), issues: list(obj({ postKey: str(10), severity: enumeration("blocking", "advisory"), message: str(650) }), 0, 10) })

export function validatePostSchedule(value: PostSchedule, directions: string[]): string[] {
  const errors: string[] = []
  value.posts.forEach((p, i) => {
    if (!directions.includes(p.directionKey)) errors.push(`posts[${i}]: unknown direction`)
    if (new Set(p.channels.map((c) => c.channel)).size !== p.channels.length) errors.push(`posts[${i}]: duplicate channels`)
    if (i && p.dayOffset < value.posts[i - 1]!.dayOffset) errors.push("Posts must follow the proposed week order")
    if (p.format === "text" && (p.channels.some((c) => c.channel === "instagram") || p.visual.kind !== "none" || p.visual.frames.length || p.visual.aspectRatio !== "none")) errors.push("Text-only posts require Facebook and no visual")
    if (p.format === "image" && (!["graphic", "photo"].includes(p.visual.kind) || p.visual.frames.length !== 1 || p.visual.aspectRatio === "none")) errors.push("Image post requires one graphic/photo brief and an aspect ratio")
    if (p.format === "carousel" && (p.visual.kind !== "slides" || p.visual.frames.length < 2 || p.visual.aspectRatio === "none")) errors.push("Carousel requires 2–6 visual frame briefs")
    if (p.format === "story" && (p.visual.kind !== "slides" || p.visual.frames.length < 1 || p.visual.frames.length > 3 || p.visual.aspectRatio !== "9:16")) errors.push("Story requires 1–3 vertical frame briefs")
    if (p.format === "reel" && (p.visual.kind !== "video" || p.visual.aspectRatio !== "9:16" || !p.visual.frames.length)) errors.push("Reel requires vertical footage / scene briefs")
  })
  if (new Set(value.posts.map((p) => p.title.trim().toLowerCase())).size !== value.posts.length) errors.push("Posts must have distinct titles and communication jobs")
  const normalize = (v: string) => v.normalize("NFKC").trim().toLocaleLowerCase().replace(/\s+/gu, " ")
  const jobs = value.posts.map((p) => JSON.stringify([normalize(p.brief.job), normalize(p.brief.takeaway)]))
  if (new Set(jobs).size !== jobs.length) errors.push("Duplicate post job and takeaway; change reader value, not the title or format")
  return errors
}
export function validatePostCopy(value: PostCopy, post: PostOutline): string[] {
  const errors: string[] = []
  if (value.variants.length !== post.channels.length || new Set(value.variants.map((v) => v.channel)).size !== value.variants.length || value.variants.some((v) => !post.channels.some((c) => c.channel === v.channel))) errors.push("Return exactly one variant per selected channel")
  for (const v of value.variants) {
    if (v.channel === "instagram" && v.caption.length > 2200) errors.push("Instagram caption exceeds 2200 characters")
    if (post.format !== "story" && !v.caption.trim()) errors.push("A complete caption is required")
    if (["carousel", "story"].includes(post.format) ? v.frames.length !== post.visual.frames.length : v.frames.length !== 0) errors.push("Copy frames must exactly match the selected format and visual frame count")
    if (post.format === "reel" ? !v.script.trim() || !v.onScreenText.length : !!v.script || !!v.onScreenText.length) errors.push("Only reels require script and on-screen text")
    if (post.format === "story" && v.caption) errors.push("Story copy belongs in frames, not a feed caption")
  }
  return errors
}

/** Test mode is a server-owned hard stop; no provider request or charge is possible. */
export const IMAGE_GENERATION_POLICY = { mode: "testing", enabled: false, trialIncluded: false, paidPlanned: true } as const
