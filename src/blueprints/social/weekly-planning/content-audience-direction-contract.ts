export type ContentAudienceBiasProposal =
    | "balanced"
    | "moreExplanatory"
    | "moreDecisionOriented"
    | "moreTrustFocused"
    | "morePractical"

export type ContentAudienceDirectionProposal = {
    /**
     * Run-local opaque key supplied by the application.
     */
    readonly contentDirectionKey: string

    /**
     * Must reference one audience from Weekly Audience Focus.
     */
    readonly primaryAudienceKey: string

    /**
     * May contain only another audience from Weekly Audience Focus.
     * v1 Weekly Focus has at most two audiences total.
     */
    readonly secondaryAudienceKeys: readonly string[]

    /**
     * Small communication shift inside the Communication Envelope.
     */
    readonly bias: ContentAudienceBiasProposal
}

export type ContentAudienceDirectionModelOutput = {
    readonly directions:
    readonly ContentAudienceDirectionProposal[]
}