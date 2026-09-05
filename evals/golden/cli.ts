import { createRequire } from "node:module"

import { MockGoldenRunner } from "../providers/mock-golden-runner"
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

async function main(): Promise<void> {
    const candidateRunner = new MockGoldenRunner()
    const judgeRunner = new MockGoldenRunner()

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