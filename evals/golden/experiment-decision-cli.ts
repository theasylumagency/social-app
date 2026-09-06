import { createRequire } from "node:module"

import {
    OpenAIGoldenRunner,
} from "../providers/openai-golden-runner"

import {
    AnthropicGoldenRunner,
} from "../providers/anthropic-golden-runner"

import {
    EXPERIMENT_DECISION_SYSTEM_PROMPT,
} from "./experiment-decision-prompt"

import {
    runGoldenExperimentDecisionEvaluation,
} from "./experiment-decision-run"

const require = createRequire(import.meta.url)

const {
    TOTAL_CHARM_DENT_EXPERIMENT_DECISION_INPUT,
} = require(
    "../../tests/golden/total-charm-dent.experiment-decision.fixture.cjs",
) as {
    readonly TOTAL_CHARM_DENT_EXPERIMENT_DECISION_INPUT: unknown
}

const {
    evaluateExperimentDecisionProposal,
} = require(
    "../../tests/golden/experiment-decision-deterministic-evaluator.cjs",
) as {
    readonly evaluateExperimentDecisionProposal: (
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
        await runGoldenExperimentDecisionEvaluation({
            candidateRunner,
            judgeRunner,

            fixture:
                TOTAL_CHARM_DENT_EXPERIMENT_DECISION_INPUT,

            systemPrompt:
                EXPERIMENT_DECISION_SYSTEM_PROMPT,

            deterministicValidate:
                evaluateExperimentDecisionProposal,
        })

    console.log(
        JSON.stringify(
            {
                caseId:
                    "total-charm-dent-experiment-decision-v1",

                component:
                    "experimentDecision",

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
