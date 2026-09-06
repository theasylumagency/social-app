export type WeeklyExperimentProposal = {
    /**
     * One falsifiable thing we want to learn.
     *
     * This is not a goal like "get more engagement".
     */
    readonly hypothesis: string

    /**
     * What meaningful factor is intentionally varied.
     *
     * Example:
     * "explanation framing"
     */
    readonly variable: string

    /**
     * What two approaches are being compared.
     *
     * Must remain narrow enough that learning is interpretable.
     */
    readonly comparison: string

    /**
     * What observable signal would support or weaken
     * the hypothesis.
     *
     * Does not imply statistical certainty.
     */
    readonly learningSignal: string

    /**
     * Conditions that keep the experiment inside
     * Brand Voice, Communication Envelope and weekly strategy.
     */
    readonly guardrails: readonly string[]
}

export type ExperimentDecisionProposal =
    | {
        readonly decision: "noExperiment"

        /**
         * Why adding an experiment would not improve
         * this week's useful progress.
         */
        readonly rationale: string

        readonly experiment: null
    }
    | {
        readonly decision: "experiment"

        /**
         * Why this experiment deserves scarce weekly attention.
         */
        readonly rationale: string

        readonly experiment: WeeklyExperimentProposal
    }

export type ExperimentDecisionModelOutput = {
    readonly experimentDecision:
    ExperimentDecisionProposal
}