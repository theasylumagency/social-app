import { WEEKLY_OBJECTIVE_OUTPUT_SCHEMA, WEEKLY_AUDIENCE_FOCUS_OUTPUT_SCHEMA, CONTENT_DIRECTION_OUTPUT_SCHEMA, CONTENT_AUDIENCE_DIRECTION_OUTPUT_SCHEMA, EXPERIMENT_DECISION_OUTPUT_SCHEMA } from "./schemas"
import type { WeeklyObjectiveProposal } from "./weekly-objective-contract"
import type { WeeklyAudienceFocusProposal } from "./weekly-audience-focus-contract"
import type { ContentDirectionProposal } from "./content-direction-contract"
import type { ContentAudienceDirectionProposal } from "./content-audience-direction-contract"
import type { ExperimentDecisionStructuredProposal } from "./experiment-decision-contract"
import { validateReferences } from "../brand-discovery/validation"
import { PLANNING_CONTEXT_RULES } from "./prompts/context"

export type CompactStrategy = { weeklyObjective: WeeklyObjectiveProposal; focus: WeeklyAudienceFocusProposal; directions: ContentDirectionProposal[]; audienceDirections: ContentAudienceDirectionProposal[]; experimentDecision: ExperimentDecisionStructuredProposal }
export const COMPACT_STRATEGY_SCHEMA = { type: "object", additionalProperties: false, properties: {
  weeklyObjective: WEEKLY_OBJECTIVE_OUTPUT_SCHEMA.properties.weeklyObjective,
  focus: WEEKLY_AUDIENCE_FOCUS_OUTPUT_SCHEMA.properties.focus,
  directions: CONTENT_DIRECTION_OUTPUT_SCHEMA.properties.directions,
  audienceDirections: CONTENT_AUDIENCE_DIRECTION_OUTPUT_SCHEMA.properties.directions,
  experimentDecision: EXPERIMENT_DECISION_OUTPUT_SCHEMA.properties.experimentDecision,
}, required: ["weeklyObjective", "focus", "directions", "audienceDirections", "experimentDecision"] }
export const COMPACT_STRATEGY_PROMPT = `Create the strategic foundation for one founder's weekly social-media plan. Preserve these five distinct decisions in one structured response, in this reasoning order:
1. Weekly objective: ONE useful change in audience understanding, trust or decision readiness that advances a selected brand goal. Never an activity count, format, channel, reach target or generic awareness ambition. Keep the objective one plain Georgian sentence, ideally under 220 characters. Give a concrete business rationale and 1–3 deliberate omissions protecting this week's focus. Respect founder priority and revision intent while remaining within confirmed business facts.
2. Weekly audience focus: select exactly one primary and at most one genuinely necessary secondary from the supplied eligible audience keys. Explain the buying situation and why progress here is useful now. Founder's disagreement stays visible as limited influence; do not erase or upgrade it. Never invent audiences or overwrite the brand-wide landscape. Secondary does not mean include every segment.
3. Three to five DISTINCT strategic content directions. Each has direction, purpose and rationale. These are communication jobs leading toward the objective, not final posts, copy, formats, channels or schedule. Avoid relabelled duplicates and broad generic content pillars. They should form a useful progression in the actual business context, drawing on real offers and tradeoffs rather than category clichés. One direction need not equal one post.
4. Assign each direction (d1,d2,... matching array order exactly) a primary and at most one secondary from the WEEKLY focus. Preserve strategy and audience identity. bias is only adaptation: balanced, moreExplanatory, moreDecisionOriented, moreTrustFocused, morePractical. Cover each direction exactly once; do not broaden the audience.
5. Decide whether ONE bounded experiment adds useful learning. No experiment is a valid deliberate decision and must have null hypothesis/variable/comparison/learningSignal and guardrails=[]. If proposing an experiment all four fields and guardrails are required, one variable only, observable learning, feasible comparison, no invented baseline/channel metrics or performance claims. Don't force an experiment when clarity matters more or execution context is missing. Experiments must respect the objective and communication envelope; don't invent a parallel strategy.
Use verified source evidence only for factual claims, retain internal hypotheses as calibration, and follow the saved communication envelope. The application owns IDs, dates, versions, influence and approvals. A separate reviewer will check all decisions. Output the exact requested schema.
${PLANNING_CONTEXT_RULES}`
export function validateCompactStrategy(s: CompactStrategy, audiences: string[]) {
  const focus = [s.focus.primaryAudienceKey, ...s.focus.secondaryAudienceKeys]
  const dkeys = s.directions.map((_, i) => `d${i + 1}`)
  const errors = [...validateReferences(focus, audiences, "weekly audiences"), ...validateReferences(s.audienceDirections.map((d) => d.contentDirectionKey), dkeys, "directions")]
  if (s.audienceDirections.length !== s.directions.length) errors.push("Cover each direction exactly once")
  for (const d of s.audienceDirections) errors.push(...validateReferences([d.primaryAudienceKey, ...d.secondaryAudienceKeys], focus, "focus audiences"))
  if (new Set(s.directions.map((d) => d.direction.trim().toLowerCase())).size !== s.directions.length) errors.push("Duplicate directions")
  const e = s.experimentDecision.experiment; const fields = [e.hypothesis, e.variable, e.comparison, e.learningSignal]
  if (s.experimentDecision.decision === "noExperiment" ? fields.some((f) => f !== null) || e.guardrails.length : fields.some((f) => typeof f !== "string" || !f.trim()) || !e.guardrails.length) errors.push("Experiment fields must match the decision")
  return errors
}
