export const SOCIAL_CHANNELS = ["facebook", "instagram"] as const
export type SocialChannel = typeof SOCIAL_CHANNELS[number]

export const OPERATING_RULE_KINDS = ["emoji", "price", "address_form", "term"] as const
export type OperatingRuleKind = typeof OPERATING_RULE_KINDS[number]
export type OperatingRuleEffect = "forbid" | "require" | "allow"
export type OperatingRuleScope = {
  channel: SocialChannel | "all"
  contentType: "all" | "advertising"
  campaign: string | null
  communicationElement: "copy" | "caption" | "all"
}
export type OperatingRuleDraft = {
  kind: OperatingRuleKind
  effect: OperatingRuleEffect
  parameter: string | null
  directive: string
  scope: OperatingRuleScope
}
export type OperatingRule = OperatingRuleDraft & {
  id: string
  revision: number
  status: "active" | "superseded" | "reverted"
  sourceNoteId: string
  supersededBy: string | null
  activatedAt: string
  deactivatedAt: string | null
}
export type ChannelOperatingPolicy = { channel: SocialChannel; active: boolean; revision: number; updatedAt: string }

export function ruleApplies(rule: OperatingRuleDraft, input: { channel: SocialChannel; contentType?: string | null }) {
  if (rule.scope.channel !== "all" && rule.scope.channel !== input.channel) return false
  return rule.scope.contentType === "all" || rule.scope.contentType === input.contentType
}

export function ruleSubject(rule: OperatingRuleDraft) {
  return `${rule.kind}:${rule.kind === "term" ? rule.parameter?.toLocaleLowerCase("ka-GE") ?? "" : ""}`
}

export function ruleScopeOverlaps(a: OperatingRuleScope, b: OperatingRuleScope) {
  const channel = a.channel === "all" || b.channel === "all" || a.channel === b.channel
  const content = a.contentType === "all" || b.contentType === "all" || a.contentType === b.contentType
  const campaign = !a.campaign || !b.campaign || a.campaign === b.campaign
  const element = a.communicationElement === "all" || b.communicationElement === "all" || a.communicationElement === b.communicationElement
  return channel && content && campaign && element
}

export function operatingRuleViolations(text: string, rules: readonly OperatingRuleDraft[]) {
  const issues: string[] = []
  for (const rule of rules) {
    if (rule.kind === "emoji" && rule.effect === "forbid" && /\p{Extended_Pictographic}/u.test(text)) issues.push("Active operating rule forbids emoji")
    if (rule.kind === "price" && rule.effect === "forbid" && /(?:₾|\$|€|\b\d+(?:[.,]\d+)?\s*(?:ლარი|ლარად|gel|usd|eur)\b)/iu.test(text)) issues.push("Active operating rule forbids prices")
    if (rule.kind === "term" && rule.effect === "forbid" && rule.parameter && text.toLocaleLowerCase("ka-GE").includes(rule.parameter.toLocaleLowerCase("ka-GE"))) issues.push(`Active operating rule forbids term: ${rule.parameter}`)
  }
  return issues
}
