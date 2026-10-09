import { validateWeeklyPublicationBundle, validateCurrentWeeklyPublicationBundle, validatePostRevisionPublicationBundle, type SocialPublicationBundleV4, type SocialPublicationBundleV2, type SocialPublicationBundleV3 } from "./weekly-publication-bundle"
import type {
  ContentBrief, ContentExecutionSpec, SocialContentDraft, SocialContentDraftEvaluationAudit,
  SocialContentReviewDecision, SocialContentReviewRequest,
} from "../../blueprints/social"
import { projectSocialContentDraftText, resolveSocialContentSchedulingEligibility } from "../../blueprints/social"
import { SOCIAL_CONTENT_MODES } from "../../blueprints/social/tokens"

export const SOCIAL_PUBLICATION_BUNDLE_SCHEMA = "unda.social-publication-input" as const
export const SOCIAL_PUBLICATION_BUNDLE_VERSION = 4 as const

export type SocialPublicationBundleV1 = {
  readonly contentBrief: ContentBrief
  readonly contentExecutionSpec: ContentExecutionSpec
  readonly draft: SocialContentDraft
  readonly evaluationAudit: SocialContentDraftEvaluationAudit
  readonly reviewRequest: SocialContentReviewRequest
  readonly reviewDecision: SocialContentReviewDecision
}

const object = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Publication bundle must be an object")
  return value as Record<string, unknown>
}
const requiredText = (value: unknown, label: string) => {
  if (typeof value !== "string" || !value.trim()) throw new Error(`Publication bundle ${label} is invalid`)
  return value
}

function validateV1(value: unknown): SocialPublicationBundleV1 {
  const bundle = object(value)
  const allowed = new Set(["contentBrief", "contentExecutionSpec", "draft", "evaluationAudit", "reviewRequest", "reviewDecision"])
  if (Object.keys(bundle).some((key) => !allowed.has(key)) || Object.keys(bundle).length !== allowed.size) throw new Error("Publication bundle fields are invalid")
  const brief = object(bundle.contentBrief) as ContentBrief & Record<string, unknown>
  const spec = object(bundle.contentExecutionSpec) as ContentExecutionSpec & Record<string, unknown>
  const draft = object(bundle.draft) as SocialContentDraft & Record<string, unknown>
  const audit = object(bundle.evaluationAudit) as SocialContentDraftEvaluationAudit & Record<string, unknown>
  const reviewRequest = object(bundle.reviewRequest) as SocialContentReviewRequest & Record<string, unknown>
  const reviewDecision = object(bundle.reviewDecision) as SocialContentReviewDecision & Record<string, unknown>
  for (const [label, item] of [["brief ID", brief.id], ["execution spec ID", spec.id], ["draft ID", draft.id],
    ["audit ID", audit.id], ["review request ID", reviewRequest.id], ["review decision ID", reviewDecision.id]] as const) requiredText(item, label)
  if (!Object.values(SOCIAL_CONTENT_MODES).includes(spec.contentMode) || !["facebook", "instagram"].includes(spec.channel)
    || !["staticPost", "carousel", "story", "reel"].includes(spec.format)) throw new Error("Publication bundle execution spec is invalid")
  projectSocialContentDraftText(draft)
  const eligibility = resolveSocialContentSchedulingEligibility({ draft, evaluationAudit: audit, contentExecutionSpec: spec,
    approvalPolicy: { mode: "reviewRequired" }, reviewRequest, reviewDecision })
  if (!eligibility.eligible || reviewDecision.decision !== "approved" || brief.id !== draft.contentBriefId
    || brief.id !== spec.contentBriefId || brief.contentId !== draft.contentId) {
    throw new Error("Publication bundle lineage or approval is invalid")
  }
  return structuredClone({ contentBrief: brief, contentExecutionSpec: spec, draft, evaluationAudit: audit, reviewRequest, reviewDecision })
}

export type SocialPublicationBundle = SocialPublicationBundleV1 | SocialPublicationBundleV2 | SocialPublicationBundleV3 | SocialPublicationBundleV4

export function encodeSocialPublicationBundle(bundle: SocialPublicationBundleV4): { schema: typeof SOCIAL_PUBLICATION_BUNDLE_SCHEMA; version: 4; bundle: SocialPublicationBundleV4 }
export function encodeSocialPublicationBundle(bundle: SocialPublicationBundleV3): { schema: typeof SOCIAL_PUBLICATION_BUNDLE_SCHEMA; version: 3; bundle: SocialPublicationBundleV3 }
export function encodeSocialPublicationBundle(bundle: SocialPublicationBundleV2): { schema: typeof SOCIAL_PUBLICATION_BUNDLE_SCHEMA; version: 2; bundle: SocialPublicationBundleV2 }
export function encodeSocialPublicationBundle(bundle: SocialPublicationBundleV1): { schema: typeof SOCIAL_PUBLICATION_BUNDLE_SCHEMA; version: 1; bundle: SocialPublicationBundleV1 }
export function encodeSocialPublicationBundle(bundle: SocialPublicationBundle) {
  if ("postRevision" in bundle) return {schema:SOCIAL_PUBLICATION_BUNDLE_SCHEMA,version:4 as const,bundle:validatePostRevisionPublicationBundle(bundle)}
  if ("weeklyReview" in bundle && bundle.weeklyReview.version === 2) return { schema: SOCIAL_PUBLICATION_BUNDLE_SCHEMA, version: 3 as const, bundle: validateCurrentWeeklyPublicationBundle(bundle) }
  if ("weeklyReview" in bundle) return { schema: SOCIAL_PUBLICATION_BUNDLE_SCHEMA, version: 2 as const, bundle: validateWeeklyPublicationBundle(bundle) }
  return { schema: SOCIAL_PUBLICATION_BUNDLE_SCHEMA, version: 1 as const, bundle: validateV1(bundle) }
}

export function decodeSocialPublicationBundle(schema: string, version: number, value: unknown): SocialPublicationBundle {
  if (schema !== SOCIAL_PUBLICATION_BUNDLE_SCHEMA || ![1, 2, 3, 4].includes(version)) throw new Error("publicationBundleUnsupportedVersion")
  return version === 4 ? validatePostRevisionPublicationBundle(value) : version === 3 ? validateCurrentWeeklyPublicationBundle(value) : version === 2 ? validateWeeklyPublicationBundle(value) : validateV1(value)
}
