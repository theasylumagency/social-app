import { createRequire } from "node:module"

import {
    OpenAIGoldenRunner,
} from "../providers/openai-golden-runner"

import {
    AnthropicGoldenRunner,
} from "../providers/anthropic-golden-runner"

import {
    CONTENT_REPAIR_SYSTEM_PROMPT,
} from "./content-repair-prompt"

import {
    runGoldenContentRepairEvaluation,
} from "./content-repair-run"

const require =
    createRequire(
        import.meta.url,
    )

const {
    TOTAL_CHARM_DENT_CONTENT_REPAIR_INPUT,
} = require(
    "../../tests/golden/total-charm-dent.content-repair.fixture.cjs",
) as {
    readonly TOTAL_CHARM_DENT_CONTENT_REPAIR_INPUT:
    unknown
}

const {
    evaluateContentRepairProposal,
} = require(
    "../../tests/golden/content-repair-deterministic-evaluator.cjs",
) as {
    readonly evaluateContentRepairProposal: (
        output:
            unknown,

        input:
            unknown,
    ) => {
        readonly passed:
        boolean

        readonly failures:
        readonly string[]
    }
}

function requireEnv(
    name:
        string,
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
        await runGoldenContentRepairEvaluation({
            candidateRunner,
            judgeRunner,

            fixture:
                TOTAL_CHARM_DENT_CONTENT_REPAIR_INPUT,

            systemPrompt:
                CONTENT_REPAIR_SYSTEM_PROMPT,

            deterministicValidate:
                evaluateContentRepairProposal,
        })

    console.log(
        JSON.stringify(
            {
                caseId:
                    "total-charm-dent-content-repair-v1",

                component:
                    "contentRepair",

                ...result,
            },
            null,
            2,
        ),
    )

    if (!result.passed) {
        process.exitCode =
            1
    }
}

main().catch(
    (
        error:
            unknown,
    ) => {
        console.error(
            error,
        )

        process.exitCode =
            1
    },
)