import type {
    CommunicationEnvelopeGoldenEvaluation,
} from "./contracts"

import type {
    GoldenModelRunner,
} from "./model-runner"

import type {
    CommunicationEnvelopeModelOutput,
} from "./communication-envelope-contract"

import {
    COMMUNICATION_ENVELOPE_OUTPUT_SCHEMA,
} from "./schemas"

import {
    evaluateCommunicationEnvelopeSemantics,
} from "./communication-envelope-semantic-judge"

import {
    passesCommunicationEnvelopeGoldenGate,
} from "./communication-envelope-pass-gate"

export type CommunicationEnvelopeDeterministicEvaluation = {
    readonly passed: boolean
    readonly failures: readonly string[]
}

export type GoldenCommunicationEnvelopeRunDependencies = {
    readonly candidateRunner: GoldenModelRunner
    readonly judgeRunner: GoldenModelRunner

    readonly fixture: unknown
    readonly systemPrompt: string

    readonly deterministicValidate: (
        output: unknown,
        input: unknown,
    ) => CommunicationEnvelopeDeterministicEvaluation
}

export type GoldenCommunicationEnvelopeRunResult = {
    readonly passed: boolean

    readonly candidateModel: string
    readonly judgeModel: string | null

    readonly deterministic:
    CommunicationEnvelopeDeterministicEvaluation

    readonly semantic:
    CommunicationEnvelopeGoldenEvaluation | null

    readonly output:
    CommunicationEnvelopeModelOutput
}

export async function runGoldenCommunicationEnvelopeEvaluation({
    candidateRunner,
    judgeRunner,
    fixture,
    systemPrompt,
    deterministicValidate,
}: GoldenCommunicationEnvelopeRunDependencies): Promise<
    GoldenCommunicationEnvelopeRunResult
> {
    // -------------------------------------------------------------------------
    // 1. Generate shared Communication Envelope
    // -------------------------------------------------------------------------

    const candidate = await candidateRunner.run<
        unknown,
        CommunicationEnvelopeModelOutput
    >({
        task:
            "social.communication-envelope.generate",

        systemPrompt,

        input: fixture,

        responseSchema: {
            name:
                "communication_envelope",

            schema:
                COMMUNICATION_ENVELOPE_OUTPUT_SCHEMA,
        },
    })

    // -------------------------------------------------------------------------
    // 2. Deterministic validation
    // -------------------------------------------------------------------------

    const deterministic =
        deterministicValidate(
            candidate.output,
            fixture,
        )

    if (!deterministic.passed) {
        return {
            passed: false,

            candidateModel:
                candidate.model,

            judgeModel: null,

            deterministic,

            semantic: null,

            output:
                candidate.output,
        }
    }

    // -------------------------------------------------------------------------
    // 3. Semantic judge
    // -------------------------------------------------------------------------

    const judged =
        await evaluateCommunicationEnvelopeSemantics(
            judgeRunner,
            fixture,
            candidate.output,
        )

    const semantic =
        judged.output

    // -------------------------------------------------------------------------
    // 4. Application-owned pass gate
    // -------------------------------------------------------------------------

    return {
        passed:
            passesCommunicationEnvelopeGoldenGate(
                semantic,
            ),

        candidateModel:
            candidate.model,

        judgeModel:
            judged.model,

        deterministic,

        semantic,

        output:
            candidate.output,
    }
}