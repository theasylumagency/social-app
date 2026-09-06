import type {
    ContentExecutionSpecGoldenEvaluation,
} from "./contracts"

import type {
    GoldenModelRunner,
} from "./model-runner"

import type {
    ContentExecutionSpecModelOutput,
} from "./content-execution-spec-contract"

import {
    CONTENT_EXECUTION_SPEC_OUTPUT_SCHEMA,
} from "./schemas"

import {
    evaluateContentExecutionSpecSemantics,
} from "./content-execution-spec-semantic-judge"

import {
    passesContentExecutionSpecGoldenGate,
} from "./content-execution-spec-pass-gate"

export type ContentExecutionSpecDeterministicEvaluation = {
    readonly passed: boolean
    readonly failures: readonly string[]
}

export type GoldenContentExecutionSpecRunDependencies = {
    readonly candidateRunner:
    GoldenModelRunner

    readonly judgeRunner:
    GoldenModelRunner

    readonly fixture:
    unknown

    readonly systemPrompt:
    string

    readonly deterministicValidate: (
        output: unknown,
        input: unknown,
    ) => ContentExecutionSpecDeterministicEvaluation
}

export type GoldenContentExecutionSpecRunResult = {
    readonly passed:
    boolean

    readonly candidateModel:
    string

    readonly judgeModel:
    string | null

    readonly deterministic:
    ContentExecutionSpecDeterministicEvaluation

    readonly semantic:
    ContentExecutionSpecGoldenEvaluation | null

    readonly output:
    ContentExecutionSpecModelOutput
}

export async function runGoldenContentExecutionSpecEvaluation({
    candidateRunner,
    judgeRunner,
    fixture,
    systemPrompt,
    deterministicValidate,
}: GoldenContentExecutionSpecRunDependencies): Promise<
    GoldenContentExecutionSpecRunResult
> {
    const candidate =
        await candidateRunner.run<
            unknown,
            ContentExecutionSpecModelOutput
        >({
            task:
                "social.content-execution-spec.generate",

            systemPrompt,

            input:
                fixture,

            responseSchema: {
                name:
                    "content_execution_spec",

                schema:
                    CONTENT_EXECUTION_SPEC_OUTPUT_SCHEMA,
            },
        })

    const deterministic =
        deterministicValidate(
            candidate.output,
            fixture,
        )

    if (!deterministic.passed) {
        return {
            passed:
                false,

            candidateModel:
                candidate.model,

            judgeModel:
                null,

            deterministic,

            semantic:
                null,

            output:
                candidate.output,
        }
    }

    const judged =
        await evaluateContentExecutionSpecSemantics(
            judgeRunner,
            fixture,
            candidate.output,
        )

    const semantic =
        judged.output

    return {
        passed:
            passesContentExecutionSpecGoldenGate(
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