import type { BrandId, IsoDate, IsoDateTime } from "../../core/domain"
import type { AudienceRef } from "../../blueprints/social/audience"
import type { PlanningRun, PlanningPayload } from "../../blueprints/social/weekly-planning/model"
import type { BrandReasoner } from "../../infrastructure/models/brand-reasoning"
import type { WeeklyExperimentDecision, WeeklyPlan } from "../../blueprints/social/weekly-plan"
import { assembleWeeklyPlan } from "../../blueprints/social/weekly-plan-assembly"
import { submitWeeklyPlanForReview } from "../../blueprints/social/weekly-plan-lifecycle"
import { validatePlanningProse } from "../../blueprints/social/weekly-planning/validation"
import { recentEditorialWork } from "../../blueprints/social/weekly-planning/sequence"
import { compileLandscapeContext } from "../brand-discovery/advance"
import { COMPACT_STRATEGY_PROMPT, COMPACT_STRATEGY_SCHEMA, validateCompactStrategy, type CompactStrategy } from "../../blueprints/social/weekly-planning/compact-strategy"

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
    selectedBrandGoals: p.socialStrategy?.payload.proposal ? [{ goalKey: "g1", title: p.socialStrategy.payload.proposal.objective, desiredChange: p.socialStrategy.payload.proposal.plan.audienceChange, rationale: p.socialStrategy.payload.proposal.rationale, progressSignals: p.socialStrategy.payload.proposal.measurement.map((m) => m.signal) }] : basis.goals.filter((g) => basis.feedback.selectedGoalIds?.includes(g.id)).map((g, i) => ({ goalKey: `g${i + 1}`, title: g.title, desiredChange: g.desiredChange, rationale: g.rationale, progressSignals: g.progressSignals })),
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
    recentEditorialWork: recentEditorialWork(p, run.week),
    socialStrategy: p.socialStrategy?.payload.proposal ?? null,
    strategyVersion: p.socialStrategy ? { id: p.socialStrategy.id, revision: p.socialStrategy.revision, approvedAt: p.socialStrategy.payload.approvedAt } : null,
    recentResults: (p.evidence ?? []).filter((e) => e.availability === "available"),
    recentSignals: (p.evidence ?? []).flatMap((e) => e.observations),
    evidenceReview: p.evidence ?? [],
    channelContext: { recommendations: p.socialStrategy?.payload.proposal?.channels ?? [], confirmedDestinations: [], publishingSchedule: null },
    dataAvailability: { performance: p.evidence?.some((e) => e.availability === "available") ? "suppliedObservations" : "unavailable", proof: "notSupplied", priorPlansAreResults: false },
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
  if (run.step === "ready") return { payload: p, step: "ready" }
  // Old in-flight stage names resume through one complete weekly proposal. No serial sub-planners.
  const s = await runModel<CompactStrategy>({ step: "weekly_strategy", version: "current-week-v3", prompt: COMPACT_STRATEGY_PROMPT, input: context, schema: COMPACT_STRATEGY_SCHEMA, validate: (v) => validateCompactStrategy(v as CompactStrategy, audienceKeys) })
  p.objective = s.weeklyObjective; p.focus = s.focus; p.directions = s.directions; p.adaptation = s.audienceDirections; p.experiment = s.experimentDecision
  // Structural checks ran on the proposal. Factual/voice/editorial review belongs to the actual copy.
  p.review = { brandGoalKeys: context.selectedBrandGoals.map((g) => g.goalKey), progressSignals: p.socialStrategy?.payload.proposal?.measurement.map((m) => m.signal) ?? [], checks: {
    brandSpecificity: "გეგმა ეყრდნობა ბრენდის დადასტურებულ საფუძველს.", focusCoherence: "აუდიტორიისა და მიმართულებების ბმულები შემოწმებულია.", voiceCompatibility: "ტექსტების შეფასება ბრენდის ხმის წესებით მოხდება.", evidenceDiscipline: context.dataAvailability.performance === "unavailable" ? "შედეგები ჯერ უცნობია; შექმნილი კონტენტი აუდიტორიის პროგრესს არ ამტკიცებს." : "გათვალისწინებულია წყაროს მითითებით შენახული დაკვირვებები.", priorityResponse: p.priority || "დამატებითი ბიზნესკონტექსტი არ არის მითითებული.",
  }, concerns: [] }
  p.plan = assemblePlanningRun({ ...run, payload: p }, now as IsoDateTime)
  return { payload: p, step: "ready" }
}
