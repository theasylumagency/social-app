declare const domainType: unique symbol

export type DomainScalar<Value, Name extends string> = Value & {
  readonly [domainType]: Name
}

export type DomainId<Name extends string> = DomainScalar<string, Name>

// Persistent IDs
export type BrandId = DomainId<"BrandId">
export type SourceId = DomainId<"SourceId">
export type SourceSnapshotId = DomainId<"SourceSnapshotId">
export type SourceArtifactId = DomainId<"SourceArtifactId">
export type EvidenceId = DomainId<"EvidenceId">
export type KnowledgeClaimId = DomainId<"KnowledgeClaimId">
export type BusinessFactId = DomainId<"BusinessFactId">
export type ProofId = DomainId<"ProofId">
export type FounderDecisionId = DomainId<"FounderDecisionId">
export type HypothesisId = DomainId<"HypothesisId">
export type ConflictId = DomainId<"ConflictId">
export type CorpusId = DomainId<"CorpusId">
export type CorpusPatternId = DomainId<"CorpusPatternId">
export type TaskId = DomainId<"TaskId">
export type ContentId = DomainId<"ContentId">
export type ReviewItemId = DomainId<"ReviewItemId">

// Time / immutable capture
export type IsoDate = DomainScalar<string, "IsoDate">
export type IsoDateTime = DomainScalar<string, "IsoDateTime">
export type ContentHash = DomainScalar<string, "ContentHash">

// Registry-backed tokens
export type SourceKind = DomainScalar<string, "SourceKind">
export type KnowledgePath = DomainScalar<string, "KnowledgePath">
export type ProofType = DomainScalar<string, "ProofType">
export type BusinessFactType = DomainScalar<string, "BusinessFactType">
export type CorpusPatternType = DomainScalar<string, "CorpusPatternType">
export type ContentMode = DomainScalar<string, "ContentMode">
export type TaskType = DomainScalar<string, "TaskType">
export type Capability = DomainScalar<string, "Capability">
export type BlockedOperation = DomainScalar<string, "BlockedOperation">
export type FallbackStrategy = DomainScalar<string, "FallbackStrategy">
export type OperatingNoteCode = DomainScalar<string, "OperatingNoteCode">
export type FounderDecisionType = DomainScalar<string, "FounderDecisionType">
export type ReviewActionType = DomainScalar<string, "ReviewActionType">
export type PublicFactKey = DomainScalar<string, "PublicFactKey">
export type PublicClaimKey = DomainScalar<string, "PublicClaimKey">
export type GuidanceKey = DomainScalar<string, "GuidanceKey">
export type LearnedPreferenceKey = DomainScalar<string, "LearnedPreferenceKey">
export type GenerationConstraintType = DomainScalar<string, "GenerationConstraintType">
export type ClaimSignalType = DomainScalar<string, "ClaimSignalType">
export type ValidationIssueType = DomainScalar<string, "ValidationIssueType">
export type EditorialQualityIssueType = DomainScalar<string, "EditorialQualityIssueType">

// Knowledge-context tokens
export type ClaimContextChannel = DomainScalar<string, "ClaimContextChannel">
export type ClaimContextAudience = DomainScalar<string, "ClaimContextAudience">
export type ClaimContextLocale = DomainScalar<string, "ClaimContextLocale">
export type ClaimContextScope = DomainScalar<string, "ClaimContextScope">

// Canonical vocabulary
export type EvidenceStrength = "weak" | "medium" | "strong"

export type SourceClaimMode = "explicit" | "implicit" | "derived"

export type EpistemicStatus =
  | "observed"
  | "inferred"
  | "hypothesis"
  | "confirmed"

export type GenerationPermission =
  | "internalGuidance"
  | "publicUse"
  | "publicUseWithProof"
  | "blocked"

export type PriorityBand = "low" | "medium" | "high"

export type ConfidenceScore = DomainScalar<number, "ConfidenceScore">
export type PriorityScore = DomainScalar<number, "PriorityScore">

function createScore<Name extends "ConfidenceScore" | "PriorityScore">(
  value: number,
  name: Name,
): DomainScalar<number, Name> {
  if (!Number.isFinite(value) || value < 0 || value > 100) {
    throw new RangeError(`${name} must be a finite number between 0 and 100`)
  }

  return value as DomainScalar<number, Name>
}

export function createConfidenceScore(value: number): ConfidenceScore {
  return createScore(value, "ConfidenceScore")
}

export function createPriorityScore(value: number): PriorityScore {
  return createScore(value, "PriorityScore")
}

const ISO_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/u
const ISO_DATE_TIME_PATTERN =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d{1,9})?)?(?:Z|[+-](\d{2}):(\d{2}))?$/u

function isValidCalendarDate(year: number, month: number, day: number): boolean {
  if (month < 1 || month > 12 || day < 1) {
    return false
  }

  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)
  const daysInMonth = [31, leapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][
    month - 1
  ]
  return daysInMonth !== undefined && day <= daysInMonth
}

export function isIsoDate(value: string): value is IsoDate {
  const match = ISO_DATE_PATTERN.exec(value)
  if (match === null) {
    return false
  }

  return isValidCalendarDate(Number(match[1]), Number(match[2]), Number(match[3]))
}

export function createIsoDate(value: string): IsoDate {
  if (!isIsoDate(value)) {
    throw new RangeError("IsoDate must be a valid ISO calendar date (YYYY-MM-DD)")
  }

  return value
}

export function isIsoDateTime(value: string): value is IsoDateTime {
  const match = ISO_DATE_TIME_PATTERN.exec(value)
  if (match === null) {
    return false
  }

  const validDate = isValidCalendarDate(
    Number(match[1]),
    Number(match[2]),
    Number(match[3]),
  )
  const validTime =
    Number(match[4]) <= 23 &&
    Number(match[5]) <= 59 &&
    (match[6] === undefined || Number(match[6]) <= 59)
  const validOffset =
    (match[7] === undefined && match[8] === undefined) ||
    (Number(match[7]) <= 23 && Number(match[8]) <= 59)

  return validDate && validTime && validOffset
}

export function createIsoDateTime(value: string): IsoDateTime {
  if (!isIsoDateTime(value)) {
    throw new RangeError("IsoDateTime must be a valid ISO date-time")
  }

  return value
}
