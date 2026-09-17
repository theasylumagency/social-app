import { compileBrandVoice } from "../brand-voice"
import type { PlanningRun } from "./model"
import type { PostOutline, PostVariant } from "./posts"
import { COMMUNICATION_ELEMENTS, normalizeRuleScope, operatingRuleEnforcement, operatingRuleViolations, ruleApplies, type OperatingRuleDraft } from "../../../core/domain/operating-policy"

// The current weekly-post contract is organic and has no campaign identity. Campaign-scoped
// and advertising-scoped rules therefore stay out until a future workflow supplies those fields.
const organicContext = { contentType: "organic" as const, campaign: null }

export function applicablePostOperatingRules(rules: readonly OperatingRuleDraft[], channels: readonly { channel: "facebook" | "instagram" }[]) {
  return rules.filter(rule => channels.some(({ channel }) => COMMUNICATION_ELEMENTS.some(communicationElement => ruleApplies(rule, { channel, ...organicContext, communicationElement }))))
}

/** Generated fields are mapped explicitly: caption, script, on-screen text, and frame text. */
export function validateVariantOperatingRules(variant: PostVariant, rules: readonly OperatingRuleDraft[]) {
  const fields = [
    ["caption", variant.caption],
    ["script", variant.script],
    ["on_screen_text", variant.onScreenText.join("\n")],
    ["frame_text", variant.frames.flatMap(frame => [frame.heading, frame.body]).join("\n")],
  ] as const
  return fields.flatMap(([communicationElement, text]) => operatingRuleViolations(text, rules.filter(rule => ruleApplies(rule, { channel: variant.channel, ...organicContext, communicationElement }))))
}

/** The approved post job is the relevance boundary; global goals are upstream planning input. */
export function compilePostGenerationContext(run: PlanningRun, post: PostOutline) {
  const p = run.payload
  const basis = p.basis.payload
  const u = basis.understanding!
  const envelope = basis.envelope!
  const direction = p.directions[Number(post.directionKey.slice(1)) - 1]
  if (!direction) throw Error("Unknown post direction")
  const adaptation = p.adaptation.find((a) => a.contentDirectionKey === post.directionKey)
  const focus = adaptation ?? p.focus
  if (!focus) throw Error("Post audience focus required")
  const audienceKeys = [focus.primaryAudienceKey, ...focus.secondaryAudienceKeys]
  const entries = basis.landscape!.entries.filter((e) => e.influence !== "none")
  const audiences = entries.flatMap((entry, i) => {
    if (!audienceKeys.includes(`a${i + 1}`)) return []
    const profile = basis.profiles.find((v) => v.audience.source === entry.source && v.audience.id === entry.audience.id)
    return [{
      name: entry.audience.name, influence: entry.influence,
      situation: entry.source === "operator" ? entry.audience.buyingSituation : entry.audience.description,
      // Communication goals and suggested content angles belong to planning, not every post.
      style: profile ? { toneAdjustments: profile.toneAdjustments, assumedKnowledge: profile.assumedKnowledge, explanationDepth: profile.explanationDepth, ctaStyle: profile.ctaStyle, avoid: profile.avoid } : null,
    }]
  })
  if (audiences.length !== new Set(audienceKeys).size) throw Error("Unknown post audience")
  return {
    contentLanguage: basis.input.language,
    task: { brief: post.brief, format: post.format, channels: post.channels.map((c) => c.channel), frameCount: post.visual.frames.length, framePlan: post.visual.frames },
    internalGuidance: { business: { name: u.name, description: u.summary }, positioning: u.positioning, socialObjective: p.socialStrategy?.payload.proposal?.objective ?? null, weeklyObjective: p.objective?.objective ?? null, contentDirection: direction, audiences, adaptationBias: adaptation?.bias ?? null },
    voice: compileBrandVoice(u.voice, basis.sources),
    // These are boundaries/defaults, never additional communication jobs.
    communication: { toneRange: envelope.toneRange, terminologyRules: envelope.terminologyRules, ctaStyle: envelope.ctaStyle, salesPressure: envelope.salesPressure, inclusivityRules: envelope.inclusivityRules },
    operatingRules: applicablePostOperatingRules(p.operatingRules ?? [], post.channels).map(rule => ({ kind: rule.kind, effect: rule.effect, parameter: rule.parameter, directive: rule.directive, scope: normalizeRuleScope(rule.scope), enforcement: operatingRuleEnforcement(rule) })),
    constraints: [...u.constraints, ...envelope.avoid, ...post.brief.mustNotSay],
    // Discovery interpretations and style excerpts are not public-claim authorization.
    publicFacts: [], eligibleProof: [],
  }
}

export function compilePostEditorialContext(run: PlanningRun, post: PostOutline) {
  const { task, internalGuidance, voice, communication, operatingRules } = compilePostGenerationContext(run, post)
  return { task, voice, communication, operatingRules, audience: internalGuidance.audiences, positioning: internalGuidance.positioning, contentDirection: internalGuidance.contentDirection }
}
