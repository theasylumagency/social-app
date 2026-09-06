import type {
    WeeklyAudienceFocusGoldenEvaluation,
} from "./contracts"

import type {
    GoldenModelRunner,
} from "./model-runner"

import type {
    WeeklyAudienceFocusModelOutput,
} from "./weekly-audience-focus-contract"

import {
    WEEKLY_AUDIENCE_FOCUS_OUTPUT_SCHEMA,
} from "./schemas"

import {
    evaluateWeeklyAudienceFocusSemantics,
} from "./weekly-audience-focus-semantic-judge"

import {
    passesWeeklyAudienceFocusGoldenGate,
} from "./weekly-audience-focus-pass-gate"

export type WeeklyAudienceFocusDeterministicEvaluation = {
    readonly passed: boolean
    readonly failures: readonly string[]
}

export type GoldenWeeklyAudienceFocusRunDependencies = {
    readonly candidateRunner: GoldenModelRunner
    readonly judgeRunner: GoldenModelRunner

    readonly fixture: unknown
    readonly systemPrompt: string

    readonly deterministicValidate: (
        output: unknown,
        input: unknown,
    ) => WeeklyAudienceFocusDeterministicEvaluation
}

export type GoldenWeeklyAudienceFocusRunResult = {
    readonly passed: boolean

    readonly candidateModel: string
    readonly judgeModel: string | null

    readonly deterministic:
    WeeklyAudienceFocusDeterministicEvaluation

    readonly semantic:
    WeeklyAudienceFocusGoldenEvaluation | null

    readonly output:
    WeeklyAudienceFocusModelOutput
}

export async function runGoldenWeeklyAudienceFocusEvaluation({
    candidateRunner,
    judgeRunner,
    fixture,
    systemPrompt,
    deterministicValidate,
}: GoldenWeeklyAudienceFocusRunDependencies): Promise<
    GoldenWeeklyAudienceFocusRunResult
> {
    const candidate = await candidateRunner.run<
        unknown,
        WeeklyAudienceFocusModelOutput
    >({
        task:
            "social.weekly-audience-focus.generate",

        systemPrompt,

        input: fixture,

        responseSchema: {
            name:
                "weekly_audience_focus",

            schema:
                WEEKLY_AUDIENCE_FOCUS_OUTPUT_SCHEMA,
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
        await evaluateWeeklyAudienceFocusSemantics(
            judgeRunner,
            fixture,
            candidate.output,
        )

    const semantic =
        judged.output

    return {
        passed:
            passesWeeklyAudienceFocusGoldenGate(
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