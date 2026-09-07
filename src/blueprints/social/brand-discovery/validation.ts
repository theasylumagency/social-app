import type { BrandUnderstanding, DiscoverySource } from "./model"

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

export function validateUnderstanding(value: BrandUnderstanding, sources: readonly DiscoverySource[]): string[] {
  const errors: string[] = []
  const sourceMap = new Map(sources.map((source) => [source.key, normalizeExcerpt(source.text)]))
  for (const citation of [...value.offers, ...value.distinctiveSignals, ...value.audienceSignals, ...value.voice.examples]) {
    const source = sourceMap.get(citation.sourceKey)
    const quote = normalizeExcerpt(citation.exactExcerpt)
    if (!source || quote.length < 12 || !source.includes(quote)) errors.push(`Unverifiable source excerpt: ${citation.sourceKey}`)
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
