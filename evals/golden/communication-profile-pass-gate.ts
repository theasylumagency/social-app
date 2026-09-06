import type {
    CommunicationProfileGoldenEvaluation,
} from "./contracts"

export function passesCommunicationProfileGoldenGate(
    evaluation: CommunicationProfileGoldenEvaluation,
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
        scores.audienceFit === 2 &&
        scores.brandPreservation === 2 &&
        scores.differentiation === 2 &&
        scores.evidenceDiscipline === 2 &&
        scores.managerialUsefulness === 2
    )
}