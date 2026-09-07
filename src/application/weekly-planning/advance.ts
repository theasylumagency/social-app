import type { BrandId, IsoDate, IsoDateTime } from "../../core/domain"
import type { AudienceRef } from "../../blueprints/social/audience"
import type { PlanningRun, PlanningPayload, PlanningReview } from "../../blueprints/social/weekly-planning/model"
import type { BrandReasoner } from "../../infrastructure/models/brand-reasoning"
import type { WeeklyObjectiveModelOutput } from "../../blueprints/social/weekly-planning/weekly-objective-contract"
import type { WeeklyAudienceFocusModelOutput } from "../../blueprints/social/weekly-planning/weekly-audience-focus-contract"
import type { ContentDirectionModelOutput } from "../../blueprints/social/weekly-planning/content-direction-contract"
import type { ContentAudienceDirectionModelOutput } from "../../blueprints/social/weekly-planning/content-audience-direction-contract"
import type { ExperimentDecisionModelOutput } from "../../blueprints/social/weekly-planning/experiment-decision-contract"
import type { WeeklyExperimentDecision, WeeklyPlan } from "../../blueprints/social/weekly-plan"
import { assembleWeeklyPlan } from "../../blueprints/social/weekly-plan-assembly"
import { submitWeeklyPlanForReview } from "../../blueprints/social/weekly-plan-lifecycle"
import { validateReferences } from "../../blueprints/social/brand-discovery/validation"
import { validatePlanningProse } from "../../blueprints/social/weekly-planning/validation"
import { compileLandscapeContext } from "../brand-discovery/advance"
import { WEEKLY_OBJECTIVE_SYSTEM_PROMPT } from "../../blueprints/social/weekly-planning/prompts/weekly-objective"
import { WEEKLY_AUDIENCE_FOCUS_SYSTEM_PROMPT } from "../../blueprints/social/weekly-planning/prompts/weekly-audience-focus"
import { CONTENT_DIRECTION_SYSTEM_PROMPT } from "../../blueprints/social/weekly-planning/prompts/content-direction"
import { CONTENT_AUDIENCE_DIRECTION_SYSTEM_PROMPT } from "../../blueprints/social/weekly-planning/prompts/content-audience-direction"
import { EXPERIMENT_DECISION_SYSTEM_PROMPT } from "../../blueprints/social/weekly-planning/prompts/experiment-decision"
import { WEEKLY_PLAN_REVIEW_PROMPT } from "../../blueprints/social/weekly-planning/prompts/review"
import { WEEKLY_OBJECTIVE_OUTPUT_SCHEMA, WEEKLY_AUDIENCE_FOCUS_OUTPUT_SCHEMA, CONTENT_DIRECTION_OUTPUT_SCHEMA, CONTENT_AUDIENCE_DIRECTION_OUTPUT_SCHEMA, EXPERIMENT_DECISION_OUTPUT_SCHEMA, WEEKLY_PLAN_REVIEW_SCHEMA } from "../../blueprints/social/weekly-planning/schemas"

export function planningAudienceRefs(p: PlanningPayload) {
  return p.basis.payload.landscape!.entries.filter((e) => e.influence !== "none").map((entry, i) => ({ key: `a${i + 1}`, ref: { source: entry.source, id: entry.audience.id } as AudienceRef }))
}
export function compilePlanningContext(run: PlanningRun) {
  const p = run.payload
  const basis = p.basis.payload
  const landscape = compileLandscapeContext(basis)
  const refs = planningAudienceRefs(p)
  const envelope = basis.envelope!
  const end = new Date(`${run.week}T12:00:00Z`); end.setUTCDate(end.getUTCDate() + 6)
  return {
    ...landscape,
    selectedBrandGoals: basis.goals.filter((g) => basis.feedback.selectedGoalIds?.includes(g.id)).map((g, i) => ({ goalKey: `g${i + 1}`, title: g.title, desiredChange: g.desiredChange, rationale: g.rationale, progressSignals: g.progressSignals })),
    communicationProfiles: basis.profiles.map((profile) => ({
      audienceKey: refs.find((r) => r.ref.source === profile.audience.source && r.ref.id === profile.audience.id)!.key,
      communicationGoal: profile.communicationGoal, toneAdjustments: profile.toneAdjustments, preferredFraming: profile.preferredFraming,
      usefulContentAngles: profile.usefulContentAngles, assumedKnowledge: profile.assumedKnowledge, explanationDepth: profile.explanationDepth,
      trustMechanisms: profile.trustMechanisms, ctaStyle: profile.ctaStyle, avoid: profile.avoid, rationale: profile.rationale,
    })),
    communicationEnvelope: { complexity: envelope.complexity, assumedKnowledge: envelope.assumedKnowledge, explanationDepth: envelope.explanationDepth, toneRange: envelope.toneRange, framingRules: envelope.framingRules, preferredStructures: envelope.preferredStructures, terminologyRules: envelope.terminologyRules, proofStyle: envelope.proofStyle, ctaStyle: envelope.ctaStyle, salesPressure: envelope.salesPressure, inclusivityRules: envelope.inclusivityRules, trustMechanisms: envelope.trustMechanisms, avoid: envelope.avoid, rationale: envelope.rationale },
    week: { startsOn: run.week, endsOn: end.toISOString().slice(0, 10), plannedOn: p.plannedOn, timezone: "Asia/Tbilisi" },
    userPriority: p.priority || null, revisionNote: p.revisionNote || null,
    previousVersion: p.previousVersion, priorPlans: p.priorWeeks,
    recentResults: [], recentSignals: [], channelContext: { confirmedDestinations: [], publishingSchedule: null },
    dataAvailability: { performance: "notSupplied", proof: "notSupplied", priorPlansAreResults: false },
    weeklyObjective: p.objective,
    weeklyAudienceFocus: p.focus,
    contentDirections: p.directions.map((d, i) => ({ contentDirectionKey: `d${i + 1}`, ...d })),
  }
}

