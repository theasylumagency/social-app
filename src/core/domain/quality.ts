import type { ContentId, EditorialQualityIssueType, TaskId } from "./primitives"
import type {
  AudienceContext,
  ContentDirectionContext,
  VoiceContext,
} from "./generation"

export type EditorialQualityDimension =
  | "taskFit"
  | "brandFidelity"
  | "specificity"
  | "nonGenericity"
  | "clarity"
  | "structure"
  | "channelFit"
  | "creativeStrength"
  | "CTAQuality"

export type EditorialQualityRating = "strong" | "acceptable" | "weak"

export type EditorialQualityIssue = {
  readonly type: EditorialQualityIssueType
  readonly dimension: EditorialQualityDimension
  readonly note: string
}

export type EditorialQualityResult = {
  readonly status: "pass" | "revise"
  readonly dimensions: readonly {
    readonly dimension: EditorialQualityDimension
    readonly rating: EditorialQualityRating
    readonly note?: string
  }[]
  readonly issues: readonly EditorialQualityIssue[]
  readonly repairInstructions?: readonly string[]
}

export type RecentContentFingerprint = {
  readonly contentId: ContentId
  readonly topicKey?: string
  readonly hookKey?: string
  readonly structureKey?: string
  readonly normalizedSummary?: string
}

export type PositioningContext = { readonly value: unknown }

export type EditorialReference = {
  readonly text: string
  readonly purpose?: string
}

export type EditorialQualityContext = {
  readonly taskId: TaskId
  readonly voice?: VoiceContext
  readonly audience?: AudienceContext
  readonly positioning?: PositioningContext
  readonly contentDirection?: ContentDirectionContext
  readonly references: readonly EditorialReference[]
  readonly recentContent: readonly RecentContentFingerprint[]
}
