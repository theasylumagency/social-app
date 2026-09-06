import { createRequire } from "node:module"

import {
    OpenAIGoldenRunner,
} from "../providers/openai-golden-runner"

import {
    AnthropicGoldenRunner,
} from "../providers/anthropic-golden-runner"

import {
    CONTENT_DIRECTION_SYSTEM_PROMPT,
} from "./content-direction-prompt"

import {
    runGoldenContentDirectionEvaluation,
} from "./content-direction-run"

const require = createRequire(import.meta.url)

const {
    TOTAL_CHARM_DENT_CONTENT_DIRECTION_INPUT,
} = require(
    "../../tests/golden/total-charm-dent.content-direction.fixture.cjs",
) as {
    readonly TOTAL_CHARM_DENT_CONTENT_DIRECTION_INPUT: unknown
}

const {
    evaluateContentDirectionProposal,
} = require(
    "../../tests/golden/content-direction-deterministic-evaluator.cjs",
) as {
    readonly evaluateContentDirectionProposal: (
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
        await runGoldenContentDirectionEvaluation({
            candidateRunner,
            judgeRunner,

            fixture:
                TOTAL_CHARM_DENT_CONTENT_DIRECTION_INPUT,

            systemPrompt:
                CONTENT_DIRECTION_SYSTEM_PROMPT,

            deterministicValidate:
                evaluateContentDirectionProposal,
        })

    console.log(
        JSON.stringify(
            {
                caseId:
                    "total-charm-dent-content-direction-v1",

                component:
                    "contentDirection",

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