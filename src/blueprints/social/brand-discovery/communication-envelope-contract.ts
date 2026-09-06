export type CommunicationEnvelopeProposal = {
    readonly complexity:
    | "plain"
    | "plainWithProfessionalDepth"
    | "technicalWhenExplained"
    | "expert"

    readonly assumedKnowledge:
    | "none"
    | "basic"
    | "informed"
    | "expert"

    readonly explanationDepth:
    | "light"
    | "balanced"
    | "deep"

    readonly toneRange: readonly string[]

    readonly framingRules: readonly string[]
    readonly preferredStructures: readonly string[]
    readonly terminologyRules: readonly string[]

    readonly proofStyle: readonly string[]

    readonly ctaStyle:
    | "informational"
    | "lowPressure"
    | "consultative"
    | "directWhenJustified"

    readonly salesPressure:
    | "low"
    | "moderate"
    | "high"

    readonly inclusivityRules: readonly string[]

    readonly trustMechanisms: readonly string[]
    readonly avoid: readonly string[]

    readonly rationale: string
}

export type CommunicationEnvelopeModelOutput = {
    readonly envelope: CommunicationEnvelopeProposal
}