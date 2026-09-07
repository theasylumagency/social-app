import type { BrandDossier } from "../brand-discovery/model"
import type { WeeklyPlan } from "../weekly-plan"
import type { WeeklyObjectiveProposal } from "./weekly-objective-contract"
import type { WeeklyAudienceFocusProposal } from "./weekly-audience-focus-contract"
import type { ContentDirectionProposal } from "./content-direction-contract"
import type { ContentAudienceDirectionProposal } from "./content-audience-direction-contract"
import type { ExperimentDecisionStructuredProposal } from "./experiment-decision-contract"
import type { PostsBatch, PostAsset } from "./posts"

export const PLANNING_STEPS = ["objective", "focus", "directions", "adaptation", "experiment", "review", "ready"] as const
export type PlanningStep = typeof PLANNING_STEPS[number]
export type PlanningReview = {
  brandGoalKeys: string[]
  progressSignals: string[]
  checks: { brandSpecificity: string; focusCoherence: string; voiceCompatibility: string; evidenceDiscipline: string; priorityResponse: string }
  concerns: { severity: "blocking" | "advisory"; message: string; directionKeys: string[] }[]
}
export type PlanOutline = { week: string; objective: string; directions: string[]; experiment: string | null }
export type PlanningPayload = {
  founderPosts?: boolean
  basis: BrandDossier
  priority: string
  revisionNote: string
  previousVersion: PlanOutline | null
  priorWeeks: PlanOutline[]
  plannedOn: string
  objective: WeeklyObjectiveProposal | null
  focus: WeeklyAudienceFocusProposal | null
  directions: ContentDirectionProposal[]
  adaptation: ContentAudienceDirectionProposal[]
  experiment: ExperimentDecisionStructuredProposal | null
  review: PlanningReview | null
  plan: WeeklyPlan | null
}
export type PlanningRun = {
  id: string
  ownerId: string
  brandId: string
  week: string
  version: number
  status: "queued" | "running" | "ready" | "failed" | "approved" | "changesRequested" | "superseded"
  step: PlanningStep
  payload: PlanningPayload
  error: string | null
  leaseUntil: string | null
  createdAt: string
  updatedAt: string
}
export type PlanningView = { run: PlanningRun | null; approved: PlanningRun | null; history: { id: string; version: number; status: PlanningRun["status"]; updatedAt: string; objective: string | null }[]; basis: BrandDossier | null; stale: boolean; posts?: PostsBatch | null; assets?: PostAsset[]; approvedPosts?: PostsBatch | null; approvedAssets?: PostAsset[] }

export function summarizePlan(plan: WeeklyPlan): PlanOutline {
  return { week: plan.startsOn, objective: plan.objective.objective, directions: plan.contentDirections.map((d) => d.direction), experiment: plan.experimentDecision.experiment?.hypothesis ?? null }
}
