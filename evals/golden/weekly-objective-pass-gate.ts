import type {
    WeeklyObjectiveGoldenEvaluation,
} from "./contracts"

export function passesWeeklyObjectiveGoldenGate(
    evaluation: WeeklyObjectiveGoldenEvaluation,
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
        scores.usefulProgress === 2 &&
        scores.contextAlignment === 2 &&
        scores.focusDiscipline === 2 &&
        scores.evidenceDiscipline === 2 &&
        scores.managerialUsefulness === 2
    )
}