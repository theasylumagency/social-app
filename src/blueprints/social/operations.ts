import type {
  CapabilityRequirement,
  ClaimContextChannel,
  ContentMode,
  TaskType,
} from "../../core/domain"
import {
  SOCIAL_CAPABILITIES,
  SOCIAL_CHANNELS,
  SOCIAL_CONTENT_MODES,
  SOCIAL_TASK_TYPES,
} from "./tokens"

export type SocialTaskPolicy = {
  readonly taskType: TaskType
  readonly requirements: readonly CapabilityRequirement[]
}

export const SOCIAL_TASK_POLICIES = [
  {
    taskType: SOCIAL_TASK_TYPES.buildBrandBrain,
    requirements: [
      { capability: SOCIAL_CAPABILITIES.sourceMaterial, criticality: "required" },
    ],
  },
  {
    taskType: SOCIAL_TASK_TYPES.planWeeklyContent,
    requirements: [
      { capability: SOCIAL_CAPABILITIES.usableOffer, criticality: "required" },
      { capability: SOCIAL_CAPABILITIES.contentLanguage, criticality: "required" },
      { capability: SOCIAL_CAPABILITIES.usableVoice, criticality: "required" },
      { capability: SOCIAL_CAPABILITIES.audienceContext, criticality: "preferred" },
      { capability: SOCIAL_CAPABILITIES.contentDirection, criticality: "preferred" },
    ],
  },
  {
    taskType: SOCIAL_TASK_TYPES.generateContent,
    requirements: [
      { capability: SOCIAL_CAPABILITIES.usableOffer, criticality: "required" },
      { capability: SOCIAL_CAPABILITIES.contentLanguage, criticality: "required" },
      { capability: SOCIAL_CAPABILITIES.usableVoice, criticality: "required" },
      { capability: SOCIAL_CAPABILITIES.audienceContext, criticality: "preferred" },
      { capability: SOCIAL_CAPABILITIES.contentDirection, criticality: "preferred" },
    ],
  },
  {
    taskType: SOCIAL_TASK_TYPES.reviewContent,
    requirements: [
      { capability: SOCIAL_CAPABILITIES.generatedDraft, criticality: "required" },
      { capability: SOCIAL_CAPABILITIES.eligibleProof, criticality: "preferred" },
    ],
  },
  {
    taskType: SOCIAL_TASK_TYPES.scheduleContent,
    requirements: [
      { capability: SOCIAL_CAPABILITIES.approvedContent, criticality: "required" },
      { capability: SOCIAL_CAPABILITIES.scheduledPublishTime, criticality: "required" },
    ],
  },
  {
    taskType: SOCIAL_TASK_TYPES.publishContent,
    requirements: [
      { capability: SOCIAL_CAPABILITIES.approvedContent, criticality: "required" },
      {
        capability: SOCIAL_CAPABILITIES.connectedPublishingAccount,
        criticality: "required",
      },
    ],
  },
] as const satisfies readonly SocialTaskPolicy[]

export type SocialContentModeRisk = "low" | "moderate" | "high"

export type SocialContentModePolicy = {
  readonly mode: ContentMode
  readonly risk: SocialContentModeRisk
  readonly requirements: readonly CapabilityRequirement[]
}

export const SOCIAL_CONTENT_MODE_POLICIES = [
  {
    mode: SOCIAL_CONTENT_MODES.brandStory,
    risk: "moderate",
    requirements: [
      { capability: SOCIAL_CAPABILITIES.usableVoice, criticality: "required" },
    ],
  },
  {
    mode: SOCIAL_CONTENT_MODES.educational,
    risk: "low",
    requirements: [
      { capability: SOCIAL_CAPABILITIES.contentLanguage, criticality: "required" },
      { capability: SOCIAL_CAPABILITIES.usableVoice, criticality: "required" },
    ],
  },
  {
    mode: SOCIAL_CONTENT_MODES.serviceExplainer,
    risk: "moderate",
    requirements: [
      { capability: SOCIAL_CAPABILITIES.publicOfferFacts, criticality: "required" },
    ],
  },
  {
    mode: SOCIAL_CONTENT_MODES.trustBuilder,
    risk: "moderate",
    requirements: [
      { capability: SOCIAL_CAPABILITIES.usableVoice, criticality: "required" },
      { capability: SOCIAL_CAPABILITIES.audienceContext, criticality: "preferred" },
    ],
  },
  {
    mode: SOCIAL_CONTENT_MODES.proofLed,
    risk: "high",
    requirements: [
      { capability: SOCIAL_CAPABILITIES.eligibleProof, criticality: "required" },
    ],
  },
  {
    mode: SOCIAL_CONTENT_MODES.directOffer,
    risk: "high",
    requirements: [
      { capability: SOCIAL_CAPABILITIES.publicOfferFacts, criticality: "required" },
      { capability: SOCIAL_CAPABILITIES.eligibleProof, criticality: "preferred" },
    ],
  },
] as const satisfies readonly SocialContentModePolicy[]

export type SocialContentFormat = "staticPost" | "carousel" | "story" | "reel"

export type SocialChannelPolicy = {
  readonly channel: ClaimContextChannel
  readonly supportedFormats: readonly SocialContentFormat[]
  readonly supportedModes: readonly ContentMode[]
  readonly connectedAccountRequiredForPublishing: boolean
}

const allContentModes = Object.values(SOCIAL_CONTENT_MODES)

export const SOCIAL_CHANNEL_POLICIES = [
  {
    channel: SOCIAL_CHANNELS.facebook,
    supportedFormats: ["staticPost", "carousel", "story", "reel"],
    supportedModes: allContentModes,
    connectedAccountRequiredForPublishing: true,
  },
  {
    channel: SOCIAL_CHANNELS.instagram,
    supportedFormats: ["staticPost", "carousel", "story", "reel"],
    supportedModes: allContentModes,
    connectedAccountRequiredForPublishing: true,
  },
] as const satisfies readonly SocialChannelPolicy[]

export function getSocialTaskPolicy(taskType: TaskType): SocialTaskPolicy | undefined {
  return SOCIAL_TASK_POLICIES.find((policy) => policy.taskType === taskType)
}
