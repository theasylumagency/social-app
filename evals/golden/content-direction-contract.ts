export type ContentDirectionProposal = {
    /**
     * Strategic communication direction for the week.
     *
     * Describes what territory the content should explore,
     * not a specific post, format, hook, or channel execution.
     */
    readonly direction: string

    /**
     * What useful progress this direction should contribute
     * toward the Weekly Objective.
     */
    readonly purpose: string

    /**
     * Why this direction deserves a place in this specific week.
     *
     * Short managerial explanation, not hidden reasoning.
     */
    readonly rationale: string
}

export type ContentDirectionModelOutput = {
    /**
     * v1 weekly planning range.
     */
    readonly directions:
    readonly ContentDirectionProposal[]
}