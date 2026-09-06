import type {
    ContentDirectionGoldenEvaluation,
} from "./contracts"

import type {
    GoldenModelRunner,
} from "./model-runner"

import type {
    ContentDirectionModelOutput,
} from "./content-direction-contract"

import {
    CONTENT_DIRECTION_OUTPUT_SCHEMA,
} from "./schemas"

import {
    evaluateContentDirectionSemantics,
} from "./content-direction-semantic-judge"

import {
    passesContentDirectionGoldenGate,
} from "./content-direction-pass-gate"

export type ContentDirectionDeterministicEvaluation = {
    readonly passed: boolean
    readonly failures: readonly string[]
}

export type GoldenContentDirectionRunDependencies = {
    readonly candidateRunner: GoldenModelRunner
    readonly judgeRunner: GoldenModelRunner

    readonly fixture: unknown
    readonly systemPrompt: string

    readonly deterministicValidate: (
        output: unknown,
        input: unknown,
    ) => ContentDirectionDeterministicEvaluation
}

export type GoldenContentDirectionRunResult = {
    readonly passed: boolean

    readonly candidateModel: string
    readonly judgeModel: string | null

    readonly deterministic:
    ContentDirectionDeterministicEvaluation

    readonly semantic:
    ContentDirectionGoldenEvaluation | null

    readonly output:
    ContentDirectionModelOutput
}

export async function runGoldenContentDirectionEvaluation({
    candidateRunner,
    judgeRunner,
    fixture,
    systemPrompt,
    deterministicValidate,
}: GoldenContentDirectionRunDependencies): Promise<
    GoldenContentDirectionRunResult
> {
    const candidate = await candidateRunner.run<
        unknown,
        ContentDirectionModelOutput
    >({
        task:
            "social.content-direction.generate",

        systemPrompt,

        input: fixture,

        responseSchema: {
            name:
                "content_direction",

            schema:
                CONTENT_DIRECTION_OUTPUT_SCHEMA,
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
        await evaluateContentDirectionSemantics(
            judgeRunner,
            fixture,
            candidate.output,
        )

    const semantic =
        judged.output

    return {
        passed:
            passesContentDirectionGoldenGate(
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