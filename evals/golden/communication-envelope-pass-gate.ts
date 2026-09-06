import type {
    CommunicationEnvelopeGoldenEvaluation,
} from "./contracts"

export function passesCommunicationEnvelopeGoldenGate(
    evaluation: CommunicationEnvelopeGoldenEvaluation,
): boolean {
    const hasCritical = evaluation.regressions.some(
        (regression) =>
            regression.severity === "critical",
    )

    const majorCount = evaluation.regressions.filter(
        (regression) =>
            regression.severity === "major",
    ).length

    const scores = evaluation.scores

    return (
        !hasCritical &&
        majorCount < 2 &&
        scores.brandPreservation === 2 &&
        scores.crossAudienceFit === 2 &&
        scores.synthesisQuality === 2 &&
        scores.evidenceDiscipline === 2 &&
        scores.managerialUsefulness === 2
    )
}