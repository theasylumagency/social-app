import type { NoteWorkContext, NoteWorkInput } from "../../src/application/contextual-notes/workflow"
import type { BrandModelRun } from "../../src/infrastructure/models/brand-reasoning"
import type { Decision, Interpretation } from "../../src/application/contextual-notes/model"
import type { PostsPayload } from "../../src/blueprints/social/weekly-planning/posts"

export type Arm = "baseline" | "lowInterpreter"
export type Reference = {
  provenance: "human-confirmed-fields" | "engineering-control"
  actions?: Interpretation["action"][]
  modes?: Decision["mode"][]
  cadence?: { channel: "facebook" | "instagram"; mode: "set" | "delta" | "delegated"; quantity: number | null }[]
  direction?: "keep" | "reconsider" | "unspecified"
  period?: "selectedWeek" | "durationWeeks" | "unspecified" | "unresolved"
  engineering?: { direction?: Reference["direction"]; period?: Reference["period"] }
  format?: { from: string; to: string }[]
  shorter?: boolean
  noEmoji?: boolean
}
export type EvaluationCase = { id: string; contextId: string; family: "weekly" | "negativeMixed" | "localEdit"; input: NoteWorkInput; context: NoteWorkContext; reference: Reference }
export type FrozenCorpus = {
  version: 1; capturedAt: string; week: string; corpusHash: string; sourceHashes: Record<string, string>
  configuration: { notesModel: string; reviewModel: string; noteTimeoutMs: 40000; reviewTimeoutMs: 60000; baselineEffort: null; candidateEffort: "low" }
  cases: EvaluationCase[]
  provenance: { humanMessages: number; controlledMessages: number; liveTrafficSample: false; independentFinalQualityLabels: false }
}
export type EvaluationResult = {
  interpretation: Interpretation; decision: Decision; status: string; revisedPosts: PostsPayload | null
  assertions: { id: string; passed: boolean; provenance: Reference["provenance"] | "engineering-invariant" }[]
}
export type CaseReceipt = {
  corpusHash: string; caseId: string; arm: Arm; pairIndex: number; order: number; runId: string; contextHash: string
  mode: "live-provider" | "mock-contract"; startedAt: string; completedAt: string; applicationMs: number
  phases: { name: string; durationMs: number }[]; modelRuns: BrandModelRun[]; providerRequestIds: string[]; result: EvaluationResult | null
  failure: { kind: string; httpStatus?: number; transient: boolean } | null
  productionQueueMs: null; databasePersistenceMs: null; monetaryCostUsd: null
}
