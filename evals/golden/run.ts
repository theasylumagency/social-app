import type {
    AudienceGoldenEvaluation,
} from "./contracts"

import type {
    GoldenModelRunner,
} from "./model-runner"

import type {
    AudienceHypothesisModelOutput,
} from "./audience-contract"

import {
    AUDIENCE_HYPOTHESIS_OUTPUT_SCHEMA,
} from "./schemas"

import {
    evaluateAudienceSemantics,
} from "./semantic-judge"

import {
    passesAudienceGoldenGate,
} from "./pass-gate"

// -----------------------------------------------------------------------------
// Deterministic validation
// -----------------------------------------------------------------------------

export type DeterministicEvaluation = {
    readonly passed: boolean
    readonly failures: readonly string[]
}

// -----------------------------------------------------------------------------
// Run dependencies
// -----------------------------------------------------------------------------

export type GoldenAudienceRunDependencies = {
    readonly candidateRunner: GoldenModelRunner
    readonly judgeRunner: GoldenModelRunner

    readonly fixture: unknown
    readonly audienceSystemPrompt: string

    readonly deterministicValidate: (
        output: unknown,
        input: unknown,
    ) => DeterministicEvaluation
}

// -----------------------------------------------------------------------------
// Run result
// -----------------------------------------------------------------------------

export type GoldenAudienceRunResult = {
    readonly passed: boolean

    readonly candidateModel: string
    readonly judgeModel: string | null

    readonly deterministic: DeterministicEvaluation
    readonly semantic: AudienceGoldenEvaluation | null

    readonly output: AudienceHypothesisModelOutput
}

// -----------------------------------------------------------------------------
// Golden Audience evaluation
// -----------------------------------------------------------------------------

export async function runGoldenAudienceEvaluation({
    candidateRunner,
    judgeRunner,
    fixture,
    audienceSystemPrompt,
    deterministicValidate,
}: GoldenAudienceRunDependencies): Promise<GoldenAudienceRunResult> {
    // ---------------------------------------------------------------------------
    // 1. Generate candidate audience hypotheses
    // ---------------------------------------------------------------------------

    const candidate = await candidateRunner.run<
        unknown,
        AudienceHypothesisModelOutput
    >({
        task: "social.audience-hypothesis.generate",

        systemPrompt: audienceSystemPrompt,

        input: fixture,

        responseSchema: {
            name: "audience_hypotheses",
            schema: AUDIENCE_HYPOTHESIS_OUTPUT_SCHEMA,
        },
    })

    // ---------------------------------------------------------------------------
    // 2. Deterministic validation
    // ---------------------------------------------------------------------------

    const deterministic = deterministicValidate(
        candidate.output,
        fixture,
    )

    // Do not spend a semantic judge call on structurally invalid output.
    if (!deterministic.passed) {
        return {
            passed: false,

            candidateModel: candidate.model,
            judgeModel: null,

            deterministic,
            semantic: null,

            output: candidate.output,
        }
    }

    // ---------------------------------------------------------------------------
    // 3. Semantic evaluation
    // ---------------------------------------------------------------------------

    const judged = await evaluateAudienceSemantics(
        judgeRunner,
        fixture,
        candidate.output,
    )

    const semantic = judged.output

    // ---------------------------------------------------------------------------
    // 4. Application-owned quality gate
    // ---------------------------------------------------------------------------

    const passed =
        passesAudienceGoldenGate(semantic)

    return {
        passed,

        candidateModel: candidate.model,
        judgeModel: judged.model,

        deterministic,
        semantic,

        output: candidate.output,
    }
}