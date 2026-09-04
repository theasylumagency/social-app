import type {
  BlockedOperation,
  BrandId,
  Capability,
  ContentMode,
  FallbackStrategy,
  KnowledgePath,
  OperatingNoteCode,
  TaskId,
  TaskType,
} from "./primitives"

export type Task = {
  readonly id: TaskId
  readonly brandId: BrandId
  readonly type: TaskType
  readonly instruction: string
  readonly input?: unknown
}

export type CapabilityRequirement = {
  readonly capability: Capability
  readonly criticality: "required" | "preferred"
}

export type CapabilityResolution = {
  readonly taskId: TaskId
  readonly requirements: readonly CapabilityRequirement[]
}

export type CapabilityAssessment = {
  readonly capability: Capability
  readonly status: "available" | "availableWithFallback" | "unavailable"
  readonly reason?: string
}

export type ActiveFallbackStrategy = {
  readonly strategy: FallbackStrategy
  readonly reason?: string
}

export type OperatingNote = {
  readonly code: OperatingNoteCode
  readonly message?: string
}

export type SafeOperatingEnvelope = {
  readonly taskId: TaskId
  readonly status: "ready" | "readyWithUncertainty" | "blocked"
  readonly allowedContentModes: readonly ContentMode[]
  readonly blockedOperations: readonly BlockedOperation[]
  readonly blockedPaths: readonly KnowledgePath[]
  readonly proofRequiredPaths: readonly KnowledgePath[]
  readonly unresolvedButNonBlockingPaths: readonly KnowledgePath[]
  readonly fallbackStrategies: readonly ActiveFallbackStrategy[]
  readonly operatingNotes: readonly OperatingNote[]
}

export type MinimumViableBrandStatus = {
  readonly usableOffer: boolean
  readonly contentLanguage: boolean
  readonly usableVoice: boolean
  readonly satisfied: boolean
}
