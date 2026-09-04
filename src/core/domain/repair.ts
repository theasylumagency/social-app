export type RepairInstructionSource = "safety" | "quality"

export type RepairInstruction = {
  readonly source: RepairInstructionSource
  readonly instruction: string
}

export type RepairPreservationRequirement =
  | "tone"
  | "taskIntent"
  | "specificity"
  | "structure"

export type ConsolidatedRepairBrief = {
  readonly instructions: readonly RepairInstruction[]
  readonly preserve: readonly RepairPreservationRequirement[]
}

export type DraftEvaluationOutcome =
  | { readonly status: "pass" }
  | { readonly status: "repair"; readonly brief: ConsolidatedRepairBrief }
  | { readonly status: "requiresReview" }
  | { readonly status: "blocked" }
