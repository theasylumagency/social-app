export type AudienceCommunicationProfileProposal = {
    /**
     * Run-local opaque key.
     * Application code maps this back to the real AudienceRef.
     * The model never creates domain IDs.
     */
    readonly audienceKey: string

    readonly communicationGoal: string

    /**
     * Adaptations inside Brand Voice.
     * These must never replace or contradict Brand Voice.
     */
    readonly toneAdjustments: readonly string[]

    readonly preferredFraming: readonly string[]
    readonly usefulContentAngles: readonly string[]

    readonly assumedKnowledge:
    | "none"
    | "basic"
    | "informed"
    | "expert"

    readonly explanationDepth:
    | "light"
    | "balanced"
    | "deep"

    readonly trustMechanisms: readonly string[]

    readonly ctaStyle:
    | "informational"
    | "lowPressure"
    | "consultative"
    | "directWhenJustified"

    readonly avoid: readonly string[]

    readonly rationale: string
}

export type AudienceCommunicationProfileModelOutput = {
    readonly profiles:
    readonly AudienceCommunicationProfileProposal[]
}