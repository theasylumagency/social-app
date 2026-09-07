export type WeeklyExperimentProposal = {
    readonly hypothesis: string
    readonly variable: string
    readonly comparison: string
    readonly learningSignal: string
    readonly guardrails: readonly string[]
}

/**
 * Semantic/domain decision.
 * Application may normalize the model transport into this shape.
 */
export type ExperimentDecisionProposal =
    | {
        readonly decision: "noExperiment"
        readonly rationale: string
        readonly experiment: null
    }
    | {
        readonly decision: "experiment"
        readonly rationale: string
        readonly experiment: WeeklyExperimentProposal
    }

/**
 * OpenAI Structured Outputs transport shape.
 *
 * We avoid oneOf/discriminated JSON Schema branches.
 * For noExperiment:
 * - all four experiment fields are null
 * - guardrails is []
 *
 * For experiment:
 * - all four fields are non-null strings
 */
export type ExperimentDecisionStructuredProposal = {
    readonly decision:
    | "noExperiment"
    | "experiment"

    readonly rationale: string

    readonly experiment: {
        readonly hypothesis:
        string | null

        readonly variable:
        string | null

        readonly comparison:
        string | null

        readonly learningSignal:
        string | null

        readonly guardrails:
        readonly string[]
    }
}

export type ExperimentDecisionModelOutput = {
    readonly experimentDecision:
    ExperimentDecisionStructuredProposal
}