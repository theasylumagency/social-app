import type { GoldenModelRunner } from "./model-runner"
import type { AudienceGoldenEvaluation } from "./contracts"
import { evaluateAudienceSemantics } from "./semantic-judge"
import { passesAudienceGoldenGate } from "./pass-gate"

export type DeterministicEvaluation = {
    readonly passed: boolean
    readonly failures: readonly string[]
}

export type GoldenAudienceRunDependencies = {
    readonly candidateRunner: GoldenModelRunner
    readonly judgeRunner: GoldenModelRunner

    readonly fixture: unknown
    readonly audienceSystemPrompt: string

    readonly deterministicValidate: (
        output: unknown,
        input: unknown,
    ) => DeterministicEvaluation
}

export type GoldenAudienceRunResult = {
    readonly passed: boolean
    readonly candidateModel: string

    readonly deterministic: DeterministicEvaluation
    readonly semantic: AudienceGoldenEvaluation | null

    readonly output: unknown
}

export async function runGoldenAudienceEvaluation({
    candidateRunner,
    judgeRunner,
    fixture,
    audienceSystemPrompt,
    deterministicValidate,
}: GoldenAudienceRunDependencies): Promise<GoldenAudienceRunResult> {
    const candidate = await candidateRunner.run({
        task: "social.audience-hypothesis.generate",
        systemPrompt: audienceSystemPrompt,
        input: fixture,
    })

    const deterministic = deterministicValidate(
        candidate.output,
        fixture,
    )

    if (!deterministic.passed) {
        return {
            passed: false,
            candidateModel: candidate.model,
            deterministic,
            semantic: null,
            output: candidate.output,
        }
    }

    const semantic = await evaluateAudienceSemantics(
        judgeRunner,
        fixture,
        candidate.output,
    )

    return {
        passed: passesAudienceGoldenGate(semantic),
        candidateModel: candidate.model,
        deterministic,
        semantic,
        output: candidate.output,
    }
}