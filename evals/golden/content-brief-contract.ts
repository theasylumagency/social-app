export type ContentBriefProposal = {
    /**
     * One concrete communication job for one content item.
     *
     * More specific than Content Direction,
     * but still not final copy.
     */
    readonly communicationJob: string

    /**
     * The single most important takeaway.
     */
    readonly keyTakeaway: string

    /**
     * 2–5 supporting ideas the Writer should cover.
     *
     * Not sentences, hooks or caption copy.
     */
    readonly supportingPoints:
    readonly string[]

    /**
     * Evidence strategy for this item.
     */
    readonly evidenceMode:
    | "noProofNeeded"
    | "evidenceSupported"
    | "proofRequired"

    /**
     * Evidence references selected only from
     * the evidence supplied to the model.
     *
     * These are temporary semantic keys,
     * not persistent EvidenceIds.
     */
    readonly evidenceKeys:
    readonly string[]

    /**
     * Desired next-step intent.
     */
    readonly ctaIntent:
    | "none"
    | "inform"
    | "encourageReflection"
    | "inviteQuestion"
    | "inviteConsultation"
    | "directAction"

    /**
     * Writer-facing boundaries specific
     * to this content item.
     */
    readonly constraints:
    readonly string[]

    /**
     * Explicit claims, framings or scope
     * that should not appear.
     */
    readonly mustNotSay:
    readonly string[]

    /**
     * Why this is a useful execution of
     * the selected weekly direction.
     */
    readonly rationale: string
}

export type ContentBriefModelOutput = {
    readonly contentBrief:
    ContentBriefProposal
}