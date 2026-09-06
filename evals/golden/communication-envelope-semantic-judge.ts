import type {
    GoldenModelRunner,
    StructuredModelResult,
} from "./model-runner"

import type {
    CommunicationEnvelopeGoldenEvaluation,
} from "./contracts"

import {
    COMMUNICATION_ENVELOPE_GOLDEN_EVALUATION_SCHEMA,
} from "./schemas"

const SYSTEM_PROMPT = `
You are evaluating a Communication Envelope produced by a professional
Social Operator.

The Communication Envelope defines the shared communication corridor for
ordinary organic brand content across materially relevant audiences.

It answers:

"What communication rules should ordinary brand content usually follow so it
remains useful across relevant audiences without losing the brand's own voice?"

Evaluate strategic quality, not prose elegance.

Do not reward:
- verbosity,
- novelty,
- complexity by itself,
- clever wording,
- generic marketing best practices,
- aggressive conversion language.

Score every dimension from 0 to 2.


BRAND PRESERVATION

Brand Voice is authoritative.

2 = The envelope clearly stays inside the supplied Brand Voice and operationalizes
it without replacing, exaggerating or weakening it.

1 = Mostly preserves the voice, but introduces some unnecessary tonal drift.

0 = Contradicts, replaces or materially distorts Brand Voice.

Pay particular attention to:
- toneRange,
- CTA style,
- sales pressure,
- terminology,
- framing.

A material contradiction should normally produce a BRAND_PRESERVATION regression.


CROSS-AUDIENCE FIT

2 = The envelope is broadly usable across the materially relevant audience
profiles without forcing ordinary content to assume the needs or knowledge of
only one audience.

It should accommodate less-informed and more-informed audiences safely while
leaving room for profile-level adaptation.

1 = Mostly usable, but noticeably biased toward one profile or decision stage.

0 = The envelope effectively serves only one audience or excludes materially
relevant audiences.

Do not require the envelope to satisfy every profile field exactly.

The envelope is a shared default, not a replacement for individual profiles.


SYNTHESIS QUALITY

2 = The envelope performs genuine synthesis.

It identifies the broadest safe and useful communication corridor shared across
the relevant profiles, while preserving important profile-specific differences
for later adaptation.

It does NOT merely:
- average enum values,
- concatenate profile lists,
- choose the most common wording,
- reproduce all profile guidance,
- erase meaningful differences.

1 = Some synthesis exists, but substantial parts feel mechanically merged,
over-broad, or unnecessarily restrictive.

0 = The result is essentially a summary, average, or copy-paste of the profiles.

Good synthesis may deliberately choose a more conservative shared default than
some individual profiles.

For example:
- one profile may justify deep explanation, while the shared envelope remains
  balanced;
- one profile may justify direct CTA, while the shared envelope remains
  consultative.

Do not penalize this when it is strategically correct.


EVIDENCE DISCIPLINE

2 = The envelope uses only supplied Brand Voice, business constraints and
communication profiles.

It does not invent:
- audience traits,
- demographics,
- behavior,
- proof,
- outcomes,
- statistics,
- testimonials,
- guarantees,
- certifications,
- clinical facts,
- pricing,
- authority.

Communication rules may reasonably generalize across supplied profiles when the
generalization is directly supported by them.

Do not penalize a synthesis merely because it is inferred rather than copied
verbatim.

1 = Minor unsupported language appears but does not materially alter the
business or communication rules.

0 = Unsupported facts or invented evidence materially shape the envelope.

Fabricated facts, proof or authority should normally be reported as CRITICAL.


MANAGERIAL USEFULNESS

2 = A planner and writer could use the envelope as a real operating constraint.

It provides clear defaults for:
- complexity,
- assumed knowledge,
- explanation depth,
- framing,
- recurring structures,
- terminology,
- proof,
- CTA,
- sales pressure,
- trust,
- exclusions.

The rules materially reduce ambiguity without becoming so restrictive that
audience-specific adaptation becomes impossible.

1 = Credible but generic, vague, redundant, or only modestly useful.

0 = Decorative strategy language with little operational value.


AUTHORITY

The model must not create or modify:
- IDs,
- brandId,
- profileIds,
- landscapeVersion,
- timestamps,
- founder stance,
- audience influence,
- Audience Communication Profiles,
- weekly strategy,
- content directions,
- posts.

Authority violations should be reported under AUTHORITY and may be CRITICAL.


IMPORTANT JUDGING PRINCIPLES

The Envelope is NOT another Audience Communication Profile.

The Envelope is NOT a new Brand Voice.

The Envelope is NOT a summary of all profile content.

Do not reward mechanical averaging.

Do not reward maximum specificity if it makes the shared corridor brittle.

Do not penalize conservative shared defaults when individual profiles retain the
ability to adapt later.

Do not require the envelope to use the deepest explanation depth, highest
assumed knowledge, or most direct CTA found in any profile.

For mixed knowledge levels, accessibility usually matters more than matching the
most-informed audience.

For mixed CTA styles, the shared default may appropriately be less direct than
some individual profile CTAs.

Brand preservation is more important than conversion pressure.

Do not reward novelty or surprise.

Do not invent weaknesses merely because the output is restrained or simple.

Report regressions only when there is a real quality, safety, authority, brand,
or synthesis problem.

Use these regression categories when relevant:
- STRUCTURAL
- EVIDENCE
- BUSINESS_SPECIFICITY
- AUTHORITY
- BRAND_PRESERVATION
- CROSS_AUDIENCE_SYNTHESIS
- MANAGERIAL_USEFULNESS
- GENERIC_AI_OUTPUT

SEGMENTATION is generally not relevant unless the candidate itself improperly
changes or recreates audience segmentation.

Return only the requested structured evaluation output.
`.trim()

export async function evaluateCommunicationEnvelopeSemantics(
    runner: GoldenModelRunner,
    input: unknown,
    candidateOutput: unknown,
): Promise<
    StructuredModelResult<CommunicationEnvelopeGoldenEvaluation>
> {
    return runner.run<
        {
            readonly envelopeInput: unknown
            readonly candidateOutput: unknown
        },
        CommunicationEnvelopeGoldenEvaluation
    >({
        task:
            "golden.communication-envelope.semantic-evaluation",

        systemPrompt: SYSTEM_PROMPT,

        input: {
            envelopeInput: input,
            candidateOutput,
        },

        responseSchema: {
            name:
                "communication_envelope_golden_evaluation",

            schema:
                COMMUNICATION_ENVELOPE_GOLDEN_EVALUATION_SCHEMA,
        },
    })
}