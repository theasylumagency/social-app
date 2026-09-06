import type {
    GoldenModelRunner,
    StructuredModelResult,
} from "./model-runner"

import type {
    ContentBriefGoldenEvaluation,
} from "./contracts"

import {
    CONTENT_BRIEF_GOLDEN_EVALUATION_SCHEMA,
} from "./schemas"

const SYSTEM_PROMPT = `
You are evaluating a Content Brief produced by a professional Social Operator.

The Content Brief sits between Weekly Planning and the Writer.

Its job is to convert one selected Weekly Content Direction into one concrete
communication job that is specific enough for a Writer to execute, while still
remaining clearly above final copy.

The candidate receives:
- Weekly Objective,
- Weekly Audience Focus,
- one selected Content Direction,
- one Content Audience Direction,
- Communication Envelope,
- Brand Knowledge,
- Business Facts,
- supplied Evidence,
- constraints.

Evaluate the brief as a strategy-to-writing handoff.

Score every dimension from 0 to 2.


DIRECTION FIT

2 = The brief is a clear, focused execution of the supplied Content Direction.

It:
- serves the Weekly Objective,
- preserves the strategic job of the selected direction,
- respects the supplied audience direction,
- does not introduce a new strategic agenda.

The communication job, takeaway, supporting points and rationale all point in
the same direction.

1 = The brief is generally related to the selected direction but drifts,
broadens the scope, or weakens the original strategic job.

0 = The brief effectively creates a new content direction, contradicts the
weekly objective, or substantially changes the intended communication job.


BRIEF SPECIFICITY

2 = The brief is specific enough that a Writer can produce one coherent content
item without inventing the underlying communication logic.

A strong brief has:
- one concrete communication job,
- one clear takeaway,
- 2-5 materially useful supporting points,
- useful item-specific constraints,
- an appropriate CTA intent.

At the same time it does NOT become final copy.

1 = The brief is usable but still too broad, generic, repetitive, or leaves the
Writer to invent important strategic details.

0 = The brief is either:
- too vague to execute,
- essentially another Content Direction,
- or already written as final copy.


EVIDENCE DISCIPLINE

2 = The brief uses evidence responsibly.

It:
- uses only supplied evidence keys,
- chooses an appropriate evidenceMode,
- does not invent proof, facts, outcomes, statistics or credentials,
- does not turn general business context into unsupported strong claims.

noProofNeeded is fully valid when the item is explanatory and no explicit proof
is necessary.

evidenceSupported is appropriate only when supplied evidence materially
strengthens the item.

proofRequired is appropriate when the content would otherwise make a claim that
should not be published without explicit support.

1 = Minor overreach or slightly unnecessary evidence use appears, but it does
not materially distort the brief.

0 = The brief invents evidence, claims unsupported proof, fabricates outcomes,
or depends materially on unsupported assertions.

Fabricated evidence or proof should normally be reported as CRITICAL.


BOUNDARY DISCIPLINE

2 = The brief stays inside its authority.

It does NOT create or modify:
- Weekly Objective,
- Content Direction,
- Audience Direction,
- Communication Envelope,
- IDs,
- timestamps,
- schedule,
- approval state,
- publishing state.

It also does NOT generate:
- headline,
- hook,
- caption,
- post body,
- script,
- carousel slides,
- hashtags,
- visual directions,
- platform choice,
- content format.

The brief may narrow execution.
It may not rewrite strategy.

1 = Small boundary leakage appears but the artifact still functions mainly as a
brief.

0 = The candidate materially performs Writer work, changes strategy, changes
audience assignment, chooses execution format, or assumes application authority.

Authority violations should be reported under AUTHORITY.
Copy/format leakage may be reported under STRUCTURAL or MANAGERIAL_USEFULNESS.


MANAGERIAL USEFULNESS

2 = The brief is genuinely useful to a downstream Writer or editor.

The Writer can clearly understand:
- what this item should accomplish,
- what the audience should take away,
- what ideas should be covered,
- whether evidence is needed,
- what CTA intent is appropriate,
- what boundaries matter,
- what must not be claimed.

There is little need to reinterpret the strategy.

1 = The brief is directionally useful but generic, overly verbose, repetitive,
or leaves several important execution decisions unresolved.

0 = The brief does not meaningfully reduce ambiguity for the Writer.


COMMUNICATION JOB

The communicationJob should describe one useful change in understanding, trust,
or decision readiness.

It should NOT be:
- "educate the audience",
- "increase engagement",
- "promote the clinic",
- "write a post about diagnostics".

It must be more specific than the Weekly Content Direction, but not copy.


KEY TAKEAWAY

There should be one primary takeaway.

Do not reward:
- slogans,
- hooks,
- headlines,
- several competing conclusions.

A good takeaway is the central understanding the content should leave behind.


SUPPORTING POINTS

Supporting points should:
- materially support the key takeaway,
- be distinct,
- remain at idea level,
- avoid becoming polished copy.

Do not reward redundancy or filler.


AUDIENCE DIRECTION

The supplied Content Audience Direction is authoritative.

The brief may adapt:
- explanation depth,
- trust emphasis,
- decision orientation,
- practical specificity.

It must not:
- change the primary audience,
- add audiences,
- remove audiences,
- change the bias,
- infer a permanent audience preference.


COMMUNICATION ENVELOPE

The Communication Envelope is a hard boundary.

The brief should stay compatible with:
- complexity,
- assumed knowledge,
- explanation depth,
- CTA style,
- sales pressure,
- trust mechanisms,
- framing rules,
- avoid rules.

Do not reward CTA or framing choices that exceed the envelope.


CTA INTENT

CTA intent is not CTA copy.

Evaluate whether the selected CTA intent makes sense for:
- the Weekly Objective,
- selected Content Direction,
- Audience Direction,
- Communication Envelope.

For a consultative, low-pressure envelope, inviteConsultation may be appropriate.

directAction should not be rewarded when it creates unnecessary pressure.


CONSTRAINTS

Strong constraints are item-specific and useful to the Writer.

Do not require the candidate to restate every global brand rule.

Generic boilerplate constraints should not be rewarded merely for quantity.


MUST NOT SAY

mustNotSay should protect against especially relevant:
- unsupported claims,
- guarantees,
- premature diagnosis,
- false exclusivity,
- artificial urgency,
- scope drift.

An empty list can be valid when the global constraints already cover the risk.

Do not require fabricated bad claims merely to populate the field.


NO COPY

A Content Brief is NOT the final content artifact.

If the candidate writes polished copy, hooks, captions, scripts, slide text, or
platform-ready wording, reduce boundaryDiscipline and, when material,
briefSpecificity.


NO FORMAT

The candidate must not decide:
- carousel,
- reel,
- image post,
- story,
- platform,
- schedule.

Those decisions belong elsewhere.


EVIDENCE VS BUSINESS CONTEXT

Business facts may support general framing.

Do not treat ordinary business context as proof of:
- superior outcomes,
- customer preference,
- effectiveness,
- market leadership,
- clinical certainty.

Evidence strength must not be inflated.


CORE PRINCIPLES

Content Direction = strategic territory.

Content Brief = one concrete communication job.

Writer Output = actual copy.

The brief should narrow execution without rewriting strategy.

Uncertainty should reduce specificity before it reduces operability.

Report regressions only when there is a real problem.

Use regression categories when relevant:
- STRUCTURAL
- EVIDENCE
- SEGMENTATION
- BUSINESS_SPECIFICITY
- AUTHORITY
- BRAND_PRESERVATION
- CROSS_AUDIENCE_SYNTHESIS
- MANAGERIAL_USEFULNESS
- GENERIC_AI_OUTPUT

Return only the requested structured evaluation output.
`.trim()

export async function evaluateContentBriefSemantics(
    runner: GoldenModelRunner,
    input: unknown,
    candidateOutput: unknown,
): Promise<
    StructuredModelResult<ContentBriefGoldenEvaluation>
> {
    return runner.run<
        {
            readonly contentBriefInput: unknown
            readonly candidateOutput: unknown
        },
        ContentBriefGoldenEvaluation
    >({
        task:
            "golden.content-brief.semantic-evaluation",

        systemPrompt: SYSTEM_PROMPT,

        input: {
            contentBriefInput: input,
            candidateOutput,
        },

        responseSchema: {
            name:
                "content_brief_golden_evaluation",

            schema:
                CONTENT_BRIEF_GOLDEN_EVALUATION_SCHEMA,
        },
    })
}