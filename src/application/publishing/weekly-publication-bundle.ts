import type { ContentBrief, ContentExecutionSpec, SocialContentDraft, SocialContentSchedulingEligibility } from "../../blueprints/social"
import { projectSocialContentDraftText } from "../../blueprints/social"
import { validateFactualReferences } from "../../blueprints/social/public-knowledge"
import { SOCIAL_CONTENT_MODES } from "../../blueprints/social/tokens"
import type { PostCopy, PostOutline } from "../../blueprints/social/weekly-planning/posts"
import { POST_EDITORIAL_DIMENSIONS } from "../../blueprints/social/weekly-planning/post-editorial"
import { validatePostContentMode } from "../../blueprints/social/weekly-planning/post-mode"
import { validatePostCopy } from "../../blueprints/social/weekly-planning/posts"
import { validateVariantOperatingRules } from "../../blueprints/social/weekly-planning/post-context"
import { weeklyReviewBlocker } from "../weekly-planning/review-policy"
import type { HistoricalWeeklyPostReviewEvidence, WeeklyApprovalEvidence, WeeklyPostReviewEvidence } from "../../blueprints/social/weekly-planning/review-evidence"
import { reviewDigest, reviewedPostDigest } from "../weekly-planning/review-evidence"

export type SocialPublicationBundleV2 = {
  contentBrief: ContentBrief
  contentExecutionSpec: ContentExecutionSpec
  draft: SocialContentDraft
  weeklyReview: HistoricalWeeklyPostReviewEvidence
  reviewedPost: { key: string; outline: PostOutline; copy: PostCopy }
  approval: { id: string; requestId: string; actorId: string; approvedAt: string; runId: string; runVersion: number; draftDigest: string }
}
export type SocialPublicationBundleV3 = Omit<SocialPublicationBundleV2, "weeklyReview" | "approval"> & {
  weeklyReview: Extract<WeeklyPostReviewEvidence, { version: 2 }>
  approval: SocialPublicationBundleV2["approval"] & { binding: WeeklyApprovalEvidence; executionDigest: string; briefDigest: string }
}
export type SocialPublicationBundleV4=SocialPublicationBundleV3 & {postRevision:{id:string;stablePostId:string;version:number;postKey:string;channel:'facebook'|'instagram';parentRevisionId:string|null;baseApprovalId:string;baseDigest:string;before:PostCopy}}
export function validatePostRevisionPublicationBundle(value:unknown):SocialPublicationBundleV4 {
 if(!value||typeof value!=='object'||Array.isArray(value))throw Error('Invalid post revision bundle')
 const {postRevision,...base}=value as SocialPublicationBundleV4
 const b=validateCurrentWeeklyPublicationBundle(base)
 if(!postRevision||Object.keys(postRevision).sort().join(',')!=='baseApprovalId,baseDigest,before,channel,id,parentRevisionId,postKey,stablePostId,version'
 ||!text(postRevision.id)||!text(postRevision.stablePostId)||!text(postRevision.baseApprovalId)||!digest(postRevision.baseDigest)
 ||(postRevision.parentRevisionId!==null&&!text(postRevision.parentRevisionId))||!Number.isSafeInteger(postRevision.version)||postRevision.version<2
 ||postRevision.version!==b.draft.version||postRevision.postKey!==b.reviewedPost.key||postRevision.channel!==b.contentExecutionSpec.channel
 ||postRevision.baseApprovalId===b.approval.binding.id||!postRevision.before||!Array.isArray(postRevision.before.variants)
 ||postRevision.before.variants.length!==b.reviewedPost.copy.variants.length
 ||postRevision.before.variants.some(v=>v.channel!==postRevision.channel&&reviewDigest(v)!==reviewDigest(b.reviewedPost.copy.variants.find(next=>next.channel===v.channel)))) throw Error('Post revision lineage or scope differs')
 return {...b,postRevision:structuredClone(postRevision)}
}
const text = (value: unknown) => typeof value === "string" && value.trim().length > 0
const digest = (value: unknown) => typeof value === "string" && /^[a-f0-9]{64}$/u.test(value)
const date = (value: unknown) => typeof value === "string" && Number.isFinite(Date.parse(value))

