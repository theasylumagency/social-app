export type WeeklyAudienceFocusProposal = {
    readonly primaryAudienceKey: string

    /**
     * v1: მაქსიმუმ ერთი secondary audience.
     * ანუ კვირის რეალური focus არის 1–2 audience situation.
     */
    readonly secondaryAudienceKeys: readonly string[]

    /**
     * User-safe managerial explanation:
     * why these audiences matter for this week's objective.
     */
    readonly rationale: string
}

export type WeeklyAudienceFocusModelOutput = {
    readonly focus: WeeklyAudienceFocusProposal
}