import type {
    ContentWriterGoldenEvaluation,
} from "./contracts"

import type {
    GoldenModelRunner,
} from "./model-runner"

import type {
    SocialWriterModelOutput,
} from "./content-writer-contract"

import {
    CONTENT_WRITER_OUTPUT_SCHEMA,
} from "./schemas"

import {
    evaluateContentWriterSemantics,
} from "./content-writer-semantic-judge"

import {
    passesContentWriterGoldenGate,
} from "./content-writer-pass-gate"

export type ContentWriterDeterministicEvaluation = {
    readonly passed: boolean
    readonly failures: readonly string[]
}

export type GoldenContentWriterRunDependencies = {
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
    ) => ContentWriterDeterministicEvaluation
}

export type GoldenContentWriterRunResult = {
    readonly passed:
    boolean

    readonly candidateModel:
    string

    readonly judgeModel:
    string | null

    readonly deterministic:
    ContentWriterDeterministicEvaluation

    readonly semantic:
    ContentWriterGoldenEvaluation | null

    readonly output:
    SocialWriterModelOutput
}

export async function runGoldenContentWriterEvaluation({
    candidateRunner,
    judgeRunner,
    fixture,
    systemPrompt,
    deterministicValidate,
}: GoldenContentWriterRunDependencies): Promise<
    GoldenContentWriterRunResult
> {
    const candidate =
        await candidateRunner.run<
            unknown,
            SocialWriterModelOutput
        >({
            task:
                "social.content-writer.generate",

            systemPrompt,

            input:
                fixture,

            responseSchema: {
                name:
                    "content_writer",

                schema:
                    CONTENT_WRITER_OUTPUT_SCHEMA,
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
        await evaluateContentWriterSemantics(
            judgeRunner,
            fixture,
            candidate.output,
        )

    const semantic =
        judged.output

    return {
        passed:
            passesContentWriterGoldenGate(
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