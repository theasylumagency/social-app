import type { BrandUnderstanding, DiscoverySource, SourceCitation } from "./model"

type Schema = { type?: string | string[]; properties?: Record<string, Schema>; required?: readonly string[]; additionalProperties?: boolean; items?: Schema; enum?: readonly unknown[]; minItems?: number; maxItems?: number; minLength?: number; maxLength?: number }

export function validateSchema(value: unknown, schema: Schema, path = "output"): string[] {
  if (Array.isArray(schema.type)) {
    if (value === null && schema.type.includes("null")) return []
    const type = schema.type.find((type) => type === typeof value)
    return type ? validateSchema(value, { ...schema, type }, path) : [`${path}: invalid nullable value`]
  }
  const errors: string[] = []
  if (schema.enum && !schema.enum.includes(value)) return [`${path}: invalid enum`]
  if (schema.type === "object") {
    if (!value || typeof value !== "object" || Array.isArray(value)) return [`${path}: expected object`]
    const record = value as Record<string, unknown>
    for (const key of schema.required ?? []) if (!(key in record)) errors.push(`${path}.${key}: required`)
    for (const [key, entry] of Object.entries(record)) {
      const child = schema.properties?.[key]
      if (child) errors.push(...validateSchema(entry, child, `${path}.${key}`))
      else if (schema.additionalProperties === false) errors.push(`${path}.${key}: unexpected authority/property`)
    }
  } else if (schema.type === "array") {
    if (!Array.isArray(value)) return [`${path}: expected array`]
    if (value.length < (schema.minItems ?? 0) || value.length > (schema.maxItems ?? 30)) errors.push(`${path}: invalid item count`)
    if (schema.items) value.forEach((entry, i) => errors.push(...validateSchema(entry, schema.items!, `${path}[${i}]`)))
  } else if (schema.type === "string") {
    if (typeof value !== "string") return [`${path}: expected string`]
    if (value.trim().length < (schema.minLength ?? 1) || value.length > (schema.maxLength ?? 1800)) errors.push(`${path}: invalid text length`)
  } else if (schema.type === "number" && (typeof value !== "number" || !Number.isFinite(value))) errors.push(`${path}: expected finite number`)
  return errors
}

export const normalizeExcerpt = (value: string) => value.normalize("NFKC").replace(/\s+/gu, " ").trim()

type CitationEntry = { path: string; citation: SourceCitation }
function understandingCitations(value: BrandUnderstanding): CitationEntry[] {
  return [
    ...value.offers.map((citation, i) => ({ path: `offers[${i}]`, citation })),
    ...value.distinctiveSignals.map((citation, i) => ({ path: `distinctiveSignals[${i}]`, citation })),
    ...value.audienceSignals.map((citation, i) => ({ path: `audienceSignals[${i}]`, citation })),
    ...value.voice.examples.map((citation, i) => ({ path: `voice.examples[${i}]`, citation })),
    ...(value.voice.behaviors ?? []).map((citation, i) => ({ path: `voice.behaviors[${i}]`, citation })),
  ]
}

type Fingerprint = { text: string; starts: number[]; ends: number[] }
function citationFingerprint(value: string): Fingerprint {
  let text = ""
  const starts: number[] = [], ends: number[] = []
  for (let offset = 0; offset < value.length;) {
    const point = value.codePointAt(offset)!
    const character = String.fromCodePoint(point)
    const end = offset + character.length
    for (const normalized of character.normalize("NFKC").toLocaleLowerCase("und")) {
      if (/\s|\p{Cf}/u.test(normalized)) continue
      const comparable = /[‘’‚‛`´]/u.test(normalized) ? "'"
        : /[“”„‟«»]/u.test(normalized) ? '"'
          : /[‐‑‒–—―−]/u.test(normalized) ? "-"
            : normalized
      text += comparable; starts.push(offset); ends.push(end)
    }
    offset = end
  }
  return { text, starts, ends }
}

/**
 * Recover the actual contiguous source substring when the proposal changed only
 * case, whitespace or punctuation. Words, letters and numbers must still match.
 */
export function anchorSourceExcerpt(candidate: string, sourceText: string): string | null {
  const wanted = citationFingerprint(candidate).text
  if ((wanted.match(/[\p{L}\p{N}]/gu)?.length ?? 0) < 12) return null
  const source = citationFingerprint(sourceText)
  const at = source.text.indexOf(wanted)
  if (at < 0) return null
  let start = source.starts[at], end = source.ends[at + wanted.length - 1]
  if (start === undefined || end === undefined) return null
  const before = sourceText.slice(0, start).match(/[\p{L}\p{N}]$/u)
  const after = sourceText.slice(end).match(/^[\p{L}\p{N}]/u)
  if (before || after) return null
  // Preserve source typography around the matched words. This matters for voice
  // references, and the result is still an exact contiguous source substring.
  while (start > 0 && /[\p{P}\p{S}]/u.test(sourceText[start - 1]!)) start--
  while (end < sourceText.length && /[\p{P}\p{S}]/u.test(sourceText[end]!)) end++
  return sourceText.slice(start, end).trim()
}

/** Application-owned provenance repair; it cannot create or paraphrase evidence. */
export function anchorUnderstandingCitations(value: BrandUnderstanding, sources: readonly DiscoverySource[]): BrandUnderstanding {
  const anchored = structuredClone(value)
  const sourceMap = new Map(sources.map((source) => [source.key, source.text]))
  for (const { citation } of understandingCitations(anchored)) {
    const source = sourceMap.get(citation.sourceKey)
    if (!source) continue
    const exact = anchorSourceExcerpt(citation.exactExcerpt, source)
    if (exact) citation.exactExcerpt = exact
  }
  return anchored
}

export function validateUnderstanding(value: BrandUnderstanding, sources: readonly DiscoverySource[]): string[] {
  const errors: string[] = []
  const sourceMap = new Map(sources.map((source) => [source.key, normalizeExcerpt(source.text)]))
  for (const { path, citation } of understandingCitations(value)) {
    const source = sourceMap.get(citation.sourceKey)
    const quote = normalizeExcerpt(citation.exactExcerpt)
    if (!source || quote.length < 12 || !source.includes(quote)) errors.push(`Unverifiable source excerpt at ${path}: ${citation.sourceKey}`)
  }
  const names = value.offers.map((offer) => offer.name.trim().toLocaleLowerCase())
  if (new Set(names).size !== names.length) errors.push("Duplicate offers")
  if (value.offers.some((offer) => /^(?:and\b|და\s)|\bcase file\s*[a-z]?$/iu.test(offer.name) || /^[),;]/u.test(offer.name))) errors.push("Offers contain sentence fragments or case-study labels")
  return errors
}

export function validateReferences(keys: readonly string[], allowed: readonly string[], label: string): string[] {
  if (new Set(keys).size !== keys.length) return [`${label}: duplicate references`]
  return keys.filter((key) => !allowed.includes(key)).map((key) => `${label}: unknown reference ${key}`)
}
