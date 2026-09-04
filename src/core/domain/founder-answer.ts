import type { FounderDecisionDraft } from "./founder-decision"

export type StructuredFounderAnswer =
  | { readonly kind: "choice"; readonly optionId: string }
  | { readonly kind: "boolean"; readonly value: boolean }
  | { readonly kind: "value"; readonly value: unknown }

export type FreeTextFounderAnswer = {
  readonly kind: "freeText"
  readonly text: string
}

export type FounderAnswer = StructuredFounderAnswer | FreeTextFounderAnswer

export type InterpretedFounderAnswer = {
  readonly decisions: readonly FounderDecisionDraft[]
}
