import type {
    ContentExecutionSpecGoldenEvaluation,
} from "./contracts"

export function passesContentExecutionSpecGoldenGate(
    evaluation: ContentExecutionSpecGoldenEvaluation,
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
        scores.briefFit === 2 &&
        scores.formatFit === 2 &&
        scores.channelDiscipline === 2 &&
        scores.boundaryDiscipline === 2 &&
        scores.managerialUsefulness === 2
    )
}