export function assemblePlanningRun(run: PlanningRun, now: IsoDateTime): WeeklyPlan {
  const p = run.payload
  if (!p.objective || !p.focus || !p.experiment || !p.review) throw new Error("Planning stages incomplete")
  const refs = planningAudienceRefs(p)
  const reference = (key: string) => { const ref = refs.find((r) => r.key === key)?.ref; if (!ref) throw new Error("Unknown audience reference"); return ref }
  const e = p.experiment.experiment
  const experiment: WeeklyExperimentDecision = p.experiment.decision === "noExperiment" ? { decision: "noExperiment", rationale: p.experiment.rationale, experiment: null } : {
    decision: "experiment", rationale: p.experiment.rationale,
    experiment: { id: `experiment:${run.id}` as NonNullable<WeeklyExperimentDecision["experiment"]>["id"], hypothesis: e.hypothesis!, variable: e.variable!, comparison: e.comparison!, learningSignal: e.learningSignal!, guardrails: e.guardrails },
  }
  const endsOn = new Date(`${run.week}T12:00:00Z`); endsOn.setUTCDate(endsOn.getUTCDate() + 6)
  return submitWeeklyPlanForReview(assembleWeeklyPlan({
    id: `weekly-plan:${run.id}` as WeeklyPlan["id"], brandId: run.brandId as BrandId, startsOn: run.week as IsoDate, endsOn: endsOn.toISOString().slice(0, 10) as IsoDate,
    version: run.version, communicationEnvelopeId: p.basis.payload.envelope!.id, objective: p.objective,
    audienceFocus: { primary: reference(p.focus.primaryAudienceKey), secondary: p.focus.secondaryAudienceKeys.map(reference), rationale: p.focus.rationale },
    contentDirections: p.directions.map((d, i) => ({ ...d, id: `direction:${run.id}:${i + 1}` as WeeklyPlan["contentDirections"][number]["id"], contentDirectionKey: `d${i + 1}`, order: i })),
    contentAudienceDirections: p.adaptation.map((d) => ({ contentDirectionKey: d.contentDirectionKey, audienceDirection: { primaryAudience: reference(d.primaryAudienceKey), secondaryAudiences: d.secondaryAudienceKeys.map(reference), bias: d.bias } })),
    experimentDecision: experiment, createdAt: run.createdAt as IsoDateTime, updatedAt: now,
  }), now)
}

