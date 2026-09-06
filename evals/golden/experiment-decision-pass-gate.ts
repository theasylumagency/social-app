import type {
    ExperimentDecisionGoldenEvaluation,
} from "./contracts"

export function passesExperimentDecisionGoldenGate(
    evaluation: ExperimentDecisionGoldenEvaluation,
): boolean {
    const hasCritical =
        evaluation.regressions.some(
            (regression) =>
                regression.severity === "critical",
        )

    const majorCount =
        evaluation.regressions.filter(
            (regression) =>
                regression.severity === "major",
        ).length

    const scores = evaluation.scores

    return (
        !hasCritical &&
        majorCount < 2 &&
        scores.decisionQuality === 2 &&
        scores.hypothesisQuality === 2 &&
        scores.experimentIsolation === 2 &&
        scores.evidenceDiscipline === 2 &&
        scores.managerialUsefulness === 2
    )
}