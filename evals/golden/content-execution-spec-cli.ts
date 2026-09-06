import { createRequire } from "node:module"

import {
    OpenAIGoldenRunner,
} from "../providers/openai-golden-runner"

import {
    AnthropicGoldenRunner,
} from "../providers/anthropic-golden-runner"

import {
    CONTENT_EXECUTION_SPEC_SYSTEM_PROMPT,
} from "./content-execution-spec-prompt"

import {
    runGoldenContentExecutionSpecEvaluation,
} from "./content-execution-spec-run"

const require = createRequire(import.meta.url)

const {
    TOTAL_CHARM_DENT_CONTENT_EXECUTION_SPEC_INPUT,
} = require(
    "../../tests/golden/total-charm-dent.content-execution-spec.fixture.cjs",
) as {
    readonly TOTAL_CHARM_DENT_CONTENT_EXECUTION_SPEC_INPUT: unknown
}

const {
    evaluateContentExecutionSpecProposal,
} = require(
    "../../tests/golden/content-execution-spec-deterministic-evaluator.cjs",
) as {
    readonly evaluateContentExecutionSpecProposal: (
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
        await runGoldenContentExecutionSpecEvaluation({
            candidateRunner,
            judgeRunner,

            fixture:
                TOTAL_CHARM_DENT_CONTENT_EXECUTION_SPEC_INPUT,

            systemPrompt:
                CONTENT_EXECUTION_SPEC_SYSTEM_PROMPT,

            deterministicValidate:
                evaluateContentExecutionSpecProposal,
        })

    console.log(
        JSON.stringify(
            {
                caseId:
                    "total-charm-dent-content-execution-spec-v1",

                component:
                    "contentExecutionSpec",

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