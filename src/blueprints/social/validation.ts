import type {
  ClaimDetectionSignal,
  ClaimSignalStrength,
  ClaimSignalSource,
  ClaimSignalType,
} from "../../core/domain"
import { SOCIAL_CLAIM_SIGNAL_TYPES } from "./tokens"

export type SocialLexiconMatchKind = "exact" | "stem" | "phrase" | "regex"

export type SocialClaimLexiconRule = {
  readonly id: string
  readonly signalType: ClaimSignalType
  readonly match: SocialLexiconMatchKind
  readonly pattern: string
  readonly signalStrength: ClaimSignalStrength
  readonly source: ClaimSignalSource
}

const signals = SOCIAL_CLAIM_SIGNAL_TYPES

export const SOCIAL_GEORGIAN_CLAIM_LEXICON = [
  { id: "superlative-best", signalType: signals.superlative, match: "stem", pattern: "საუკეთესო", signalStrength: "high", source: "lexical" },
  { id: "superlative-most", signalType: signals.superlative, match: "stem", pattern: "ყველაზე", signalStrength: "high", source: "lexical" },
  { id: "superlative-leader", signalType: signals.superlative, match: "stem", pattern: "ლიდერ", signalStrength: "medium", source: "lexical" },
  { id: "superlative-only", signalType: signals.superlative, match: "stem", pattern: "ერთადერთ", signalStrength: "high", source: "lexical" },
  { id: "guaranteed", signalType: signals.guarantee, match: "stem", pattern: "გარანტირებულ", signalStrength: "high", source: "lexical" },
  { id: "guarantee", signalType: signals.guarantee, match: "stem", pattern: "გარანტი", signalStrength: "medium", source: "lexical" },
  { id: "painless", signalType: signals.clinicalOutcome, match: "stem", pattern: "უმტკივნეულ", signalStrength: "high", source: "lexical" },
  { id: "pain-free", signalType: signals.clinicalOutcome, match: "phrase", pattern: "ტკივილის გარეშე", signalStrength: "high", source: "pattern" },
  { id: "free", signalType: signals.price, match: "stem", pattern: "უფასო", signalStrength: "high", source: "lexical" },
  { id: "one-hundred-percent", signalType: signals.numeric, match: "exact", pattern: "100%", signalStrength: "high", source: "lexical" },
  { id: "one-hundred-percent-inflected", signalType: signals.numeric, match: "regex", pattern: "100\\s*%", signalStrength: "high", source: "structured" },
  { id: "more-than", signalType: signals.comparative, match: "regex", pattern: "უფრო\\s+[^.!?\\n]{1,80}?\\s+ვიდრე", signalStrength: "high", source: "pattern" },
  { id: "better-than", signalType: signals.comparative, match: "regex", pattern: "(?:\\p{L}+ზე|-ზე)\\s+უკეთეს\\p{L}*", signalStrength: "high", source: "pattern" },
  { id: "guaranteed-result", signalType: signals.clinicalOutcome, match: "regex", pattern: "(?:შედეგ\\p{L}*.{0,40}გარანტირ\\p{L}*|გარანტირ\\p{L}*.{0,40}შედეგ\\p{L}*)", signalStrength: "high", source: "pattern" },
  { id: "gel-amount", signalType: signals.price, match: "regex", pattern: "\\d+(?:[.,]\\d+)?\\s*(?:₾|ლარ\\p{L}*)", signalStrength: "high", source: "structured" },
  { id: "price-starts", signalType: signals.price, match: "regex", pattern: "ფასი\\s+იწყება\\s+\\d+", signalStrength: "high", source: "pattern" },
  { id: "discount", signalType: signals.discount, match: "regex", pattern: "\\d+(?:[.,]\\d+)?\\s*%\\s*ფასდაკლებ\\p{L}*", signalStrength: "high", source: "structured" },
  { id: "price-noise", signalType: signals.price, match: "stem", pattern: "ფას", signalStrength: "low", source: "lexical" },
  { id: "only-today", signalType: signals.availability, match: "phrase", pattern: "მხოლოდ დღეს", signalStrength: "high", source: "pattern" },
  { id: "certified", signalType: signals.credential, match: "stem", pattern: "სერტიფიცირებულ", signalStrength: "medium", source: "lexical" },
  { id: "award", signalType: signals.award, match: "stem", pattern: "ჯილდო", signalStrength: "medium", source: "lexical" },
  { id: "years-experience", signalType: signals.experience, match: "regex", pattern: "\\d+\\s*წლ\\p{L}*\\s+გამოცდილებ\\p{L}*", signalStrength: "high", source: "structured" },
] as const satisfies readonly SocialClaimLexiconRule[]

type LocatedSignal = ClaimDetectionSignal & {
  readonly start: number
  readonly end: number
}

const TOKEN_PATTERN = /[\p{L}\p{N}%₾-]+/gu
const strengthRank: Readonly<Record<ClaimSignalStrength, number>> = {
  low: 0,
  medium: 1,
  high: 2,
}

function tokenMatches(
  text: string,
  rule: SocialClaimLexiconRule,
): readonly { readonly start: number; readonly end: number }[] {
  const matches: { start: number; end: number }[] = []
  for (const match of text.matchAll(TOKEN_PATTERN)) {
    const value = match[0]
    const start = match.index
    const matched = rule.match === "exact" ? value === rule.pattern : value.startsWith(rule.pattern)
    if (matched) {
      matches.push({ start, end: start + value.length })
    }
  }
  return matches
}

function phraseMatches(
  text: string,
  phrase: string,
): readonly { readonly start: number; readonly end: number }[] {
  const matches: { start: number; end: number }[] = []
  let start = text.indexOf(phrase)
  while (start !== -1) {
    matches.push({ start, end: start + phrase.length })
    start = text.indexOf(phrase, start + phrase.length)
  }
  return matches
}

function regexMatches(
  text: string,
  pattern: string,
): readonly { readonly start: number; readonly end: number }[] {
  return Array.from(text.matchAll(new RegExp(pattern, "gu")), (match) => ({
    start: match.index,
    end: match.index + match[0].length,
  }))
}

function findRuleMatches(
  text: string,
  rule: SocialClaimLexiconRule,
): readonly { readonly start: number; readonly end: number }[] {
  if (rule.match === "exact" || rule.match === "stem") {
    return tokenMatches(text, rule)
  }
  if (rule.match === "phrase") {
    return phraseMatches(text, rule.pattern)
  }
  return regexMatches(text, rule.pattern)
}

export function scanGeorgianClaimSignals(draft: string): readonly ClaimDetectionSignal[] {
  const normalized = draft.normalize("NFKC").toLowerCase()
  const located = new Map<string, LocatedSignal>()

  for (const rule of SOCIAL_GEORGIAN_CLAIM_LEXICON) {
    for (const match of findRuleMatches(normalized, rule)) {
      const key = `${rule.signalType}:${match.start}:${match.end}`
      const candidate: LocatedSignal = {
        type: rule.signalType,
        span: draft.slice(match.start, match.end),
        signalStrength: rule.signalStrength,
        source: rule.source,
        start: match.start,
        end: match.end,
      }
      const current = located.get(key)
      if (
        current === undefined ||
        strengthRank[candidate.signalStrength] > strengthRank[current.signalStrength]
      ) {
        located.set(key, candidate)
      }
    }
  }

  return Array.from(located.values())
    .sort((left, right) => left.start - right.start || left.end - right.end)
    .map((signal) => ({
      type: signal.type,
      span: signal.span,
      signalStrength: signal.signalStrength,
      source: signal.source,
    }))
}
