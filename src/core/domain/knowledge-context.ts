import type {
  ClaimContextAudience,
  ClaimContextChannel,
  ClaimContextLocale,
  ClaimContextScope,
} from "./primitives"

export type KnowledgeContextDimension =
  | "channel"
  | "audience"
  | "locale"
  | "scope"

type KnowledgeClaimContextFields = {
  readonly channel?: ClaimContextChannel
  readonly audience?: ClaimContextAudience
  readonly locale?: ClaimContextLocale
  readonly scope?: ClaimContextScope
}

/** A present context must contain at least one dimension; absence means general. */
export type KnowledgeClaimContext = {
  readonly [Dimension in keyof KnowledgeClaimContextFields]-?: Readonly<
    Required<Pick<KnowledgeClaimContextFields, Dimension>> &
      Partial<Omit<KnowledgeClaimContextFields, Dimension>>
  >
}[keyof KnowledgeClaimContextFields]
