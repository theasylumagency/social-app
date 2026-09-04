import type { IsoDateTime } from "./primitives"

export type FreshnessStatus =
  | "current"
  | "aging"
  | "stale"
  | "expired"
  | "unknown"

export type FreshnessBasis =
  | "explicitValidity"
  | "sourceTimestamp"
  | "captureAge"
  | "policyWindow"
  | "noTemporalSignal"

export type FreshnessAssessment = {
  readonly status: FreshnessStatus
  readonly basis: FreshnessBasis
  readonly assessedAt: IsoDateTime
}
