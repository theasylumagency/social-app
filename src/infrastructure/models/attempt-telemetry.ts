/** Application timings and fingerprints only; source text and credentials never enter this record. */
export type ModelAttemptTelemetry = {
  version: 1
  logicalCallId: string
  requestOrdinal: number
  validationAttempt: number
  kind: "initial" | "transport_retry" | "validation_repair"
  outcome: "accepted" | "validation_failure" | "provider_failure" | "validator_exception"
  startedAt: string
  completedAt: string
  requestDurationMs: number
  validationDurationMs: number
  backoffBeforeMs: number
  requestHash: string
  inputBytes: number
  instructionsBytes: number
  schemaBytes: number
  timeoutMs: number
  reasoningEffort: "none" | "low" | "medium" | "high" | null
  responseModel: string | null
}
