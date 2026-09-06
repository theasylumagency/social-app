import type {
    ContentWriterGoldenEvaluation,
} from "./contracts"

export function passesContentWriterGoldenGate(
    evaluation: ContentWriterGoldenEvaluation,
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
        scores.briefFidelity === 2 &&
        scores.evidenceDiscipline === 2 &&
        scores.brandVoiceFit === 2 &&
        scores.executionQuality === 2 &&
        scores.editorialQuality === 2
    )
}