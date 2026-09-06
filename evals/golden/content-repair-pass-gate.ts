import type {
    ContentRepairGoldenEvaluation,
} from "./contracts"

export function passesContentRepairGoldenGate(
    evaluation:
        ContentRepairGoldenEvaluation,
): boolean {
    const hasCritical =
        evaluation.regressions.some(
            (regression) =>
                regression.severity ===
                "critical",
        )

    const majorCount =
        evaluation.regressions.filter(
            (regression) =>
                regression.severity ===
                "major",
        ).length

    const scores =
        evaluation.scores

    return (
        !hasCritical &&
        majorCount < 2 &&
        scores.repairEffectiveness === 2 &&
        scores.preservationDiscipline === 2 &&
        scores.evidenceDiscipline === 2 &&
        scores.strategyFidelity === 2 &&
        scores.editorialQuality === 2
    )
}