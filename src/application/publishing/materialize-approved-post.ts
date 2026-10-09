import { assertCurrentWeeklyApproval } from "../weekly-planning/approval-evidence"
import { assertCurrentWeeklyReview, reviewDigest } from "../weekly-planning/review-evidence"
import { createHash } from "node:crypto"
import type { PlanningRun } from "../../blueprints/social/weekly-planning/model"
import type { PostsBatch, PostChannel } from "../../blueprints/social/weekly-planning/posts"
import type { SocialContentMode } from "../../blueprints/social/tokens"
import type { ContentBrief, ContentExecutionSpec } from "../../blueprints/social"
import {
  assembleContentBrief, assembleContentExecutionSpecs, assembleSocialContentDraft,
} from "../../blueprints/social"
import type { ContentId, IsoDateTime } from "../../core/domain"
import { SOCIAL_CHANNELS, SOCIAL_CONTENT_MODES } from "../../blueprints/social/tokens"
import { encodeSocialPublicationBundle } from "./publication-bundle-codec"

const stable = (kind: string, runId: string, postKey: string, channel: string, version = 1) =>
  `social:${kind}:${createHash("sha256").update([runId, postKey, channel, version].join("\u0000")).digest("hex")}`

const format = (value: "text" | "image" | "carousel" | "story" | "reel") => value === "text" || value === "image" ? "staticPost" : value

export function materializeApprovedPost(input: { readonly run: PlanningRun; readonly posts: PostsBatch; readonly postKey: string;
  readonly channel: PostChannel; readonly contentMode: SocialContentMode }) {
  const { run, posts, postKey, channel, contentMode } = input
  if (run.status !== "approved" || !run.payload.plan || run.payload.plan.state !== "approved" || posts.status !== "ready"
    || !posts.approvedAt || !posts.approvedByUserId || !posts.payload.review || posts.payload.review.issues.some((issue) => issue.severity === "blocking")) {
    throw new Error("Only an approved weekly post may be materialized")
  }
  const index = Number(postKey.slice(1)) - 1
  const post = /^p([1-9]|10)$/u.test(postKey) ? posts.payload.outline?.posts[index] : undefined
  const copy = posts.payload.copies[postKey]
  const variant = copy?.variants.find((candidate) => candidate.channel === channel)
  const directionIndex = post ? Number(post.directionKey.slice(1)) - 1 : -1
  const direction = run.payload.plan.contentDirections[directionIndex]
  if (!post || !copy || !variant || !direction || !post.channels.some((candidate) => candidate.channel === channel)) throw new Error("Approved post channel is incomplete")
  const weeklyReview = assertCurrentWeeklyReview(run, posts.payload, postKey)
  const binding = assertCurrentWeeklyApproval(run, posts)
  if (contentMode !== post.contentMode) throw Error("Publication mode must match the approved post")
  const identityRunId = `${run.id}:weekly-approval-v3:${reviewDigest(binding)}`
  const usedProofs = weeklyReview.publicKnowledge?.proofs.filter(p => copy.factualReferences?.proofKeys.includes(p.key)) ?? []
  const proofRequired = contentMode === SOCIAL_CONTENT_MODES.proofLed || (weeklyReview.publicKnowledge?.facts.some(f => copy.factualReferences?.factKeys.includes(f.key) && f.permission === "publicUseWithProof") ?? false)
  const createdAt = posts.approvedAt as IsoDateTime
  const contentId = stable("content", identityRunId, postKey, channel) as ContentId
  const brief = assembleContentBrief({ id: stable("brief", identityRunId, postKey, channel) as ContentBrief["id"], weeklyPlanId: run.payload.plan.id,
    weeklyContentDirectionId: direction.id, contentId, audienceDirection: direction.audienceDirection, evidenceReferences: usedProofs.map(p => ({ evidenceKey: p.key, evidenceId: p.source.evidenceId as never })), createdAt,
    proposal: { communicationJob: post.brief.job, keyTakeaway: post.brief.takeaway, supportingPoints: post.brief.points,
      evidenceMode: proofRequired ? "proofRequired" : usedProofs.length ? "evidenceSupported" : "noProofNeeded", evidenceKeys: usedProofs.map(p => p.key), ctaIntent: "none", constraints: [], mustNotSay: post.brief.mustNotSay, rationale: post.why } })
  const draftFormat = format(post.format)
  const executionSpec = assembleContentExecutionSpecs({ contentBriefId: brief.id, eligibleChannels: [SOCIAL_CHANNELS[channel]],
    eligibleContentModes: [contentMode], createdAt, specs: [{ id: stable("execution", identityRunId, postKey, channel) as ContentExecutionSpec["id"],
      proposal: { channel: SOCIAL_CHANNELS[channel], contentMode, format: draftFormat, depth: "standard",
        visualDependency: post.format === "text" ? "none" : "essential", executionGuidance: [post.why, post.visual.description].filter(Boolean),
        constraints: post.brief.mustNotSay, rationale: post.channels.find((candidate) => candidate.channel === channel)!.reason } }] })[0]!
  const draft = assembleSocialContentDraft({ id: stable("draft", identityRunId, postKey, channel) as never, contentId, contentBriefId: brief.id,
    contentExecutionSpecId: executionSpec.id, format: draftFormat, version: 1, locale: run.payload.basis.payload.input.language as never, createdAt,
    proposal: { text: draftFormat === "staticPost" ? variant.caption : null,
      caption: draftFormat === "carousel" || draftFormat === "reel" ? variant.caption || null : null,
      frames: draftFormat === "carousel" || draftFormat === "story" ? variant.frames.map((frame) => ({ heading: frame.heading || null, body: frame.body })) : [],
      script: draftFormat === "reel" ? variant.script : null, onScreenText: draftFormat === "reel" ? variant.onScreenText : [] } })
  return { id: stable("input", identityRunId, postKey, channel), brandId: run.brandId, sourceWeeklyRunId: run.id, postKey, channel,
    contentId: draft.contentId, contentBriefId: brief.id, contentExecutionSpecId: executionSpec.id, draftId: draft.id,
    draftVersion: draft.version, ...encodeSocialPublicationBundle({ contentBrief: brief, contentExecutionSpec: executionSpec, draft,
      weeklyReview, reviewedPost: { key: postKey, outline: post, copy },
      approval: { id: stable("review-decision", identityRunId, postKey, channel), requestId: stable("review-request", identityRunId, postKey, channel), actorId: posts.approvedByUserId, approvedAt: posts.approvedAt, runId: run.id, runVersion: run.version, draftDigest: reviewDigest(draft), binding, executionDigest: reviewDigest(executionSpec), briefDigest: reviewDigest(brief) } }) }
}
