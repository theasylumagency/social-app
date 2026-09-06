import type {
    ContentDirectionGoldenEvaluation,
} from "./contracts"

export function passesContentDirectionGoldenGate(
    evaluation: ContentDirectionGoldenEvaluation,
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
        scores.objectiveAlignment === 2 &&
        scores.strategicDistinctness === 2 &&
        scores.directionAbstraction === 2 &&
        scores.evidenceDiscipline === 2 &&
        scores.managerialUsefulness === 2
    )
}