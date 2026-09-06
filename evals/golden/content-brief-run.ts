import type {
    ContentBriefGoldenEvaluation,
} from "./contracts"

import type {
    GoldenModelRunner,
} from "./model-runner"

import type {
    ContentBriefModelOutput,
} from "./content-brief-contract"

import {
    CONTENT_BRIEF_OUTPUT_SCHEMA,
} from "./schemas"

import {
    evaluateContentBriefSemantics,
} from "./content-brief-semantic-judge"

import {
    passesContentBriefGoldenGate,
} from "./content-brief-pass-gate"

export type ContentBriefDeterministicEvaluation = {
    readonly passed: boolean
    readonly failures: readonly string[]
}

export type GoldenContentBriefRunDependencies = {
    readonly candidateRunner: GoldenModelRunner
    readonly judgeRunner: GoldenModelRunner

    readonly fixture: unknown
    readonly systemPrompt: string

    readonly deterministicValidate: (
        output: unknown,
        input: unknown,
    ) => ContentBriefDeterministicEvaluation
}

export type GoldenContentBriefRunResult = {
    readonly passed: boolean

    readonly candidateModel: string
    readonly judgeModel: string | null

    readonly deterministic:
    ContentBriefDeterministicEvaluation

    readonly semantic:
    ContentBriefGoldenEvaluation | null

    readonly output:
    ContentBriefModelOutput
}

export async function runGoldenContentBriefEvaluation({
    candidateRunner,
    judgeRunner,
    fixture,
    systemPrompt,
    deterministicValidate,
}: GoldenContentBriefRunDependencies): Promise<
    GoldenContentBriefRunResult
> {
    const candidate =
        await candidateRunner.run<
            unknown,
            ContentBriefModelOutput
        >({
            task:
                "social.content-brief.generate",

            systemPrompt,

            input:
                fixture,

            responseSchema: {
                name:
                    "content_brief",

                schema:
                    CONTENT_BRIEF_OUTPUT_SCHEMA,
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
        await evaluateContentBriefSemantics(
            judgeRunner,
            fixture,
            candidate.output,
        )

    const semantic =
        judged.output

    return {
        passed:
            passesContentBriefGoldenGate(
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