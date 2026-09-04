import type { ContentMode, EditorialQualityDimension } from "../../core/domain"
import { SOCIAL_CONTENT_MODES } from "./tokens"

export type SocialQualityPolicy = {
  readonly contentMode: ContentMode
  readonly dimensions: readonly EditorialQualityDimension[]
}

const standardDimensions = [
  "taskFit",
  "brandFidelity",
  "specificity",
  "nonGenericity",
  "clarity",
  "structure",
  "channelFit",
  "creativeStrength",
] as const satisfies readonly EditorialQualityDimension[]

export const SOCIAL_QUALITY_POLICIES = [
  { contentMode: SOCIAL_CONTENT_MODES.brandStory, dimensions: standardDimensions },
  { contentMode: SOCIAL_CONTENT_MODES.educational, dimensions: standardDimensions },
  {
    contentMode: SOCIAL_CONTENT_MODES.serviceExplainer,
    dimensions: [...standardDimensions, "CTAQuality"],
  },
  { contentMode: SOCIAL_CONTENT_MODES.trustBuilder, dimensions: standardDimensions },
  { contentMode: SOCIAL_CONTENT_MODES.proofLed, dimensions: standardDimensions },
  {
    contentMode: SOCIAL_CONTENT_MODES.directOffer,
    dimensions: [...standardDimensions, "CTAQuality"],
  },
] as const satisfies readonly SocialQualityPolicy[]

export function getSocialQualityPolicy(
  contentMode: ContentMode,
): SocialQualityPolicy | undefined {
  return SOCIAL_QUALITY_POLICIES.find((policy) => policy.contentMode === contentMode)
}