/** Weekly model reviews are represented honestly; no empty core scanner/evaluation audit is invented. */
function validateBundle(value: unknown, modern: boolean): SocialPublicationBundleV2 | SocialPublicationBundleV3 {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw Error("Invalid weekly publication bundle")
  const b = value as SocialPublicationBundleV2 | SocialPublicationBundleV3
  const allowed = ["contentBrief", "contentExecutionSpec", "draft", "weeklyReview", "reviewedPost", "approval"]
  if (Object.keys(b).length !== allowed.length || Object.keys(b).some(k => !allowed.includes(k))) throw Error("Invalid weekly publication fields")
  const { contentBrief: brief, contentExecutionSpec: spec, draft, weeklyReview: r, reviewedPost: p, approval: a } = b
  if (!brief || !spec || !draft || !r || !p || !a || !text(brief.id) || !text(spec.id) || !text(draft.id)
    || brief.id !== spec.contentBriefId || draft.contentBriefId !== brief.id || draft.contentExecutionSpecId !== spec.id || brief.contentId !== draft.contentId
    || draft.format !== spec.format || !Object.values(SOCIAL_CONTENT_MODES).includes(spec.contentMode) || !["facebook", "instagram"].includes(spec.channel) || !["ka", "en"].includes(draft.locale)
    || !Number.isSafeInteger(draft.version) || draft.version < 1) throw Error("Invalid weekly publication lineage")
  projectSocialContentDraftText(draft)
  if (r.version !== (modern ? 2 : 1) || !text(r.runId) || !Number.isSafeInteger(r.runVersion) || r.runVersion < 1 || !date(r.reviewedAt) || !digest(r.contextDigest)
    || !/^p([1-9]|10)$/u.test(p.key) || !p.outline || !p.copy || !r.postDigests || r.postDigests[p.key] !== reviewedPostDigest(p.outline, p.copy)) throw Error("Weekly review does not match content")
  if (!Array.isArray(r.modelRuns) || r.modelRuns.length !== 2 || new Set(r.modelRuns.map(m => m.id)).size !== 2
    || ["post_review", "post_editorial"].some(step => r.modelRuns.filter(m => m.step === step && text(m.id) && text(m.model) && text(m.promptVersion) && digest(m.inputHash)).length !== 1)) throw Error("Missing actual review model provenance")
  if (!r.safety || !text(r.safety.summary) || !Array.isArray(r.safety.issues) || r.safety.issues.some(i => i.severity !== "advisory" || !text(i.message) || !r.postDigests[i.postKey])
    || !r.editorial || !Array.isArray(r.editorial.posts) || r.editorial.posts.length !== Object.keys(r.postDigests).length
    || new Set(r.editorial.posts.map(e => e.postKey)).size !== r.editorial.posts.length
    || r.editorial.posts.some(e => !r.postDigests[e.postKey] || !Array.isArray(e.dimensions) || e.dimensions.length !== POST_EDITORIAL_DIMENSIONS.length
      || POST_EDITORIAL_DIMENSIONS.some(d => e.dimensions.filter(v => v.dimension === d && ["strong", "acceptable"].includes(v.rating) && text(v.note)).length !== 1)
      || !Array.isArray(e.issues) || e.issues.length > 0)) throw Error("Weekly review is incomplete or blocking")
  if (validateFactualReferences(r.publicKnowledge, p.outline.factKeys ?? [], p.copy.factualReferences).length) throw Error("Publication factual authority is invalid")
  const variant = p.copy.variants.find(v => v.channel === spec.channel)
  if (!variant || p.copy.variants.filter(v => v.channel === spec.channel).length !== 1 || !p.outline.channels.some(c => c.channel === spec.channel)) throw Error("Reviewed channel is missing")
  const format = p.outline.format === "text" || p.outline.format === "image" ? "staticPost" : p.outline.format
  const frames = variant.frames.map(f => ({ heading: f.heading?.trim() || null, body: f.body.trim() }))
  const expected = format === "staticPost" ? { text: variant.caption.trim() } : format === "carousel" ? { caption: variant.caption.trim() || null, frames } : format === "story" ? { frames } : { caption: variant.caption || null, script: variant.script.trim(), onScreenText: variant.onScreenText.map(t => t.trim()) }
  const actual = draft.format === "staticPost" ? { text: draft.text } : draft.format === "carousel" ? { caption: draft.caption ?? null, frames: draft.frames.map(f => ({ heading: f.heading ?? null, body: f.body })) } : draft.format === "story" ? { frames: draft.frames.map(f => ({ heading: f.heading ?? null, body: f.body })) } : { caption: draft.caption ?? null, script: draft.script, onScreenText: draft.onScreenText }
  if (format !== draft.format || reviewDigest(expected) !== reviewDigest(actual)) throw Error("Draft differs from reviewed variant")
  if (!text(a.id) || !text(a.requestId) || !text(a.actorId) || !date(a.approvedAt) || Date.parse(a.approvedAt) < Date.parse(r.reviewedAt)
    || a.runId !== r.runId || a.runVersion !== r.runVersion || a.draftDigest !== reviewDigest(draft)) throw Error("Approval differs from reviewed draft")
  if (modern) {
    const current = b as SocialPublicationBundleV3, review = current.weeklyReview, approval = current.approval, binding = approval.binding
    const c = review.context
    const usedProofs = review.publicKnowledge?.proofs.filter(proof => p.copy.factualReferences?.proofKeys.includes(proof.key)) ?? []
    const proofRequired = spec.contentMode === SOCIAL_CONTENT_MODES.proofLed || (review.publicKnowledge?.facts.some(fact =>
      p.copy.factualReferences?.factKeys.includes(fact.key) && fact.permission === "publicUseWithProof") ?? false)
    if (brief.communicationJob !== p.outline.brief.job || brief.keyTakeaway !== p.outline.brief.takeaway
      || reviewDigest(brief.supportingPoints) !== reviewDigest(p.outline.brief.points) || reviewDigest(brief.mustNotSay) !== reviewDigest(p.outline.brief.mustNotSay)
      || brief.rationale !== p.outline.why || brief.ctaIntent !== "none" || brief.constraints.length
      || brief.evidenceMode !== (proofRequired ? "proofRequired" : usedProofs.length ? "evidenceSupported" : "noProofNeeded")
      || reviewDigest(brief.evidenceIds) !== reviewDigest(usedProofs.map(proof => proof.source.evidenceId))) throw Error("Brief differs from reviewed task or actual evidence")
    if (weeklyReviewBlocker(review) || !c || !text(c.basisId) || !Number.isSafeInteger(c.basisRevision) || c.basisRevision < 1
      || c.language !== draft.locale || !Array.isArray(c.operatingRules) || !Number.isSafeInteger(review.repairCount) || review.repairCount < 0
      || !digest(review.batchDigest) || review.contextDigest !== reviewDigest({ ...c, publicKnowledge: review.publicKnowledge })
      || review.postModes[p.key] !== spec.contentMode || p.outline.contentMode !== spec.contentMode
      || validatePostContentMode(p.outline, review.publicKnowledge, p.copy).length || validatePostCopy(p.copy, p.outline).length
      || p.copy.variants.some(v => validateVariantOperatingRules(v, c.operatingRules).length)) throw Error("Weekly execution mode or policy differs from reviewed content")
    if (!binding || binding.version !== 1 || !text(binding.id) || binding.actorId !== a.actorId || binding.approvedAt !== a.approvedAt
      || binding.runId !== a.runId || binding.runVersion !== a.runVersion || binding.reviewDigest !== reviewDigest(review)
      || binding.batchDigest !== review.batchDigest || approval.executionDigest !== reviewDigest(spec) || approval.briefDigest !== reviewDigest(brief)) throw Error("Approval binding differs from reviewed execution")
  }
  return structuredClone(b)
}
export const validateWeeklyPublicationBundle = (value: unknown) => validateBundle(value, false) as SocialPublicationBundleV2
export const validateCurrentWeeklyPublicationBundle = (value: unknown) => validateBundle(value, true) as SocialPublicationBundleV3
export function weeklyPublicationEligibility(bundle: SocialPublicationBundleV2 | SocialPublicationBundleV3 | SocialPublicationBundleV4): SocialContentSchedulingEligibility {
  const b = "postRevision" in bundle ? validatePostRevisionPublicationBundle(bundle) : bundle.weeklyReview.version === 2 ? validateCurrentWeeklyPublicationBundle(bundle) : validateWeeklyPublicationBundle(bundle)
  return { eligible: true, contentId: b.draft.contentId, draftId: b.draft.id, draftVersion: b.draft.version,
    authorization: { type: "humanApproved", reviewRequestId: b.approval.requestId as never, reviewDecisionId: b.approval.id as never } }
}
