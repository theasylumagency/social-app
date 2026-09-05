import type {
    AudienceGoldenEvaluation,
} from "./semantic-judge"

export function passesAudienceGoldenGate(
    evaluation: AudienceGoldenEvaluation,
): boolean {
    const hasCritical = evaluation.regressions.some(
        (regression) => regression.severity === "critical",
    )

    const majorCount = evaluation.regressions.filter(
        (regression) => regression.severity === "major",
    ).length

    const scores = evaluation.scores

    return (
        !hasCritical &&
        majorCount < 2 &&
        scores.distinctness === 2 &&
        scores.businessSpecificity === 2 &&
        scores.evidenceDiscipline === 2 &&
        scores.managerialUsefulness === 2 &&
        scores.founderImpact >= 1
    )
}