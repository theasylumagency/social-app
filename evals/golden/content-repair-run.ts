import type {
    ContentRepairGoldenEvaluation,
} from "./contracts"

import type {
    GoldenModelRunner,
} from "./model-runner"

import type {
    SocialContentRepairModelOutput,
} from "./content-repair-contract"

import {
    CONTENT_WRITER_OUTPUT_SCHEMA,
} from "./schemas"

import {
    evaluateContentRepairSemantics,
} from "./content-repair-semantic-judge"

import {
    passesContentRepairGoldenGate,
} from "./content-repair-pass-gate"

export type ContentRepairDeterministicEvaluation = {
    readonly passed:
    boolean

    readonly failures:
    readonly string[]
}

export type GoldenContentRepairRunDependencies = {
    readonly candidateRunner:
    GoldenModelRunner

    readonly judgeRunner:
    GoldenModelRunner

    readonly fixture:
    unknown

    readonly systemPrompt:
    string

    readonly deterministicValidate: (
        output:
            unknown,

        input:
            unknown,
    ) => ContentRepairDeterministicEvaluation
}

export type GoldenContentRepairRunResult = {
    readonly passed:
    boolean

    readonly candidateModel:
    string

    readonly judgeModel:
    string | null

    readonly deterministic:
    ContentRepairDeterministicEvaluation

    readonly semantic:
    ContentRepairGoldenEvaluation | null

    readonly output:
    SocialContentRepairModelOutput
}

export async function runGoldenContentRepairEvaluation({
    candidateRunner,
    judgeRunner,
    fixture,
    systemPrompt,
    deterministicValidate,
}: GoldenContentRepairRunDependencies): Promise<
    GoldenContentRepairRunResult
> {
    const candidate =
        await candidateRunner.run<
            unknown,
            SocialContentRepairModelOutput
        >({
            task:
                "social.content-repair.generate",

            systemPrompt,

            input:
                fixture,

            /**
             * Repair uses exactly the same copy transport
             * as the original Writer.
             */
            responseSchema: {
                name:
                    "content_repair",

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
        await evaluateContentRepairSemantics(
            judgeRunner,
            fixture,
            candidate.output,
        )

    const semantic =
        judged.output

    return {
        passed:
            passesContentRepairGoldenGate(
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