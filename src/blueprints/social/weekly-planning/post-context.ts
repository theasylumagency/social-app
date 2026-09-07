import { compileBrandVoice } from "../brand-voice"
import type { PlanningRun } from "./model"
import type { PostOutline } from "./posts"

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
    internalGuidance: { business: { name: u.name, description: u.summary }, positioning: u.positioning, contentDirection: direction, audiences, adaptationBias: adaptation?.bias ?? null },
    voice: compileBrandVoice(u.voice, basis.sources),
    // These are boundaries/defaults, never additional communication jobs.
    communication: { toneRange: envelope.toneRange, terminologyRules: envelope.terminologyRules, ctaStyle: envelope.ctaStyle, salesPressure: envelope.salesPressure, inclusivityRules: envelope.inclusivityRules },
    constraints: [...u.constraints, ...envelope.avoid, ...post.brief.mustNotSay],
    // Discovery interpretations and style excerpts are not public-claim authorization.
    publicFacts: [], eligibleProof: [],
  }
}

export function compilePostEditorialContext(run: PlanningRun, post: PostOutline) {
  const { task, internalGuidance, voice, communication } = compilePostGenerationContext(run, post)
  return { task, voice, communication, audience: internalGuidance.audiences, positioning: internalGuidance.positioning, contentDirection: internalGuidance.contentDirection }
}
