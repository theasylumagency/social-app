import type { PostsReview, PostsPayload } from "../src/blueprints/social/weekly-planning/posts"
import { applyPostReview } from "../src/blueprints/social/weekly-planning/posts"
import type { SocialContentPublishEligibility } from "../src/blueprints/social/content-publish-eligibility"
import type { ShadowObservationRecord, SemanticDecisionResult } from "../src/blueprints/social/semantic-middleware/shadow"
import { projectSemanticFactMatches, projectSemanticSafetyReview } from "../src/blueprints/social/semantic-middleware/projections"

declare const provider: SemanticDecisionResult
declare const shadow: ShadowObservationRecord
declare const payload: PostsPayload
// @ts-expect-error Raw provider probability output is not a Safety/approval review.
const review: PostsReview = provider
// @ts-expect-error Raw provider results cannot become publication eligibility.
const publication: SocialContentPublishEligibility = provider
// @ts-expect-error Shadow envelope is not review/repair feedback.
applyPostReview(payload, shadow)
// @ts-expect-error Even structurally valid shadow payloads are not branded consumer inputs.
projectSemanticSafetyReview(shadow.observation)
// @ts-expect-error Phase 7C does not expose the structural brand to matching/decision code.
projectSemanticFactMatches(shadow.observation)
