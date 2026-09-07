export type WeeklyObjectiveProposal = {
    /**
     * One clear outcome-oriented objective for this week.
     * Must describe useful progress, not content activity.
     */
    readonly objective: string

    /**
     * Why this objective is the most useful choice now.
     */
    readonly rationale: string

    /**
     * What should intentionally NOT become a priority this week.
     * Keeps the plan focused.
     */
    readonly deliberateOmissions: readonly string[]
}

export type WeeklyObjectiveModelOutput = {
    readonly weeklyObjective: WeeklyObjectiveProposal
}