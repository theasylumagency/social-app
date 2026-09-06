import { createRequire } from "node:module"

import {
    OpenAIGoldenRunner,
} from "../providers/openai-golden-runner"

import {
    AnthropicGoldenRunner,
} from "../providers/anthropic-golden-runner"

import {
    CONTENT_WRITER_SYSTEM_PROMPT,
} from "./content-writer-prompt"

import {
    runGoldenContentWriterEvaluation,
} from "./content-writer-run"

const require =
    createRequire(import.meta.url)

const {
    TOTAL_CHARM_DENT_CONTENT_WRITER_INPUT,
} = require(
    "../../tests/golden/total-charm-dent.content-writer.fixture.cjs",
) as {
    readonly TOTAL_CHARM_DENT_CONTENT_WRITER_INPUT:
    unknown
}

const {
    evaluateContentWriterProposal,
} = require(
    "../../tests/golden/content-writer-deterministic-evaluator.cjs",
) as {
    readonly evaluateContentWriterProposal: (
        output: unknown,
        input: unknown,
    ) => {
        readonly passed:
        boolean

        readonly failures:
        readonly string[]
    }
}

function requireEnv(
    name: string,
): string {
    const value =
        process.env[name]

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
                requireEnv(
                    "OPENAI_API_KEY",
                ),

            model:
                process.env
                    .GOLDEN_CANDIDATE_MODEL ??
                "gpt-5.6-sol",
        })

    const judgeRunner =
        new AnthropicGoldenRunner({
            apiKey:
                requireEnv(
                    "ANTHROPIC_API_KEY",
                ),

            model:
                process.env
                    .GOLDEN_JUDGE_MODEL ??
                "claude-opus-4-8",
        })

    const result =
        await runGoldenContentWriterEvaluation({
            candidateRunner,
            judgeRunner,

            fixture:
                TOTAL_CHARM_DENT_CONTENT_WRITER_INPUT,

            systemPrompt:
                CONTENT_WRITER_SYSTEM_PROMPT,

            deterministicValidate:
                evaluateContentWriterProposal,
        })

    console.log(
        JSON.stringify(
            {
                caseId:
                    "total-charm-dent-content-writer-v1",

                component:
                    "contentWriter",

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

main().catch(
    (error: unknown) => {
        console.error(error)
        process.exitCode = 1
    },
)