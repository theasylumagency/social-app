import type {
    CommunicationProfileGoldenEvaluation,
} from "./contracts"

import type {
    GoldenModelRunner,
} from "./model-runner"

import type {
    AudienceCommunicationProfileModelOutput,
} from "./communication-profile-contract"

import {
    AUDIENCE_COMMUNICATION_PROFILE_OUTPUT_SCHEMA,
} from "./schemas"

import {
    evaluateCommunicationProfileSemantics,
} from "./communication-profile-semantic-judge"

import {
    passesCommunicationProfileGoldenGate,
} from "./communication-profile-pass-gate"

export type CommunicationProfileDeterministicEvaluation = {
    readonly passed: boolean
    readonly failures: readonly string[]
}

export type GoldenCommunicationProfileRunDependencies = {
    readonly candidateRunner: GoldenModelRunner
    readonly judgeRunner: GoldenModelRunner

    readonly fixture: unknown
    readonly systemPrompt: string

    readonly deterministicValidate: (
        output: unknown,
        input: unknown,
    ) => CommunicationProfileDeterministicEvaluation
}

export type GoldenCommunicationProfileRunResult = {
    readonly passed: boolean

    readonly candidateModel: string
    readonly judgeModel: string | null

    readonly deterministic:
    CommunicationProfileDeterministicEvaluation

    readonly semantic:
    CommunicationProfileGoldenEvaluation | null

    readonly output:
    AudienceCommunicationProfileModelOutput
}

export async function runGoldenCommunicationProfileEvaluation({
    candidateRunner,
    judgeRunner,
    fixture,
    systemPrompt,
    deterministicValidate,
}: GoldenCommunicationProfileRunDependencies): Promise<
    GoldenCommunicationProfileRunResult
> {
    // -------------------------------------------------------------------------
    // 1. Generate communication profiles
    // -------------------------------------------------------------------------

    const candidate = await candidateRunner.run<
        unknown,
        AudienceCommunicationProfileModelOutput
    >({
        task:
            "social.audience-communication-profile.generate",

        systemPrompt,

        input: fixture,

        responseSchema: {
            name:
                "audience_communication_profiles",

            schema:
                AUDIENCE_COMMUNICATION_PROFILE_OUTPUT_SCHEMA,
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
        await evaluateCommunicationProfileSemantics(
            judgeRunner,
            fixture,
            candidate.output,
        )

    const semantic = judged.output

    // -------------------------------------------------------------------------
    // 4. Application-owned gate
    // -------------------------------------------------------------------------

    return {
        passed:
            passesCommunicationProfileGoldenGate(
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