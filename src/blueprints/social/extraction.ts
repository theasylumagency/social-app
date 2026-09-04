import type { SourceKind } from "../../core/domain"
import { SOCIAL_SOURCE_KINDS } from "./tokens"

export const SOCIAL_SEMANTIC_DOMAINS = [
  "identity",
  "offer",
  "audience",
  "positioning",
  "voice",
  "content",
  "proof",
  "constraints",
  "visual",
  "businessFacts",
] as const

export type SocialSemanticDomain = (typeof SOCIAL_SEMANTIC_DOMAINS)[number]
export type SocialCorpusAnalysisMode = "none" | "singleItem" | "aggregate"

export type SocialExtractionProfile = {
  readonly id: string
  readonly sourceKind: SourceKind
  readonly semanticDomains: readonly [SocialSemanticDomain, ...SocialSemanticDomain[]]
  readonly corpusAnalysis: SocialCorpusAnalysisMode
}

export const SOCIAL_EXTRACTION_PROFILES = [
  {
    id: "social.website.v1",
    sourceKind: SOCIAL_SOURCE_KINDS.website,
    semanticDomains: [
      "identity",
      "offer",
      "audience",
      "positioning",
      "proof",
      "constraints",
      "visual",
      "businessFacts",
    ],
    corpusAnalysis: "none",
  },
  {
    id: "social.facebook-page.v1",
    sourceKind: SOCIAL_SOURCE_KINDS.facebookPage,
    semanticDomains: [
      "identity",
      "offer",
      "audience",
      "positioning",
      "voice",
      "content",
      "proof",
      "visual",
      "businessFacts",
    ],
    corpusAnalysis: "aggregate",
  },
  {
    id: "social.instagram-account.v1",
    sourceKind: SOCIAL_SOURCE_KINDS.instagramAccount,
    semanticDomains: [
      "identity",
      "offer",
      "audience",
      "positioning",
      "voice",
      "content",
      "proof",
      "visual",
      "businessFacts",
    ],
    corpusAnalysis: "aggregate",
  },
  {
    id: "social.uploaded-document.v1",
    sourceKind: SOCIAL_SOURCE_KINDS.uploadedDocument,
    semanticDomains: [
      "identity",
      "offer",
      "audience",
      "positioning",
      "voice",
      "content",
      "proof",
      "constraints",
      "visual",
      "businessFacts",
    ],
    corpusAnalysis: "singleItem",
  },
  {
    id: "social.manual-input.v1",
    sourceKind: SOCIAL_SOURCE_KINDS.manualInput,
    semanticDomains: [
      "identity",
      "offer",
      "audience",
      "positioning",
      "voice",
      "content",
      "proof",
      "constraints",
      "businessFacts",
    ],
    corpusAnalysis: "none",
  },
] as const satisfies readonly SocialExtractionProfile[]

export function getSocialExtractionProfile(
  sourceKind: SourceKind,
): SocialExtractionProfile | undefined {
  return SOCIAL_EXTRACTION_PROFILES.find((profile) => profile.sourceKind === sourceKind)
}
