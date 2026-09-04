import type {
  ClaimSignalType,
  GenerationConstraintType,
  ValidationIssueType,
} from "./primitives"
import type { GenerationValidationContext } from "./generation"

export type ClaimSignalStrength = "low" | "medium" | "high"
export type ClaimSignalSource = "lexical" | "pattern" | "structured" | "semantic"

export type ClaimDetectionSignal = {
  readonly type: ClaimSignalType
  readonly span: string
  readonly signalStrength: ClaimSignalStrength
  readonly source: ClaimSignalSource
}

export type ClaimCandidate = {
  readonly text: string
  readonly signals: readonly ClaimDetectionSignal[]
  readonly normalized?: unknown
}

export type ClaimScanResult = {
  readonly signals: readonly ClaimDetectionSignal[]
  readonly candidates: readonly ClaimCandidate[]
}

export type SemanticClaimMatchResult =
  | { readonly status: "supported" }
  | { readonly status: "unsupported" }
  | { readonly status: "ambiguous" }

export type ConstraintCheckResult = {
  readonly constraintType: GenerationConstraintType
  readonly status: "pass" | "fail"
  readonly span?: string
  readonly reason?: string
}

export type GenerationValidationStatus =
  | "pass"
  | "repairable"
  | "requiresReview"
  | "blocked"

export type ValidationIssueSeverity = "low" | "medium" | "high"

export type GenerationValidationIssue = {
  readonly type: ValidationIssueType
  readonly severity: ValidationIssueSeverity
  readonly span?: string
  readonly candidate?: ClaimCandidate
  readonly reason: string
}

export type GenerationValidationResult = {
  readonly status: GenerationValidationStatus
  readonly issues: readonly GenerationValidationIssue[]
  readonly repairInstructions?: readonly string[]
}

export type ClaimScannerInput = {
  readonly draft: string
}

export type GenerationValidatorInput = {
  readonly draft: string
  readonly scan: ClaimScanResult
  readonly context: GenerationValidationContext
}
