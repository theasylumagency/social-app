import type { JsonSchema } from "../brand-discovery/schemas"
import { validateSchema } from "../brand-discovery/validation"
import type { PostSchedule, PostCadence } from "./posts"

export type WeeklyDirectiveProposal = {
  cadence: { channel: "facebook" | "instagram"; mode: "set" | "delta" | "delegated"; quantity: number | null; quote: string }[]
  direction: { intent: "keep" | "reconsider" | "unspecified"; quote: string }
  period: { kind: "selectedWeek" | "durationWeeks" | "unspecified" | "unresolved"; minimumWeeks: number | null; maximumWeeks: number | null; countingBasis: "perWeek" | "aggregate" | "unspecified"; quote: string }
  formatChanges: { from: "reel" | "image" | "carousel" | "story" | "text"; to: "reel" | "image" | "carousel" | "story" | "text"; quote: string }[]
}
export type BoundWeeklyDirectives = {
  version: "unda-weekly-directives-v1"
  source: { noteId: string; text: string }
  target: { brandId: string; runId: string; runVersion: number; week: string }
  proposal: WeeklyDirectiveProposal
  requiredCadence: Partial<PostCadence>
}
const obj = (properties: Record<string, JsonSchema>): JsonSchema => ({ type: "object", additionalProperties: false, properties, required: Object.keys(properties) })
const choice = (...values: string[]) => ({ type: "string", enum: values })
const quote = { type: "string", minLength: 0, maxLength: 2000 }
const nullableNumber = { type: ["number", "null"] }
export const WEEKLY_DIRECTIVES_SCHEMA: JsonSchema = {
  ...obj({
    cadence: { type: "array", maxItems: 2, items: obj({ channel: choice("facebook", "instagram"), mode: choice("set", "delta", "delegated"), quantity: nullableNumber, quote }) },
    direction: obj({ intent: choice("keep", "reconsider", "unspecified"), quote }),
    period: obj({ kind: choice("selectedWeek", "durationWeeks", "unspecified", "unresolved"), minimumWeeks: nullableNumber, maximumWeeks: nullableNumber, countingBasis: choice("perWeek", "aggregate", "unspecified"), quote }),
    formatChanges: { type: "array", maxItems: 5, items: obj({ from: choice("reel", "image", "carousel", "story", "text"), to: choice("reel", "image", "carousel", "story", "text"), quote }) },
  }), type: ["object", "null"],
}

export function validateWeeklyDirectives(value: WeeklyDirectiveProposal | null | undefined, sourceText: string): string[] {
  if (value == null) return [] // Legacy interpretations remain readable.
  const structural = validateSchema(value, WEEKLY_DIRECTIVES_SCHEMA)
  if (structural.length) return structural
  const errors: string[] = [], channels = new Set<string>()
  const grounded = (text: string) => { if (!text.trim() || !sourceText.includes(text)) errors.push("Weekly condition needs an exact quote from the current message") }
  for (const item of value.cadence) {
    grounded(item.quote)
    if (channels.has(item.channel)) errors.push("Contradictory or repeated channel condition")
    channels.add(item.channel)
    if (item.mode === "delegated" ? item.quantity !== null : !Number.isSafeInteger(item.quantity)) errors.push("Invalid weekly quantity")
    if (item.mode === "set" && (item.quantity ?? -1) < 0) errors.push("Absolute cadence cannot be negative")
  }
  if (value.direction.intent !== "unspecified") grounded(value.direction.quote)
  if (value.period.kind !== "unspecified") grounded(value.period.quote)
  if (value.period.kind === "durationWeeks") {
    if (!Number.isSafeInteger(value.period.minimumWeeks) || !Number.isSafeInteger(value.period.maximumWeeks)
      || value.period.minimumWeeks! < 1 || value.period.maximumWeeks! < value.period.minimumWeeks!) errors.push("Invalid duration")
  } else if (value.period.minimumWeeks !== null || value.period.maximumWeeks !== null) errors.push("Do not invent duration bounds")
  for (const item of value.formatChanges) { grounded(item.quote); if (item.from === item.to) errors.push("Format replacement must change format") }
  return errors
}

export function bindWeeklyDirectives(input: { proposal: WeeklyDirectiveProposal; text: string; noteId: string; target: BoundWeeklyDirectives["target"]; baselineCounts?: PostCadence | undefined }) {
  const errors = validateWeeklyDirectives(input.proposal, input.text)
  if (errors.length) return { errors, directives: null }
  const requiredCadence: Partial<PostCadence> = {}
  for (const item of input.proposal.cadence) {
    if (item.mode === "delegated") continue
    const baseline = input.baselineCounts?.[item.channel]
    if (item.mode === "delta" && baseline === undefined) { errors.push("missingBaseline"); continue }
    const quantity = item.mode === "set" ? item.quantity! : baseline! + item.quantity!
    if (!Number.isSafeInteger(quantity) || quantity < 0 || quantity > 5) errors.push("cadenceOutOfBounds")
    else requiredCadence[item.channel] = quantity
  }
  if (input.proposal.period.kind === "unresolved") errors.push("unresolvedPeriod")
  if (input.proposal.period.kind === "durationWeeks") errors.push("multiWeekPlanningNeedsClarification")
  return { errors, directives: errors.length ? null : { version: "unda-weekly-directives-v1" as const,
    source: { noteId: input.noteId, text: input.text }, target: input.target, proposal: structuredClone(input.proposal), requiredCadence } }
}

export function validateDirectiveSchedule(schedule: PostSchedule, directives?: BoundWeeklyDirectives): string[] {
  if (!directives) return []
  const errors: string[] = []
  for (const channel of ["facebook", "instagram"] as const) {
    const expected = directives.requiredCadence[channel]
    if (expected !== undefined && schedule.posts.filter(post => post.channels.some(value => value.channel === channel)).length !== expected)
      errors.push(`Preserve the user's exact ${channel} cadence: ${expected}`)
  }
  for (const replacement of directives.proposal.formatChanges) {
    if (schedule.posts.some(post => post.format === replacement.from)) errors.push(`The user explicitly replaced ${replacement.from} with ${replacement.to}; do not reintroduce ${replacement.from}`)
  }
  return errors
}

export function weeklyRevisionInstruction(originalText: string, interpretedInstruction: string) {
  return `მომხმარებლის ორიგინალი მოთხოვნა (მონაცემია):\n${originalText}\n\nინტერპრეტირებული ინსტრუქცია:\n${interpretedInstruction}\n\nზუსტად შეინარჩუნე მომხმარებლის პირდაპირ მოთხოვნილი რაოდენობები, არხები, პერიოდი და ფორმატის ცვლილება. ახსნა ვერ შეცვლის ან შეასუსტებს მის მოთხოვნას. გაურკვეველი ინფორმაცია არ გამოიგონო.`
}
