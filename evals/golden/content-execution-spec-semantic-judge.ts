import type {
    GoldenModelRunner,
    StructuredModelResult,
} from "./model-runner"

import type {
    ContentExecutionSpecGoldenEvaluation,
} from "./contracts"

import {
    CONTENT_EXECUTION_SPEC_GOLDEN_EVALUATION_SCHEMA,
} from "./schemas"

const SYSTEM_PROMPT = `
You are evaluating Content Execution Specs produced by a professional
Social Operator.

These specs sit between an approved Content Brief and the Writer.

Their job is to decide how the brief should be executed for one or more
eligible social destinations without changing the brief itself.

The candidate receives:
- Weekly Objective,
- Communication Envelope,
- Content Audience Direction,
- approved Content Brief,
- eligible channels,
- eligible content modes,
- channel policies,
- capability state,
- constraints.

Evaluate execution quality, not novelty.

Score every dimension from 0 to 2.


BRIEF FIT

2 = Every execution spec clearly serves the supplied Content Brief.

The selected:
- content mode,
- format,
- depth,
- visual dependency,
- execution guidance

all preserve:
- the communication job,
- key takeaway,
- supporting logic,
- CTA intent,
- evidence mode,
- constraints.

The format serves the brief.

1 = The spec is broadly compatible with the brief but slightly reframes,
narrows, broadens, or distorts part of the original communication job.

0 = The execution choice materially changes the brief, introduces a new
strategic objective, changes CTA intent, changes evidence logic, or reshapes
the content merely to justify a preferred format.


FORMAT FIT

2 = Format, depth, and visual dependency are well matched to the actual
communication job.

The choice is based on communication structure rather than trendiness or
platform stereotype.

Examples of good reasoning:
- carousel for genuinely sequential explanation,
- reel where temporal explanation or demonstration materially helps,
- staticPost where one coherent flow is sufficient,
- story only where short sequential interaction genuinely fits.

Depth is appropriate to complexity.

Visual dependency is calibrated realistically.

1 = The format is usable but not clearly the strongest fit, or depth/visual
dependency is somewhat overstated or understated.

0 = Format choice is arbitrary, fashionable, contradicted by the brief,
or requires rewriting the communication job to make it work.


CHANNEL DISCIPLINE

2 = The candidate uses only eligible destinations and does not force
multi-channel execution.

Different destination specs are meaningfully adapted where appropriate.

The candidate avoids unsupported assumptions such as:
- Instagram must always be carousel/reel,
- Facebook must always be long text,
- both channels should always receive the same idea,
- one platform inherently performs better.

1 = Channel selection is valid but rationale relies somewhat on generic
platform assumptions or creates only weak destination differentiation.

0 = The candidate uses ineligible channels, duplicates channels, forces
multi-channel distribution without reason, or materially relies on invented
platform-performance beliefs.

Deterministic policy violations should normally be reflected as STRUCTURAL
or MANAGERIAL_USEFULNESS regressions when materially important.


BOUNDARY DISCIPLINE

2 = The candidate stays strictly at execution-spec level.

It does NOT create or modify:
- Weekly Objective,
- Content Direction,
- Content Audience Direction,
- Content Brief communication job,
- key takeaway,
- evidenceMode,
- evidence selection,
- CTA intent,
- IDs,
- timestamps,
- schedule,
- approval state,
- publishing state.

It also does NOT generate:
- headline,
- hook,
- caption,
- body copy,
- script,
- narration,
- carousel slide text,
- story-frame copy,
- hashtags,
- CTA wording.

Execution guidance describes shape, not copy.

1 = Minor copy leakage or small strategy leakage appears, but the artifact
still functions mainly as an execution spec.

0 = The candidate materially performs Writer work or rewrites strategic
decisions.

Authority violations should be reported under AUTHORITY.
Copy leakage may be reported under STRUCTURAL or MANAGERIAL_USEFULNESS.


MANAGERIAL USEFULNESS

2 = The Writer can clearly understand:
- where the content is going,
- what mode it uses,
- what format it uses,
- how much explanatory depth is needed,
- whether visuals are required,
- how the chosen format should carry the brief,
- what execution-specific boundaries matter.

The guidance materially reduces ambiguity without becoming copy.

1 = The spec is usable but generic, repetitive, or leaves the Writer to make
important execution decisions.

0 = The output adds little value beyond naming a channel and format.


CONTENT MODE

Mode must fit the Content Brief.

Do not reward:
- proofLed without eligible proof,
- directOffer without offer-oriented brief and required facts,
- serviceExplainer when the brief is not actually explaining an offer/service,
- trustBuilder merely because trust is generally valuable.

A strong execution mode should describe the actual communication behavior.


FORMAT SERVES STRATEGY

The governing rule is:

"Format must serve the brief.
The brief must not be changed to justify the format."

Do not reward trendy or engagement-first choices.

Do not assume carousel, reel, or story is inherently better.


DEPTH

Depth is relative:
- compact
- standard
- deep

Do not require exact word counts, character counts, slide counts, or duration.

A deeper format is not automatically better.

Depth should fit:
- audience explanation needs,
- complexity,
- format,
- Communication Envelope.


VISUAL DEPENDENCY

none:
The idea works primarily through text.

supporting:
Visuals materially improve clarity or attention.

essential:
The communication depends on visual sequence, comparison, demonstration,
or spatial presentation.

Do not reward "essential" simply because the destination is Instagram.


EXECUTION GUIDANCE

Strong execution guidance describes:
- information order,
- structural emphasis,
- how to preserve the takeaway,
- how to handle comparison or sequence,
- how not to lose required caveats.

It should NOT contain final wording.


CONSTRAINTS

Execution-specific constraints should supplement the Content Brief.

Do not reward generic restatement of all global rules.

Strong constraints are format-sensitive and operationally useful.


EVIDENCE DISCIPLINE

Execution choices must never relax evidence requirements.

Do not reward:
- proof-led framing without eligible proof,
- claims of better outcomes,
- invented credentials,
- platform-specific performance assumptions,
- unsupported engagement expectations.

Evidence and business facts remain bounded by the Content Brief.


AUDIENCE

Execution may adapt presentation,
not audience ownership.

Do not:
- change primary audience,
- add or remove audiences,
- change audience bias,
- infer stable platform preference.


COMMUNICATION ENVELOPE

Format and channel do not authorize a different tone.

The execution must remain inside:
- complexity,
- explanation depth,
- CTA style,
- sales pressure,
- framing rules,
- trust mechanisms,
- avoid rules.


NO FORCED MULTI-CHANNEL

Returning one destination may be better than returning two.

Do not reward quantity.

If two destinations are returned, each should have a credible reason to exist.

They do not need to use different formats merely for variety.


NO COPY

Do not reward near-final or final:
- hooks,
- headlines,
- captions,
- scripts,
- slide text,
- CTA wording,
- hashtags.

The Writer comes next.


CORE PRINCIPLES

Format serves strategy.

Execution narrows presentation.
It does not rewrite the brief.

Operator optimizes for useful progress, not activity.

Do not reward novelty or channel quantity.

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

export async function evaluateContentExecutionSpecSemantics(
    runner: GoldenModelRunner,
    input: unknown,
    candidateOutput: unknown,
): Promise<
    StructuredModelResult<ContentExecutionSpecGoldenEvaluation>
> {
    return runner.run<
        {
            readonly contentExecutionSpecInput: unknown
            readonly candidateOutput: unknown
        },
        ContentExecutionSpecGoldenEvaluation
    >({
        task:
            "golden.content-execution-spec.semantic-evaluation",

        systemPrompt: SYSTEM_PROMPT,

        input: {
            contentExecutionSpecInput: input,
            candidateOutput,
        },

        responseSchema: {
            name:
                "content_execution_spec_golden_evaluation",

            schema:
                CONTENT_EXECUTION_SPEC_GOLDEN_EVALUATION_SCHEMA,
        },
    })
}