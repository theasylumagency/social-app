import type { PlanningRun } from "../../blueprints/social/weekly-planning/model"
import { countPostChannels, type PostsPayload } from "../../blueprints/social/weekly-planning/posts"
import { operatingChannels } from "../../blueprints/social/strategy/model"
import { CHANNEL_PLAN_PROMPT, CHANNEL_PLAN_SCHEMA, POST_CHANNELS, validateChannelPlan, type WeeklyChannelPlan } from "../../blueprints/social/weekly-planning/channel-plan"
import { validatePlanningProse } from "../../blueprints/social/weekly-planning/validation"
import type { BrandReasoner } from "../../infrastructure/models/brand-reasoning"

export function permittedPostChannels(run: PlanningRun) {
  return (run.payload.socialStrategy ? operatingChannels(run.payload.socialStrategy.payload.proposal) : [...POST_CHANNELS]).filter(channel => run.payload.channelPolicies?.find(policy => policy.channel === channel)?.active !== false)
}
export function channelPlanningContext(run: PlanningRun, existing?: PostsPayload) {
  const allowed = permittedPostChannels(run)
  const requested = run.payload.cadence ?? null
  const elapsed = Math.floor((Date.parse(`${run.payload.plannedOn}T12:00:00Z`) - Date.parse(`${run.week}T12:00:00Z`)) / 86400000)
  const remainingDays = Math.max(0, Math.min(7, 7 - elapsed))
  const strategy = run.payload.socialStrategy?.payload.proposal
  const audiences = run.payload.basis.payload.landscape!.entries.filter(e => e.influence !== "none").map(entry => ({ name: entry.audience.name, situation: entry.source === "operator" ? entry.audience.buyingSituation : entry.audience.description }))
  return {
    business: run.payload.basis.payload.understanding!.summary, audiences,
    weeklyObjective: run.payload.objective?.objective ?? null, priority: run.payload.priority,
    week: run.week, plannedOn: run.payload.plannedOn, remainingDays,
    channels: POST_CHANNELS.map(channel => ({ channel, enabled: allowed.includes(channel), approvedRecommendation: strategy?.channels.find(c => c.channel === channel) ?? null })),
    requestedCadence: requested, retainedCounts: countPostChannels(existing?.outline?.posts ?? []),
    recentResults: run.payload.evidence ?? [],
  }
}

/** Explicit counts already are a decision; do not pay a model to choose them again. */
export function fixedChannelPlan(run: PlanningRun): WeeklyChannelPlan | null {
  const allowed = permittedPostChannels(run)
  const requested = run.payload.cadence ?? (allowed.length ? null : { facebook: 0, instagram: 0 })
  if (!requested) return null
  return { channels: POST_CHANNELS.map(channel => {
    const recommendation = run.payload.socialStrategy?.payload.proposal?.channels.find(c => c.channel === channel)
    const disabled = !allowed.includes(channel)
    return { channel, count: requested[channel], role: recommendation?.role || (disabled ? "ამ კვირაში არხი შეჩერებულია." : "კვირის მიზნის შესაბამისი კომუნიკაცია."),
      reason: disabled ? "არხი მოქმედი სტრატეგიით ან შენახული პარამეტრით გამორთულია." : "პოსტების რაოდენობა თქვენს შენახულ არჩევანს მიჰყვება.",
      omissionReason: requested[channel] === 0 ? disabled ? "არხი მოქმედი სტრატეგიით ან შენახული პარამეტრით გამორთულია." : "ამ კვირაში არხზე თქვენი არჩევანით 0 პოსტია." : null }
  }) }
}
export async function createChannelPlan(run: PlanningRun, reason: BrandReasoner, existing?: PostsPayload): Promise<WeeklyChannelPlan> {
  const input = channelPlanningContext(run, existing)
  const constraints = { allowed: permittedPostChannels(run), requested: input.requestedCadence, retained: input.retainedCounts }
  const fixed = fixedChannelPlan(run)
  if (fixed) {
    const errors = validateChannelPlan(fixed, constraints)
    if (errors.length) throw Error(`Invalid channel plan: ${errors.join("; ")}`)
    return fixed
  }
  const referenceKeys = [...run.payload.basis.payload.landscape!.entries.map((_, i) => `a${i + 1}`), ...run.payload.directions.map((_, i) => `d${i + 1}`)]
  return reason<WeeklyChannelPlan>({ step: "post_channel_plan", version: "post-channel-plan-v1", prompt: CHANNEL_PLAN_PROMPT, input, schema: CHANNEL_PLAN_SCHEMA, validate: value => [...validateChannelPlan(value as WeeklyChannelPlan, constraints), ...validatePlanningProse(value, referenceKeys)] })
}
