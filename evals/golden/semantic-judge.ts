import type { GoldenModelRunner } from "./model-runner"

export type GoldenScore = 0 | 1 | 2

export type GoldenRegressionSeverity =
    | "critical"
    | "major"
    | "minor"

export type GoldenRegressionCategory =
    | "STRUCTURAL"
    | "EVIDENCE"
    | "SEGMENTATION"
    | "BUSINESS_SPECIFICITY"
    | "AUTHORITY"
    | "BRAND_PRESERVATION"
    | "CROSS_AUDIENCE_SYNTHESIS"
    | "MANAGERIAL_USEFULNESS"
    | "GENERIC_AI_OUTPUT"

export type AudienceGoldenEvaluation = {
    readonly scores: {
        readonly distinctness: GoldenScore
        readonly businessSpecificity: GoldenScore
        readonly evidenceDiscipline: GoldenScore
        readonly managerialUsefulness: GoldenScore
        readonly founderImpact: GoldenScore
    }

    readonly regressions: readonly {
        readonly category: GoldenRegressionCategory
        readonly severity: GoldenRegressionSeverity
        readonly explanation: string
    }[]

    readonly summary: string
}

const SYSTEM_PROMPT = `
You are evaluating the strategic quality of an audience analysis
produced by a professional Social Operator.

Do not reward:
- verbosity
- elegant prose
- creative persona names
- demographic specificity by itself

Evaluate whether the output demonstrates useful senior-level reasoning.

Score every dimension from 0 to 2.

DISTINCTNESS
2 = segments represent materially different buying or decision situations.
0 = generic, overlapping or demographic-only segmentation.

BUSINESS SPECIFICITY
2 = clearly shaped by the supplied business and could not be copied onto
an unrelated business.
0 = generic marketing boilerplate.

EVIDENCE DISCIPLINE
2 = known information, inference and uncertainty are clearly separated.
0 = unsupported assumptions are presented as facts.

MANAGERIAL USEFULNESS
2 = an experienced social-media manager could make materially better
planning decisions from the segmentation.
0 = little operational value.

FOUNDER IMPACT
2 = a knowledgeable founder would plausibly recognize a meaningful,
non-obvious interpretation of the business.
0 = obvious AI-generated marketing filler.

Mark CRITICAL regressions for fabricated facts, fabricated evidence,
authority violations or structurally unsafe behavior.

Return only structured evaluation output.
`.trim()

export async function evaluateAudienceSemantics(
    runner: GoldenModelRunner,
    input: unknown,
    candidateOutput: unknown,
): Promise<AudienceGoldenEvaluation> {
    const result = await runner.run<
        {
            readonly businessInput: unknown
            readonly candidateOutput: unknown
        },
        AudienceGoldenEvaluation
    >({
        task: "golden.audience.semantic-evaluation",
        systemPrompt: SYSTEM_PROMPT,
        input: {
            businessInput: input,
            candidateOutput,
        },
    })

    return result.output
}