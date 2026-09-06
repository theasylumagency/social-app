import type {
    ContentBriefGoldenEvaluation,
} from "./contracts"

export function passesContentBriefGoldenGate(
    evaluation: ContentBriefGoldenEvaluation,
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
        scores.directionFit === 2 &&
        scores.briefSpecificity === 2 &&
        scores.evidenceDiscipline === 2 &&
        scores.boundaryDiscipline === 2 &&
        scores.managerialUsefulness === 2
    )
}