// -----------------------------------------------------------------------------
// Model transport only
//
// IMPORTANT:
// This is intentionally NOT the canonical SocialContentDraft domain model.
//
// The application owns:
// - draft ID
// - content ID
// - Content Brief ID
// - Content Execution Spec ID
// - format
// - locale
// - version
// - frame order
// - createdAt
//
// The model owns final copy only.
// -----------------------------------------------------------------------------

export type SocialWriterFrameProposal = {
    /**
     * Optional short visible heading.
     *
     * Null means this frame does not need
     * a separate heading.
     */
    readonly heading:
    string | null

    /**
     * Final frame body copy.
     */
    readonly body:
    string
}

export type SocialWriterDraftProposal = {
    /**
     * Used only when Execution Spec format = staticPost.
     *
     * Must be null for carousel, story, and reel.
     */
    readonly text:
    string | null

    /**
     * Optional destination caption.
     *
     * Valid for carousel and reel.
     * Must be null for staticPost and story.
     */
    readonly caption:
    string | null

    /**
     * Used only for carousel and story.
     *
     * Array order is semantic presentation order.
     * Canonical numeric order is assigned later by the app.
     *
     * Must be empty for staticPost and reel.
     */
    readonly frames:
    readonly SocialWriterFrameProposal[]

    /**
     * Used only when Execution Spec format = reel.
     *
     * Must be null for every other format.
     */
    readonly script:
    string | null

    /**
     * Optional short final text intended to appear on screen
     * in a reel.
     *
     * Must be empty for every non-reel format.
     */
    readonly onScreenText:
    readonly string[]
}

export type SocialWriterModelOutput = {
    readonly draft:
    SocialWriterDraftProposal
}