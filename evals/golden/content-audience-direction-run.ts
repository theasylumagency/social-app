import type {
    ContentAudienceDirectionGoldenEvaluation,
} from "./contracts"

import type {
    GoldenModelRunner,
} from "./model-runner"

import type {
    ContentAudienceDirectionModelOutput,
} from "./content-audience-direction-contract"

import {
    CONTENT_AUDIENCE_DIRECTION_OUTPUT_SCHEMA,
} from "./schemas"

import {
    evaluateContentAudienceDirectionSemantics,
} from "./content-audience-direction-semantic-judge"

import {
    passesContentAudienceDirectionGoldenGate,
} from "./content-audience-direction-pass-gate"

export type ContentAudienceDirectionDeterministicEvaluation = {
    readonly passed: boolean
    readonly failures: readonly string[]
}

export type GoldenContentAudienceDirectionRunDependencies = {
    readonly candidateRunner: GoldenModelRunner
    readonly judgeRunner: GoldenModelRunner

    readonly fixture: unknown
    readonly systemPrompt: string

    readonly deterministicValidate: (
        output: unknown,
        input: unknown,
    ) => ContentAudienceDirectionDeterministicEvaluation
}

export type GoldenContentAudienceDirectionRunResult = {
    readonly passed: boolean

    readonly candidateModel: string
    readonly judgeModel: string | null

    readonly deterministic:
    ContentAudienceDirectionDeterministicEvaluation

    readonly semantic:
    ContentAudienceDirectionGoldenEvaluation | null

    readonly output:
    ContentAudienceDirectionModelOutput
}

export async function runGoldenContentAudienceDirectionEvaluation({
    candidateRunner,
    judgeRunner,
    fixture,
    systemPrompt,
    deterministicValidate,
}: GoldenContentAudienceDirectionRunDependencies): Promise<
    GoldenContentAudienceDirectionRunResult
> {
    const candidate = await candidateRunner.run<
        unknown,
        ContentAudienceDirectionModelOutput
    >({
        task:
            "social.content-audience-direction.generate",

        systemPrompt,

        input: fixture,

        responseSchema: {
            name:
                "content_audience_direction",

            schema:
                CONTENT_AUDIENCE_DIRECTION_OUTPUT_SCHEMA,
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
        await evaluateContentAudienceDirectionSemantics(
            judgeRunner,
            fixture,
            candidate.output,
        )

    const semantic =
        judged.output

    return {
        passed:
            passesContentAudienceDirectionGoldenGate(
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