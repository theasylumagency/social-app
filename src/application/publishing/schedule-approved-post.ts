import { createHash } from "node:crypto"
import type { PlanningRun } from "../../blueprints/social/weekly-planning/model"
import type { PostsBatch, PostAsset } from "../../blueprints/social/weekly-planning/posts"
import type { SocialContentScheduleId } from "../../blueprints/social"
import { assembleSocialContentSchedule } from "../../blueprints/social/content-schedule"
import { resolveSocialContentSchedulingEligibility } from "../../blueprints/social/content-scheduling-eligibility"
import { createIsoDateTime } from "../../core/domain/primitives"
import { materializeApprovedPost } from "./materialize-approved-post"
import type { ScheduleDestination, SocialPublicationStore } from "./publication-store"

const id = (kind: string, values: readonly string[]) => `social:${kind}:${createHash("sha256").update(values.join("\u0000")).digest("hex")}`

function expectedAssets(format: string, frames: number) {
  if (format === "text") return 0
  if (format === "image") return 1
  if (format === "carousel" || format === "story") return frames
  throw new Error("Reel scheduling requires a video asset, which weekly planning does not yet support")
}

export async function scheduleApprovedPost(input: {
  readonly ownerId: string
  readonly actorId: string
  readonly run: PlanningRun
  readonly posts: PostsBatch
  readonly assets: readonly PostAsset[]
  readonly postKey: string
  readonly destinations: readonly ScheduleDestination[]
  readonly now: string
}, store: SocialPublicationStore) {
  if (!input.destinations.length) throw new Error("Choose at least one publishing destination")
  const scheduledAt = createIsoDateTime(input.now)
  const unique = new Set<string>()
  const records = input.destinations.map((destination) => {
    const key = `${destination.channel}:${destination.publishingAccountId}`
    if (unique.has(key)) throw new Error("A publishing destination may only be scheduled once")
    unique.add(key)
    const publication = materializeApprovedPost({ run: input.run, posts: input.posts, postKey: input.postKey,
      channel: destination.channel, contentMode: destination.contentMode })
    const post = input.posts.payload.outline!.posts[Number(input.postKey.slice(1)) - 1]!
    const required = expectedAssets(post.format, post.visual.frames.length)
    const found = input.assets.filter((asset) => asset.postKey === input.postKey).sort((a, b) => a.slot - b.slot)
    if (found.length !== required || found.some((asset, ordinal) => asset.slot !== ordinal)) throw new Error("mediaManifestIncomplete")
    const eligibility = resolveSocialContentSchedulingEligibility({ draft: publication.bundle.draft,
      evaluationAudit: publication.bundle.evaluationAudit, contentExecutionSpec: publication.bundle.contentExecutionSpec,
      approvalPolicy: { mode: "reviewRequired" }, reviewRequest: publication.bundle.reviewRequest,
      reviewDecision: publication.bundle.reviewDecision })
    if (!eligibility.eligible) throw new Error(`Content cannot be scheduled: ${eligibility.reason}`)
    const schedule = assembleSocialContentSchedule({
      id: id("schedule", [publication.id, destination.publishingAccountId]) as SocialContentScheduleId,
      draft: publication.bundle.draft, contentExecutionSpec: publication.bundle.contentExecutionSpec, eligibility,
      publishAt: createIsoDateTime(destination.publishAt), scheduledAt,
    })
    return { publication, schedule, publishingAccountId: destination.publishingAccountId }
  })
  return store.saveSchedules({ ownerId: input.ownerId, actorId: input.actorId, brandId: input.run.brandId,
    sourceRunId: input.run.id, approvalAt: input.posts.approvedAt!, approvalActorId: input.posts.approvedByUserId!, records })
}