export async function advanceWeeklyPlanning(run: PlanningRun, reason: BrandReasoner, now = new Date().toISOString()): Promise<{ payload: PlanningPayload; step: PlanningRun["step"] }> {
  const p = structuredClone(run.payload)
  const context = compilePlanningContext({ ...run, payload: p })
  const audienceKeys = context.audiences.map((a) => a.audienceKey)
  const proseKeys = [...audienceKeys, ...context.selectedBrandGoals.map((g) => g.goalKey), ...context.contentDirections.map((d) => d.contentDirectionKey)]
  const runModel: BrandReasoner = (call) => reason({ ...call, validate: (value) => [...(call.validate?.(value) ?? []), ...validatePlanningProse(value, proseKeys)] })
  if (run.step === "objective") {
    const output = await runModel<WeeklyObjectiveModelOutput>({ step: "weekly_objective", version: "weekly-objective-v2", prompt: WEEKLY_OBJECTIVE_SYSTEM_PROMPT, input: context, schema: WEEKLY_OBJECTIVE_OUTPUT_SCHEMA })
    p.objective = output.weeklyObjective
    return { payload: p, step: "focus" }
  }
  if (run.step === "focus") {
    const output = await runModel<WeeklyAudienceFocusModelOutput>({ step: "weekly_focus", version: "weekly-focus-v2", prompt: WEEKLY_AUDIENCE_FOCUS_SYSTEM_PROMPT, input: context, schema: WEEKLY_AUDIENCE_FOCUS_OUTPUT_SCHEMA, validate: (value) => {
      const f = (value as WeeklyAudienceFocusModelOutput).focus
      return [...validateReferences([f.primaryAudienceKey, ...f.secondaryAudienceKeys], audienceKeys, "weekly audiences"), ...(f.secondaryAudienceKeys.length > 1 ? ["Select at most one secondary audience"] : [])]
    } })
    p.focus = output.focus
    return { payload: p, step: "directions" }
  }
  if (run.step === "directions") {
    const output = await runModel<ContentDirectionModelOutput>({ step: "weekly_directions", version: "content-direction-v2", prompt: CONTENT_DIRECTION_SYSTEM_PROMPT, input: context, schema: CONTENT_DIRECTION_OUTPUT_SCHEMA, validate: (value) => {
      const d = (value as ContentDirectionModelOutput).directions
      return [...(d.length < 3 || d.length > 5 ? ["Return 3–5 distinct directions"] : []), ...(new Set(d.map((d) => d.direction.trim().toLocaleLowerCase())).size !== d.length ? ["Duplicate content directions"] : [])]
    } })
    p.directions = [...output.directions]
    return { payload: p, step: "adaptation" }
  }
  if (run.step === "adaptation") {
    const allowed = [p.focus!.primaryAudienceKey, ...p.focus!.secondaryAudienceKeys]
    const output = await runModel<ContentAudienceDirectionModelOutput>({ step: "weekly_adaptation", version: "content-audience-direction-v2", prompt: CONTENT_AUDIENCE_DIRECTION_SYSTEM_PROMPT, input: context, schema: CONTENT_AUDIENCE_DIRECTION_OUTPUT_SCHEMA, validate: (value) => {
      const d = (value as ContentAudienceDirectionModelOutput).directions
      return [...validateReferences(d.map((d) => d.contentDirectionKey), context.contentDirections.map((d) => d.contentDirectionKey), "directions"), ...(d.length !== p.directions.length ? ["Cover every content direction exactly once"] : []), ...d.flatMap((d) => [...validateReferences([d.primaryAudienceKey, ...d.secondaryAudienceKeys], allowed, "focus audiences"), ...(d.secondaryAudienceKeys.length > 1 ? ["At most one secondary audience per direction"] : [])])]
    } })
    p.adaptation = [...output.directions]
    return { payload: p, step: "experiment" }
  }
  if (run.step === "experiment") {
    const output = await runModel<ExperimentDecisionModelOutput>({ step: "weekly_experiment", version: "experiment-decision-v2", prompt: EXPERIMENT_DECISION_SYSTEM_PROMPT, input: { ...context, contentAudienceDirections: p.adaptation }, schema: EXPERIMENT_DECISION_OUTPUT_SCHEMA, validate: (value) => {
      const d = (value as ExperimentDecisionModelOutput).experimentDecision
      const e = d.experiment; const fields = [e.hypothesis, e.variable, e.comparison, e.learningSignal]
      return d.decision === "noExperiment" ? fields.some((v) => v !== null) || e.guardrails.length ? ["No experiment requires null experiment fields and empty guardrails"] : [] : fields.some((v) => typeof v !== "string" || !v.trim()) || !e.guardrails.length ? ["Experiment requires a hypothesis, variable, comparison, signal and guardrails"] : []
    } })
    p.experiment = output.experimentDecision
    return { payload: p, step: "review" }
  }
  if (run.step === "review") {
    p.review = await runModel<PlanningReview>({ step: "weekly_review", version: "weekly-plan-review-v1", prompt: WEEKLY_PLAN_REVIEW_PROMPT, input: { ...context, contentAudienceDirections: p.adaptation, experimentDecision: p.experiment }, schema: WEEKLY_PLAN_REVIEW_SCHEMA, validate: (value) => {
      const review = value as PlanningReview
      return [...validateReferences(review.brandGoalKeys, context.selectedBrandGoals.map((g) => g.goalKey), "brand goals"), ...review.concerns.flatMap((c) => validateReferences(c.directionKeys, context.contentDirections.map((d) => d.contentDirectionKey), "review directions"))]
    } })
    p.plan = assemblePlanningRun({ ...run, payload: p }, now as IsoDateTime)
    return { payload: p, step: "ready" }
  }
  return { payload: p, step: "ready" }
}
