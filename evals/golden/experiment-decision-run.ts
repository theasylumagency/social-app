import type {
    ExperimentDecisionGoldenEvaluation,
} from "./contracts"

import type {
    GoldenModelRunner,
} from "./model-runner"

import type {
    ExperimentDecisionModelOutput,
} from "./experiment-decision-contract"

import {
    EXPERIMENT_DECISION_OUTPUT_SCHEMA,
} from "./schemas"

import {
    evaluateExperimentDecisionSemantics,
} from "./experiment-decision-semantic-judge"

import {
    passesExperimentDecisionGoldenGate,
} from "./experiment-decision-pass-gate"

export type ExperimentDecisionDeterministicEvaluation = {
    readonly passed: boolean
    readonly failures: readonly string[]
}

export type GoldenExperimentDecisionRunDependencies = {
    readonly candidateRunner: GoldenModelRunner
    readonly judgeRunner: GoldenModelRunner

    readonly fixture: unknown
    readonly systemPrompt: string

    readonly deterministicValidate: (
        output: unknown,
        input: unknown,
    ) => ExperimentDecisionDeterministicEvaluation
}

export type GoldenExperimentDecisionRunResult = {
    readonly passed: boolean

    readonly candidateModel: string
    readonly judgeModel: string | null

    readonly deterministic:
    ExperimentDecisionDeterministicEvaluation

    readonly semantic:
    ExperimentDecisionGoldenEvaluation | null

    readonly output:
    ExperimentDecisionModelOutput
}

export async function runGoldenExperimentDecisionEvaluation({
    candidateRunner,
    judgeRunner,
    fixture,
    systemPrompt,
    deterministicValidate,
}: GoldenExperimentDecisionRunDependencies): Promise<
    GoldenExperimentDecisionRunResult
> {
    const candidate = await candidateRunner.run<
        unknown,
        ExperimentDecisionModelOutput
    >({
        task:
            "social.experiment-decision.generate",

        systemPrompt,

        input: fixture,

        responseSchema: {
            name:
                "experiment_decision",

            schema:
                EXPERIMENT_DECISION_OUTPUT_SCHEMA,
        },
    })

    const deterministic =
        deterministicValidate(
            candidate.output,
            fixture,
        )

    if (!deterministic.passed) {
        return {
            passed: false,

            candidateModel:
                candidate.model,

            judgeModel: null,

            deterministic,

            semantic: null,

            output:
                candidate.output,
        }
    }

    const judged =
        await evaluateExperimentDecisionSemantics(
            judgeRunner,
            fixture,
            candidate.output,
        )

    const semantic =
        judged.output

    return {
        passed:
            passesExperimentDecisionGoldenGate(
                semantic,
            ),

        candidateModel:
            candidate.model,

        judgeModel:
            judged.model,

        deterministic,

        semantic,

        output:
            candidate.output,
    }
}