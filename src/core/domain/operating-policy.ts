export const SOCIAL_CHANNELS = ["facebook", "instagram"] as const
export type SocialChannel = typeof SOCIAL_CHANNELS[number]

export const OPERATING_CONTENT_TYPES = ["organic", "advertising"] as const
export type OperatingContentType = typeof OPERATING_CONTENT_TYPES[number]
export const COMMUNICATION_ELEMENTS = ["caption", "script", "on_screen_text", "frame_text"] as const
export type CommunicationElement = typeof COMMUNICATION_ELEMENTS[number]

export const OPERATING_RULE_KINDS = ["emoji", "price", "address_form", "term"] as const
export type OperatingRuleKind = typeof OPERATING_RULE_KINDS[number]
export type OperatingRuleEffect = "forbid" | "require" | "allow"
export type ScopeSelector<T extends string> = { include: "all" | T[]; exclude: T[] }
export type OperatingRuleScope = {
  channels: ScopeSelector<SocialChannel>
  contentTypes: ScopeSelector<OperatingContentType>
  campaigns: ScopeSelector<string>
  communicationElements: ScopeSelector<CommunicationElement>
}
type LegacyOperatingRuleScope = {
  channel?: SocialChannel | "all"
  contentType?: OperatingContentType | "all"
  campaign?: string | null
  communicationElement?: CommunicationElement | "copy" | "all"
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
export type OperatingRuleExecutionContext = {
  channel: SocialChannel
  contentType?: OperatingContentType | null
  campaign?: string | null
  communicationElement?: CommunicationElement | null
}

const selector = <T extends string>(value: "all" | T | readonly T[] = "all"): ScopeSelector<T> => ({ include: value === "all" ? "all" : [...new Set(Array.isArray(value) ? value : [value])].sort() as T[], exclude: [] })
export function operatingRuleScope(input: { channel?: SocialChannel | "all"; contentType?: OperatingContentType | "all"; campaign?: string | null; communicationElement?: CommunicationElement | "all" } = {}): OperatingRuleScope {
  return {
    channels: selector(input.channel ?? "all"),
    contentTypes: selector(input.contentType ?? "all"),
    campaigns: selector(input.campaign ?? "all"),
    communicationElements: selector(input.communicationElement ?? "all"),
  }
}

const cleanSelector = <T extends string>(value: unknown, fallback: ScopeSelector<T>): ScopeSelector<T> => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return fallback
  const raw = value as { include?: unknown; exclude?: unknown }
  const include = raw.include === "all" ? "all" : Array.isArray(raw.include) ? [...new Set(raw.include.filter((v): v is T => typeof v === "string"))].sort() : fallback.include
  const exclude = Array.isArray(raw.exclude) ? [...new Set(raw.exclude.filter((v): v is T => typeof v === "string"))].sort() : []
  return { include, exclude: exclude.filter(value => include === "all" || !include.includes(value)) }
}

/** Reads both the current selector form and rule snapshots saved before migration 0019. */
export function normalizeRuleScope(value: unknown): OperatingRuleScope {
  const raw = value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {}
  if (raw.channels || raw.contentTypes || raw.campaigns || raw.communicationElements) return {
    channels: cleanSelector(raw.channels, selector<SocialChannel>()),
    contentTypes: cleanSelector(raw.contentTypes, selector<OperatingContentType>()),
    campaigns: cleanSelector(raw.campaigns, selector<string>()),
    communicationElements: cleanSelector(raw.communicationElements, selector<CommunicationElement>()),
  }
  const legacy = raw as LegacyOperatingRuleScope
  return operatingRuleScope({
    channel: legacy.channel ?? "all",
    contentType: legacy.contentType ?? "all",
    campaign: legacy.campaign ?? null,
    communicationElement: legacy.communicationElement === "copy" ? "all" : legacy.communicationElement ?? "all",
  })
}

function selectorMatches<T extends string>(scope: ScopeSelector<T>, value: T | null | undefined) {
  // Unknown execution dimensions may only receive a truly unconstrained rule.
  if (value == null) return scope.include === "all" && scope.exclude.length === 0
  return (scope.include === "all" || scope.include.includes(value)) && !scope.exclude.includes(value)
}

export function ruleApplies(rule: Pick<OperatingRuleDraft, "scope">, input: OperatingRuleExecutionContext) {
  const scope = normalizeRuleScope(rule.scope)
  return selectorMatches(scope.channels, input.channel)
    && selectorMatches(scope.contentTypes, input.contentType)
    && selectorMatches(scope.campaigns, input.campaign)
    && selectorMatches(scope.communicationElements, input.communicationElement)
}

export function ruleSubject(rule: OperatingRuleDraft) {
  return `${rule.kind}:${rule.kind === "term" ? rule.parameter?.toLocaleLowerCase("ka-GE") ?? "" : ""}`
}

const selectorIntersection = <T extends string>(a: ScopeSelector<T>, b: ScopeSelector<T>, universe?: readonly T[]): ScopeSelector<T> | null => {
  if (a.include === "all" && b.include === "all") {
    const result: ScopeSelector<T> = { include: "all", exclude: [...new Set([...a.exclude, ...b.exclude])].sort() }
    return universe?.every(value => result.exclude.includes(value)) ? null : result
  }
  let values: T[]
  if (a.include === "all") values = b.include as T[]
  else if (b.include === "all") values = a.include
  else values = a.include.filter(value => b.include !== "all" && b.include.includes(value))
  const include = values.filter(value => !a.exclude.includes(value) && !b.exclude.includes(value))
  return include.length ? { include: [...new Set(include)].sort(), exclude: [] } : null
}

