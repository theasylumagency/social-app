export type GoldenScore = 0 | 1 | 2

export type GoldenRegressionSeverity =
    | "critical"
    | "major"
    | "minor"

export type GoldenRegressionCategory =
    | "STRUCTURAL"
    | "EVIDENCE"
    | "SEGMENTATION"
    | "BUSINESS_SPECIFICITY"
    | "AUTHORITY"
    | "BRAND_PRESERVATION"
    | "CROSS_AUDIENCE_SYNTHESIS"
    | "MANAGERIAL_USEFULNESS"
    | "GENERIC_AI_OUTPUT"

export type GoldenRegression = {
    readonly category: GoldenRegressionCategory
    readonly severity: GoldenRegressionSeverity
    readonly explanation: string
}

export type AudienceGoldenScores = {
    readonly distinctness: GoldenScore
    readonly businessSpecificity: GoldenScore
    readonly evidenceDiscipline: GoldenScore
    readonly managerialUsefulness: GoldenScore
    readonly founderImpact: GoldenScore
}

export type AudienceGoldenEvaluation = {
    readonly scores: AudienceGoldenScores
    readonly regressions: readonly GoldenRegression[]
    readonly summary: string
}

export type GoldenEvaluationResult = {
    readonly caseId: string
    readonly component:
    | "audienceHypothesis"
    | "audienceLandscape"
    | "communicationProfile"
    | "communicationEnvelope"

    readonly passed: boolean
    readonly scores: AudienceGoldenScores
    readonly regressions: readonly GoldenRegression[]
    readonly summary: string
}

export type CommunicationProfileGoldenScores = {
    readonly audienceFit: GoldenScore
    readonly brandPreservation: GoldenScore
    readonly differentiation: GoldenScore
    readonly evidenceDiscipline: GoldenScore
    readonly managerialUsefulness: GoldenScore
}

export type CommunicationProfileGoldenEvaluation = {
    readonly scores: CommunicationProfileGoldenScores
    readonly regressions: readonly GoldenRegression[]
    readonly summary: string
}

export type CommunicationEnvelopeGoldenScores = {
    readonly brandPreservation: GoldenScore
    readonly crossAudienceFit: GoldenScore
    readonly synthesisQuality: GoldenScore
    readonly evidenceDiscipline: GoldenScore
    readonly managerialUsefulness: GoldenScore
}

export type CommunicationEnvelopeGoldenEvaluation = {
    readonly scores: CommunicationEnvelopeGoldenScores
    readonly regressions: readonly GoldenRegression[]
    readonly summary: string
}

export type WeeklyAudienceFocusGoldenScores = {
    readonly objectiveAlignment: GoldenScore
    readonly focusDiscipline: GoldenScore
    readonly audienceFit: GoldenScore
    readonly evidenceDiscipline: GoldenScore
    readonly managerialUsefulness: GoldenScore
}

export type WeeklyAudienceFocusGoldenEvaluation = {
    readonly scores: WeeklyAudienceFocusGoldenScores
    readonly regressions: readonly GoldenRegression[]
    readonly summary: string
}