import { createRequire } from "node:module"

import {
    OpenAIGoldenRunner,
} from "../providers/openai-golden-runner"

import {
    AnthropicGoldenRunner,
} from "../providers/anthropic-golden-runner"

import {
    WEEKLY_OBJECTIVE_SYSTEM_PROMPT,
} from "./weekly-objective-prompt"

import {
    runGoldenWeeklyObjectiveEvaluation,
} from "./weekly-objective-run"

const require = createRequire(import.meta.url)

const {
    TOTAL_CHARM_DENT_WEEKLY_OBJECTIVE_INPUT,
} = require(
    "../../tests/golden/total-charm-dent.weekly-objective.fixture.cjs",
) as {
    readonly TOTAL_CHARM_DENT_WEEKLY_OBJECTIVE_INPUT: unknown
}

const {
    evaluateWeeklyObjectiveProposal,
} = require(
    "../../tests/golden/weekly-objective-deterministic-evaluator.cjs",
) as {
    readonly evaluateWeeklyObjectiveProposal: (
        output: unknown,
        input: unknown,
    ) => {
        readonly passed: boolean
        readonly failures: readonly string[]
    }
}

function requireEnv(name: string): string {
    const value = process.env[name]

    if (!value) {
        throw new Error(
            `Missing required environment variable: ${name}`,
        )
    }

    return value
}

async function main(): Promise<void> {
    const candidateRunner =
        new OpenAIGoldenRunner({
            apiKey:
                requireEnv("OPENAI_API_KEY"),

            model:
                process.env.GOLDEN_CANDIDATE_MODEL ??
                "gpt-5.6-sol",
        })

    const judgeRunner =
        new AnthropicGoldenRunner({
            apiKey:
                requireEnv("ANTHROPIC_API_KEY"),

            model:
                process.env.GOLDEN_JUDGE_MODEL ??
                "claude-opus-4-8",
        })

    const result =
        await runGoldenWeeklyObjectiveEvaluation({
            candidateRunner,
            judgeRunner,

            fixture:
                TOTAL_CHARM_DENT_WEEKLY_OBJECTIVE_INPUT,

            systemPrompt:
                WEEKLY_OBJECTIVE_SYSTEM_PROMPT,

            deterministicValidate:
                evaluateWeeklyObjectiveProposal,
        })

    console.log(
        JSON.stringify(
            {
                caseId:
                    "total-charm-dent-weekly-objective-v1",

                component:
                    "weeklyObjective",

                ...result,
            },
            null,
            2,
        ),
    )

    if (!result.passed) {
        process.exitCode = 1
    }
}

main().catch((error: unknown) => {
    console.error(error)
    process.exitCode = 1
})