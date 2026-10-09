import type { SocialPublicationBundle } from "./publication-bundle-codec"
import { currentFactualBlocker, postAuthorityReferences, type PublicKnowledgeSnapshot } from "../../blueprints/social/public-knowledge"
export class PublicFactHoldError extends Error {}
export function publicationFactualBlocker(bundle: SocialPublicationBundle, current: PublicKnowledgeSnapshot, now: string) {
  if (!("weeklyReview" in bundle)) return null
  return currentFactualBlocker(bundle.weeklyReview.publicKnowledge, postAuthorityReferences(bundle.reviewedPost.outline, bundle.reviewedPost.copy, bundle.weeklyReview.publicKnowledge), current, now)
}
