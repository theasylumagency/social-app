import { createRequire } from "node:module"

import {
    OpenAIGoldenRunner,
} from "../providers/openai-golden-runner"

import {
    AnthropicGoldenRunner,
} from "../providers/anthropic-golden-runner"

import {
    COMMUNICATION_ENVELOPE_SYSTEM_PROMPT,
} from "./communication-envelope-prompt"

import {
    runGoldenCommunicationEnvelopeEvaluation,
} from "./communication-envelope-run"

const require = createRequire(import.meta.url)

const {
    TOTAL_CHARM_DENT_COMMUNICATION_ENVELOPE_INPUT,
} = require(
    "../../tests/golden/total-charm-dent.communication-envelope.fixture.cjs",
) as {
    readonly TOTAL_CHARM_DENT_COMMUNICATION_ENVELOPE_INPUT: unknown
}

const {
    evaluateCommunicationEnvelopeProposal,
} = require(
    "../../tests/golden/communication-envelope-deterministic-evaluator.cjs",
) as {
    readonly evaluateCommunicationEnvelopeProposal: (
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
        await runGoldenCommunicationEnvelopeEvaluation({
            candidateRunner,
            judgeRunner,

            fixture:
                TOTAL_CHARM_DENT_COMMUNICATION_ENVELOPE_INPUT,

            systemPrompt:
                COMMUNICATION_ENVELOPE_SYSTEM_PROMPT,

            deterministicValidate:
                evaluateCommunicationEnvelopeProposal,
        })

    console.log(
        JSON.stringify(
            {
                caseId:
                    "total-charm-dent-communication-envelope-v1",

                component:
                    "communicationEnvelope",

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