import type {
    WeeklyAudienceFocusGoldenEvaluation,
} from "./contracts"

export function passesWeeklyAudienceFocusGoldenGate(
    evaluation: WeeklyAudienceFocusGoldenEvaluation,
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
        scores.objectiveAlignment === 2 &&
        scores.focusDiscipline === 2 &&
        scores.audienceFit === 2 &&
        scores.evidenceDiscipline === 2 &&
        scores.managerialUsefulness === 2
    )
}