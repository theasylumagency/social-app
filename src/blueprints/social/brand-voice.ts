import type { BrandUnderstanding, DiscoverySource, SourceCitation } from "./brand-discovery/model"
import { normalizeExcerpt } from "./brand-discovery/validation"

/** Independent dimensions: uncertainty about truth does not prescribe delivery. */
export const VOICE_DIMENSIONS = ["epistemicStance", "rhetoricalStance", "argumentStructure", "rhythm", "explanation", "avoid"] as const
export type VoiceBehavior = SourceCitation & {
  dimension: typeof VOICE_DIMENSIONS[number]
  instruction: string
}

export function compileBrandVoice(voice: BrandUnderstanding["voice"], sources: readonly DiscoverySource[]) {
  const verified = (citation: SourceCitation) => {
    const source = sources.find((s) => s.key === citation.sourceKey)
    const quote = normalizeExcerpt(citation.exactExcerpt)
    return !!source && quote.length >= 12 && normalizeExcerpt(source.text).includes(quote)
  }
  return {
    primaryTone: voice.traits,
    languageRules: voice.principles,
    // Older dossiers remain usable. Never infer new intensity from labels/defaults.
    behaviors: (voice.behaviors ?? []).filter(verified),
    references: voice.examples.filter(verified).slice(0, 3),
    referenceUse: "styleOnly" as const,
  }
}

export type CompiledBrandVoice = ReturnType<typeof compileBrandVoice>
export function voiceCriteria(voice: CompiledBrandVoice): string[] {
  return [...voice.primaryTone, ...voice.languageRules, ...voice.behaviors.map((b) => b.instruction)]
}
