export type ContentExecutionChannelProposal =
    | "facebook"
    | "instagram"

export type ContentExecutionModeProposal =
    | "social.brandStory"
    | "social.educational"
    | "social.serviceExplainer"
    | "social.trustBuilder"
    | "social.proofLed"
    | "social.directOffer"

export type ContentExecutionFormatProposal =
    | "staticPost"
    | "carousel"
    | "story"
    | "reel"

export type ContentExecutionDepthProposal =
    | "compact"
    | "standard"
    | "deep"

export type ContentVisualDependencyProposal =
    | "none"
    | "supporting"
    | "essential"

export type ContentExecutionSpecProposal = {
    /**
     * One destination only.
     *
     * Must be selected from channels explicitly
     * supplied as eligible by the application.
     */
    readonly channel:
    ContentExecutionChannelProposal

    /**
     * Canonical Social content mode.
     *
     * Must be compatible with the Content Brief
     * and available capabilities.
     */
    readonly contentMode:
    ContentExecutionModeProposal

    /**
     * One format for this specific destination.
     */
    readonly format:
    ContentExecutionFormatProposal

    /**
     * Relative amount of explanatory room.
     *
     * Not an exact character count.
     */
    readonly depth:
    ContentExecutionDepthProposal

    /**
     * Whether successful execution depends
     * on visual material.
     */
    readonly visualDependency:
    ContentVisualDependencyProposal

    /**
     * Format-aware guidance for the Writer.
     *
     * Must describe execution shape,
     * not final copy.
     */
    readonly executionGuidance:
    readonly string[]

    /**
     * Execution-specific boundaries.
     *
     * These supplement the Content Brief.
     */
    readonly constraints:
    readonly string[]

    /**
     * Why this channel / mode / format combination
     * is appropriate for this brief.
     */
    readonly rationale:
    string
}

export type ContentExecutionSpecModelOutput = {
    /**
     * One brief may legitimately produce separate
     * destination-specific execution specs.
     *
     * MVP supports at most Facebook + Instagram.
     * The same channel must never appear twice.
     */
    readonly executionSpecs:
    readonly ContentExecutionSpecProposal[]
}