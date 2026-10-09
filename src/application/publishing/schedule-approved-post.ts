import {materializePostRevision} from "./materialize-post-revision"
import type {PostRevision} from "../post-revisions/model"
import { createHash } from "node:crypto"
import type { PlanningRun } from "../../blueprints/social/weekly-planning/model"
import type { PostsBatch, PostAsset } from "../../blueprints/social/weekly-planning/posts"
import type { SocialContentScheduleId } from "../../blueprints/social"
import { assembleSocialContentSchedule } from "../../blueprints/social/content-schedule"
import { weeklyPublicationEligibility } from "./weekly-publication-bundle"
import { createIsoDateTime } from "../../core/domain/primitives"
import { materializeApprovedPost } from "./materialize-approved-post"
import type { ScheduleDestination, SocialPublicationStore } from "./publication-store"
import { resolveScheduleTime, type ScheduleTimeContext } from "./schedule-time"
import { WEEKLY_EXECUTION_CAPABILITIES } from "../../blueprints/social/weekly-planning/execution-capabilities"
import { ScheduleConflict } from "./schedule-errors"

const id = (kind: string, values: readonly string[]) => `social:${kind}:${createHash("sha256").update(values.join("\u0000")).digest("hex")}`

function expectedAssets(format: string, frames: number) {
  if (format === "text") return 0
  if (format === "image") return 1
  if (format === "carousel" || format === "story") return frames
  throw new Error("Reel scheduling requires a video asset, which weekly planning does not yet support")
}

type ApprovedPostScheduleInput = {
  readonly revision?:PostRevision
  readonly ownerId: string
  readonly actorId: string
  readonly run: PlanningRun
  readonly posts: PostsBatch
  readonly assets: readonly PostAsset[]
  readonly postKey: string
  readonly destinations: readonly ScheduleDestination[]
  readonly now: string
  readonly replaceInputIds?: readonly string[]
}
function prepareApprovedPost(input: ApprovedPostScheduleInput) {
  if (!input.destinations.length) throw new Error("Choose at least one publishing destination")
  const scheduledAt = createIsoDateTime(input.now)
  const unique = new Set<string>()
  const records = input.destinations.map((destination) => {
    const key = `${destination.channel}:${destination.publishingAccountId}`
    if (unique.has(key)) throw new Error("A publishing destination may only be scheduled once")
    unique.add(key)
    if(input.revision&&(input.revision.runId!==input.run.id||input.revision.postKey!==input.postKey||input.revision.channel!==destination.channel))throw Error("Revision target mismatch")
    const publication = input.revision ? materializePostRevision(input.revision) : materializeApprovedPost({ run: input.run, posts: input.posts, postKey: input.postKey,
      channel: destination.channel, contentMode: destination.contentMode })
    const post = input.posts.payload.outline!.posts[Number(input.postKey.slice(1)) - 1]!
    if (!(WEEKLY_EXECUTION_CAPABILITIES.supportedFormatsByChannel[destination.channel] as readonly string[]).includes(post.format)) throw Error("ამ ფორმატის გამოქვეყნება არჩეულ არხზე ჯერ არ არის მხარდაჭერილი.")
    const required = expectedAssets(post.format, post.visual.frames.length)
    const found = input.assets.filter((asset) => asset.postKey === input.postKey).sort((a, b) => a.slot - b.slot)
    if (found.length !== required || found.some((asset, ordinal) => asset.slot !== ordinal)) throw new Error("mediaManifestIncomplete")
    const eligibility = weeklyPublicationEligibility(publication.bundle)
    if (!eligibility.eligible) throw new Error(`Content cannot be scheduled: ${eligibility.reason}`)
    const schedule = assembleSocialContentSchedule({
      id: id("schedule", [publication.id, destination.publishingAccountId]) as SocialContentScheduleId,
      draft: publication.bundle.draft, contentExecutionSpec: publication.bundle.contentExecutionSpec, eligibility,
      publishAt: createIsoDateTime(destination.publishAt), scheduledAt,
    })
    return { publication, schedule, publishingAccountId: destination.publishingAccountId }
  })
  return records
}
export async function scheduleApprovedPost(input: ApprovedPostScheduleInput, store: SocialPublicationStore) {
  const records = prepareApprovedPost(input)
  return store.saveSchedules({ ownerId: input.ownerId, actorId: input.actorId, brandId: input.run.brandId,
    sourceRunId: input.run.id, approvalAt: input.posts.approvedAt!, approvalActorId: input.posts.approvedByUserId!,
    ...(input.replaceInputIds ? { replaceInputIds: input.replaceInputIds } : {}), records })
}

export type WeeklyScheduleSelection = { postKey: string; channel: "facebook" | "instagram"; publishingAccountId: string; timeContext: ScheduleTimeContext; revisionId?:string }
export async function scheduleApprovedWeek(input: Omit<ApprovedPostScheduleInput, "postKey" | "destinations"> & {
  readonly revisions?:readonly PostRevision[]
  readonly approvalId: string; readonly selections: readonly WeeklyScheduleSelection[]
}, store: SocialPublicationStore) {
  if (!input.selections.length || input.selections.length > 40) throw Error("აირჩიეთ 1–40 გამოსაქვეყნებელი ჩანაწერი.")
  if (input.approvalId !== input.posts.approvalEvidence?.id) throw new ScheduleConflict("კვირის დამტკიცება შეიცვალა. განაახლეთ გვერდი და გადაამოწმეთ განრიგი.")
  const unique = new Set<string>()
  const records = input.selections.flatMap(selection => {
    const key = JSON.stringify([selection.postKey, selection.channel, selection.publishingAccountId])
    if (unique.has(key)) throw Error("ერთი პოსტისა და ანგარიშის ჩანაწერი ჯგუფში მხოლოდ ერთხელ უნდა იყოს.")
    unique.add(key)
    if (!/^p([1-9]|10)$/u.test(selection.postKey)) throw Error("პოსტის არჩევანი არასწორია.")
    const post = input.posts.payload.outline?.posts[Number(selection.postKey.slice(1)) - 1]
    if (!post?.contentMode) throw Error("პოსტს ხელახალი შეფასება და დამტკიცება სჭირდება.")
    const revision=selection.revisionId?input.revisions?.find(r=>r.id===selection.revisionId):undefined
    if(selection.revisionId&&!revision)throw Error("პოსტის დამტკიცებული ვერსია ვერ მოიძებნა.")
    const publishAt = resolveScheduleTime(selection.timeContext)
    return prepareApprovedPost({ ...input, ...(revision?{revision}:{}), postKey: selection.postKey, destinations: [{ channel: selection.channel,
      publishingAccountId: selection.publishingAccountId, publishAt, contentMode: post.contentMode }] })
      .map(record => ({ ...record, timeContext: selection.timeContext }))
  })
  return store.saveSchedules({ ownerId: input.ownerId, actorId: input.actorId, brandId: input.run.brandId,
    sourceRunId: input.run.id, approvalAt: input.posts.approvedAt!, approvalActorId: input.posts.approvedByUserId!,
    ...(input.replaceInputIds ? { replaceInputIds: input.replaceInputIds } : {}), records })
}
