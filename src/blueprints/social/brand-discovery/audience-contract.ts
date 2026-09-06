export type AudienceHypothesisProposal = {
    readonly name: string
    readonly buyingSituation: string
    readonly currentNeed: string

    readonly relevantOffers: readonly string[]
    readonly mainQuestions: readonly string[]
    readonly likelyBarriers: readonly string[]

    readonly decisionStage:
    | "unaware"
    | "problemAware"
    | "solutionAware"
    | "providerComparison"
    | "decisionReady"
    | "existingCustomer"
    | "returningCustomer"

    readonly evidenceKeys: readonly string[]

    readonly rationale: string
    readonly assumptions: readonly string[]

    readonly confidenceBand:
    | "tentative"
    | "reasonable"
    | "strong"
}

export type AudienceHypothesisModelOutput = {
    readonly segments: readonly AudienceHypothesisProposal[]
}