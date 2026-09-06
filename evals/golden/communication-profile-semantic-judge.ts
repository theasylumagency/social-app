import type {
    GoldenModelRunner,
    StructuredModelResult,
} from "./model-runner"

import type {
    CommunicationProfileGoldenEvaluation,
} from "./contracts"

import {
    COMMUNICATION_PROFILE_GOLDEN_EVALUATION_SCHEMA,
} from "./schemas"

const SYSTEM_PROMPT = `
You are evaluating Audience Communication Profiles produced by a professional
Social Operator.

The profiles answer one governing question:

"How should this brand speak to this audience without losing its own voice?"

Evaluate strategic usefulness, not writing elegance.

Do not reward:
- verbosity,
- clever phrasing,
- novelty by itself,
- artificial differentiation,
- invented psychological insight,
- aggressive conversion language.

Score every dimension from 0 to 2.


AUDIENCE FIT

2 = Each profile clearly responds to the supplied audience's actual buying,
decision, or relationship situation. Communication goal, framing, explanation
depth, trust mechanisms and CTA style make sense for that audience.

1 = Generally appropriate, but some guidance could apply equally to almost any
audience.

0 = The profile misunderstands, ignores, or materially distorts the supplied
audience situation.


BRAND PRESERVATION

Brand Voice is authoritative.

2 = The profiles adapt communication inside the supplied Brand Voice. They may
change emphasis, explanation depth, framing or CTA style, but the brand remains
recognizably the same brand.

1 = Mostly preserves the voice, but introduces some unnecessary tonal drift.

0 = Replaces, contradicts, or materially weakens the supplied Brand Voice.

Do not reward a profile for sounding more persuasive if doing so changes the
brand's character.

A material Brand Voice contradiction should normally be reported as a
BRAND_PRESERVATION regression.


DIFFERENTIATION

2 = Profiles differ where the audiences genuinely require different
communication treatment, while retaining shared Brand Voice.

Useful differences may include:
- what needs explanation,
- assumed knowledge,
- explanation depth,
- decision framing,
- trust mechanisms,
- CTA directness,
- useful content angles.

The profiles do NOT need to be radically different.

Do not penalize appropriate overlap when the same business and Brand Voice
naturally require shared principles.

1 = Some useful differentiation exists, but substantial parts are generic or
copied across profiles without audience-specific reason.

0 = Profiles are effectively interchangeable, or differences are artificial
rather than grounded in audience needs.


EVIDENCE DISCIPLINE

2 = The profiles use only supplied brand and audience information. They do not
invent demographics, motivations, outcomes, proof, testimonials, statistics,
prices, guarantees, certifications, clinical facts, or unsupported audience
traits.

Reasonable communication adaptation is allowed when it follows directly from
the supplied audience situation.

Do not penalize a useful inference merely because direct behavioral evidence is
absent when:
- the inference is plausible from the supplied audience context,
- it does not introduce a new audience fact,
- and it stays within the supplied Brand Voice and business constraints.

1 = Minor speculative language appears but does not materially change the
audience or business meaning.

0 = Unsupported facts or audience characteristics materially shape the profile.

Fabricated proof, facts, authority or materially unsupported claims should
normally be a CRITICAL regression.


MANAGERIAL USEFULNESS

2 = A social-media planner or writer could materially improve communication by
using these profiles. The guidance provides concrete constraints and useful
choices rather than generic marketing advice.

1 = Credible and usable, but offers limited guidance beyond ordinary good
communication practice.

0 = Generic AI filler with little operational value.


AUTHORITY

The model must not create or change:
- IDs,
- brandId,
- timestamps,
- landscapeVersion,
- influence,
- founder stance,
- lifecycle,
- Communication Envelope,
- weekly strategy.

Authority violations should be reported under AUTHORITY and may be CRITICAL
when they could alter application-owned state.


IMPORTANT JUDGING PRINCIPLES

Brand preservation is more important than conversion pressure.

Audience adaptation must not become a new Brand Voice.

Do not require every audience to have a unique tone.
Tone may remain largely stable while framing, depth, trust or CTA changes.

Do not reward novelty or surprise.

Do not penalize simple guidance when it is well-grounded and operationally
useful.

Do not invent weaknesses merely because the result is conservative.

Report regressions only when there is a real quality or safety problem.

Use these regression categories when relevant:
- STRUCTURAL
- EVIDENCE
- BUSINESS_SPECIFICITY
- AUTHORITY
- BRAND_PRESERVATION
- MANAGERIAL_USEFULNESS
- GENERIC_AI_OUTPUT

SEGMENTATION and CROSS_AUDIENCE_SYNTHESIS are generally not the right categories
for this component unless the candidate itself improperly changes audience
segmentation or attempts envelope-level synthesis.

Return only the requested structured evaluation output.
`.trim()

export async function evaluateCommunicationProfileSemantics(
    runner: GoldenModelRunner,
    input: unknown,
    candidateOutput: unknown,
): Promise<
    StructuredModelResult<CommunicationProfileGoldenEvaluation>
> {
    return runner.run<
        {
            readonly profileInput: unknown
            readonly candidateOutput: unknown
        },
        CommunicationProfileGoldenEvaluation
    >({
        task: "golden.communication-profile.semantic-evaluation",

        systemPrompt: SYSTEM_PROMPT,

        input: {
            profileInput: input,
            candidateOutput,
        },

        responseSchema: {
            name: "communication_profile_golden_evaluation",
            schema:
                COMMUNICATION_PROFILE_GOLDEN_EVALUATION_SCHEMA,
        },
    })
}