const selectorDifference = <T extends string>(a: ScopeSelector<T>, b: ScopeSelector<T>, universe?: readonly T[]): ScopeSelector<T> | null => {
  if (a.include !== "all") {
    const include = a.include.filter(value => selectorMatches(a, value) && !selectorMatches(b, value))
    return include.length ? { include, exclude: [] } : null
  }
  if (b.include === "all") {
    const include = b.exclude.filter(value => !a.exclude.includes(value))
    return include.length ? { include: [...new Set(include)].sort(), exclude: [] } : null
  }
  const newlyExcluded = b.include.filter(value => !b.exclude.includes(value))
  const result: ScopeSelector<T> = { include: "all", exclude: [...new Set([...a.exclude, ...newlyExcluded])].sort() }
  return universe?.every(value => result.exclude.includes(value)) ? null : result
}

export function ruleScopeOverlaps(left: OperatingRuleScope, right: OperatingRuleScope) {
  const a = normalizeRuleScope(left), b = normalizeRuleScope(right)
  return !!selectorIntersection(a.channels, b.channels, SOCIAL_CHANNELS)
    && !!selectorIntersection(a.contentTypes, b.contentTypes, OPERATING_CONTENT_TYPES)
    && !!selectorIntersection(a.campaigns, b.campaigns)
    && !!selectorIntersection(a.communicationElements, b.communicationElements, COMMUNICATION_ELEMENTS)
}

/** Returns disjoint rectangular scopes representing existing minus incoming. */
export function subtractRuleScope(existing: OperatingRuleScope, incoming: OperatingRuleScope): OperatingRuleScope[] {
  const a = normalizeRuleScope(existing), b = normalizeRuleScope(incoming)
  if (!ruleScopeOverlaps(a, b)) return [a]
  const keys = ["channels", "contentTypes", "campaigns", "communicationElements"] as const
  const residuals: OperatingRuleScope[] = []
  let prefix = { ...a }
  for (const key of keys) {
    const universe = key === "channels" ? SOCIAL_CHANNELS : key === "contentTypes" ? OPERATING_CONTENT_TYPES : key === "communicationElements" ? COMMUNICATION_ELEMENTS : undefined
    const difference = selectorDifference(prefix[key] as ScopeSelector<string>, b[key] as ScopeSelector<string>, universe)
    if (difference) residuals.push({ ...prefix, [key]: difference } as OperatingRuleScope)
    const intersection = selectorIntersection(prefix[key] as ScopeSelector<string>, b[key] as ScopeSelector<string>, universe)
    if (!intersection) return [a]
    prefix = { ...prefix, [key]: intersection } as OperatingRuleScope
  }
  return residuals
}

export function operatingRuleViolations(text: string, rules: readonly OperatingRuleDraft[]) {
  const issues: string[] = []
  for (const rule of rules) {
    const emojis = text.match(/\p{Extended_Pictographic}/gu)?.length ?? 0
    if (rule.kind === "emoji" && rule.effect === "forbid" && emojis) issues.push("Active operating rule forbids emoji")
    if (rule.kind === "emoji" && rule.effect === "allow" && rule.parameter && emojis > Number(rule.parameter)) issues.push(`Active operating rule allows at most ${rule.parameter} emoji`)
    if (rule.kind === "price" && rule.effect === "forbid" && /(?:₾|\$|€|\b\d+(?:[.,]\d+)?\s*(?:ლარი|ლარად|gel|usd|eur)\b)/iu.test(text)) issues.push("Active operating rule forbids prices")
    if (rule.kind === "term" && rule.effect === "forbid" && rule.parameter && text.toLocaleLowerCase("ka-GE").includes(rule.parameter.toLocaleLowerCase("ka-GE"))) issues.push(`Active operating rule forbids term: ${rule.parameter}`)
    // Georgian address form needs sentence-level editorial judgment; it is checked by the semantic reviewer.
  }
  return issues
}

export function operatingRuleEnforcement(rule: Pick<OperatingRuleDraft, "kind">) {
  return rule.kind === "address_form" ? "semantic" as const : "deterministic" as const
}

export function operatingRuleScopeLabel(scopeValue: OperatingRuleScope) {
  const scope = normalizeRuleScope(scopeValue)
  const describe = <T extends string>(value: ScopeSelector<T>, all: string) => `${value.include === "all" ? all : value.include.join(", ")}${value.exclude.length ? `, გარდა ${value.exclude.join(", ")}` : ""}`
  const parts = [describe(scope.channels, "ყველა არხი")]
  if (scope.contentTypes.include !== "all" || scope.contentTypes.exclude.length) parts.push(describe(scope.contentTypes, "ყველა კონტენტის ტიპი"))
  if (scope.campaigns.include !== "all" || scope.campaigns.exclude.length) parts.push(describe(scope.campaigns, "ყველა კამპანია"))
  if (scope.communicationElements.include !== "all" || scope.communicationElements.exclude.length) parts.push(describe(scope.communicationElements, "ყველა ტექსტური ველი"))
  return parts.join(" · ")
}
