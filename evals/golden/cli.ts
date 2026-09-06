import { createRequire } from "node:module"

import {
    MockGoldenRunner,
} from "../providers/mock-golden-runner"

import {
    OpenAIGoldenRunner,
} from "../providers/openai-golden-runner"

import {
    AnthropicGoldenRunner,
} from "../providers/anthropic-golden-runner"
import { AUDIENCE_HYPOTHESIS_SYSTEM_PROMPT } from "./audience-prompt"
import { runGoldenAudienceEvaluation } from "./run"

const require = createRequire(import.meta.url)

const {
    TOTAL_CHARM_DENT_GOLDEN_INPUT,
} = require(
    "../../tests/golden/total-charm-dent.fixture.cjs",
) as {
    readonly TOTAL_CHARM_DENT_GOLDEN_INPUT: unknown
}

const {
    evaluateAudienceProposal,
} = require(
    "../../tests/golden/audience-deterministic-evaluator.cjs",
) as {
    readonly evaluateAudienceProposal: (
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
    const realMode =
        process.env.GOLDEN_MODE === "real"

    const candidateRunner = realMode
        ? new OpenAIGoldenRunner({
            apiKey: requireEnv(
                "OPENAI_API_KEY",
            ),
            model:
                process.env.GOLDEN_CANDIDATE_MODEL ??
                "gpt-5.6-sol",
        })
        : new MockGoldenRunner()

    const judgeRunner = realMode
        ? new AnthropicGoldenRunner({
            apiKey: requireEnv(
                "ANTHROPIC_API_KEY",
            ),
            model:
                process.env.GOLDEN_JUDGE_MODEL ??
                "claude-opus-4-8",
        })
        : new MockGoldenRunner()

    const result = await runGoldenAudienceEvaluation({
        candidateRunner,
        judgeRunner,
        fixture: TOTAL_CHARM_DENT_GOLDEN_INPUT,
        audienceSystemPrompt:
            AUDIENCE_HYPOTHESIS_SYSTEM_PROMPT,
        deterministicValidate:
            evaluateAudienceProposal,
    })

    console.log(
        JSON.stringify(
            {
                caseId: "total-charm-dent-v1",
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