

import type {
    AudienceGoldenScores,
    GoldenRegression,
} from "./contracts"
import type {
    GoldenModelRunner,
    StructuredModelResult,
} from "./model-runner"


import {
    AUDIENCE_GOLDEN_EVALUATION_SCHEMA,
} from "./schemas"
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

FOUNDER DECISION VALUE

When scoring founderImpact:

Score 2 when a knowledgeable founder would recognize the business in the
analysis and gain a materially clearer or more useful way to make communication
or audience decisions.

The analysis does NOT need to be surprising, novel, clever, or non-obvious.

Do not reward novelty by itself.

A straightforward interpretation deserves 2 when it:
- is well grounded,
- materially sharpens an operational decision,
- is more useful than a generic marketing framework,
- and accurately reflects the business.

Score 1 when the analysis is accurate and credible but adds little operational
clarity beyond the supplied business context.

Score 0 when it is generic, misleading, or not useful for decisions.

Do not mention lack of novelty, surprise, originality, "aha value", or founder
surprise as a weakness unless the output is actually generic and operationally
unhelpful.


EVIDENCE CALIBRATION

A plausible inference from business structure is NOT a regression merely
because direct customer, CRM, founder-confirmed, or behavioral evidence is
absent.

Do not report an EVIDENCE regression when all of the following are true:
- the inference is plausible from the supplied context,
- uncertainty is explicitly stated,
- assumptions are separated from facts,
- confidence is appropriately capped at "reasonable" or "tentative".

Report an EVIDENCE regression only when:
- unsupported inference is presented as fact,
- confidence is too high,
- provenance is misleading,
- or the conclusion materially exceeds the available support.

Return only structured evaluation output.

Do not reward a candidate merely for inventing cross-cutting psychological,
demographic, lifestyle, or personality segments.

A cross-cutting segment is better only when it represents a defensible buying,
decision, relationship, or problem-awareness situation.

Do not penalize the candidate for omitting speculative personas.

CONFIDENCE CALIBRATION

Confidence applies to the audience hypothesis itself, not to the truth of the
underlying business facts.

A segment must NOT receive "strong" merely because:
- the related offers exist,
- the business category makes the segment plausible,
- the purchase is high-consideration,
- the segment is logically inferred from the service structure.

"Strong" requires direct or repeated evidence about the audience itself, such as:
- founder-confirmed audience knowledge,
- customer or CRM evidence,
- behavioral evidence,
- repeated content/performance evidence,
- explicit source evidence describing that audience situation.

If the audience is inferred primarily from business structure, offers, category
knowledge, or purchase characteristics, "reasonable" is normally the maximum
appropriate confidence.

Penalize overconfident audience hypotheses under EVIDENCE discipline.
`.trim()




export type AudienceGoldenEvaluation = {
    readonly scores: AudienceGoldenScores
    readonly regressions: readonly GoldenRegression[]
    readonly summary: string
}
export async function evaluateAudienceSemantics(
    runner: GoldenModelRunner,
    input: unknown,
    candidateOutput: unknown,
): Promise<
    StructuredModelResult<AudienceGoldenEvaluation>
> {
    return runner.run<
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

        responseSchema: {
            name: "audience_golden_evaluation",
            schema:
                AUDIENCE_GOLDEN_EVALUATION_SCHEMA,
        },
    })
}