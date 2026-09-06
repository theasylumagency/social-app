import type {
    WeeklyObjectiveGoldenEvaluation,
} from "./contracts"

import type {
    GoldenModelRunner,
} from "./model-runner"

import type {
    WeeklyObjectiveModelOutput,
} from "./weekly-objective-contract"

import {
    WEEKLY_OBJECTIVE_OUTPUT_SCHEMA,
} from "./schemas"

import {
    evaluateWeeklyObjectiveSemantics,
} from "./weekly-objective-semantic-judge"

import {
    passesWeeklyObjectiveGoldenGate,
} from "./weekly-objective-pass-gate"

export type WeeklyObjectiveDeterministicEvaluation = {
    readonly passed: boolean
    readonly failures: readonly string[]
}

export type GoldenWeeklyObjectiveRunDependencies = {
    readonly candidateRunner: GoldenModelRunner
    readonly judgeRunner: GoldenModelRunner

    readonly fixture: unknown
    readonly systemPrompt: string

    readonly deterministicValidate: (
        output: unknown,
        input: unknown,
    ) => WeeklyObjectiveDeterministicEvaluation
}

export type GoldenWeeklyObjectiveRunResult = {
    readonly passed: boolean

    readonly candidateModel: string
    readonly judgeModel: string | null

    readonly deterministic:
    WeeklyObjectiveDeterministicEvaluation

    readonly semantic:
    WeeklyObjectiveGoldenEvaluation | null

    readonly output:
    WeeklyObjectiveModelOutput
}

export async function runGoldenWeeklyObjectiveEvaluation({
    candidateRunner,
    judgeRunner,
    fixture,
    systemPrompt,
    deterministicValidate,
}: GoldenWeeklyObjectiveRunDependencies): Promise<
    GoldenWeeklyObjectiveRunResult
> {
    const candidate = await candidateRunner.run<
        unknown,
        WeeklyObjectiveModelOutput
    >({
        task:
            "social.weekly-objective.generate",

        systemPrompt,

        input: fixture,

        responseSchema: {
            name:
                "weekly_objective",

            schema:
                WEEKLY_OBJECTIVE_OUTPUT_SCHEMA,
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
        await evaluateWeeklyObjectiveSemantics(
            judgeRunner,
            fixture,
            candidate.output,
        )

    const semantic =
        judged.output

    return {
        passed:
            passesWeeklyObjectiveGoldenGate(
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