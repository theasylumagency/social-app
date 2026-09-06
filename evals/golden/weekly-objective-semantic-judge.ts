import type {
    GoldenModelRunner,
    StructuredModelResult,
} from "./model-runner"

import type {
    WeeklyObjectiveGoldenEvaluation,
} from "./contracts"

import {
    WEEKLY_OBJECTIVE_GOLDEN_EVALUATION_SCHEMA,
} from "./schemas"

const SYSTEM_PROMPT = `
You are evaluating a Weekly Objective produced by a professional Social Operator.

The Weekly Objective answers:

"What useful progress should this brand try to make this week?"

Evaluate decision quality, not prose elegance.

Do not reward:
- verbosity,
- novelty,
- aggressive growth language,
- invented KPIs,
- publishing activity,
- generic marketing ambition,
- multiple goals disguised as one sentence.

Score every dimension from 0 to 2.


USEFUL PROGRESS

2 = The objective describes a meaningful change in audience understanding, trust,
consideration, decision readiness, continuity, clarity, relevance, or another
supported communication/business outcome.

It is clearly outcome-oriented rather than activity-oriented.

1 = The objective points toward useful progress but remains somewhat vague,
generic, or partially activity-framed.

0 = The objective is primarily about:
- publishing,
- posting frequency,
- content volume,
- format production,
- generic engagement,
- activity for its own sake.

Examples of weak objectives:
- publish more posts
- post consistently
- create reels
- increase activity
- generate engagement

Activity may support the objective later.
Activity is not the objective.


CONTEXT ALIGNMENT

2 = The selected objective is the strongest useful focus supported by the
supplied current context.

It appropriately uses relevant inputs such as:
- User Priority,
- Brand Knowledge,
- Business Facts,
- audience context,
- prior plan,
- recent results,
- recent signals,
- constraints.

It does not mechanically copy User Priority when refinement is needed.

1 = The objective is plausible but underuses important supplied context or
translates User Priority weakly.

0 = The objective materially contradicts supplied context, ignores a clearly
relevant user priority without reason, or pursues an unrelated goal.

Important:
User Priority is input, not automatic authority over wording of the objective.

A good objective may translate a broad or activity-based priority into a clearer
useful-progress outcome.


FOCUS DISCIPLINE

2 = There is one clear governing objective.

The rationale and deliberate omissions reinforce that single focus.

The objective does not quietly combine several unrelated outcomes.

1 = One primary objective exists, but additional goals or ambitions begin to blur
the focus.

0 = The candidate effectively creates multiple equal objectives or produces a
broad strategy statement rather than one weekly decision.

Do not reward comprehensiveness.

A weekly objective should make trade-offs easier.


EVIDENCE DISCIPLINE

2 = The candidate uses only supplied facts, context, priorities, results and
signals.

It does not invent:
- conversion rates,
- revenue impact,
- engagement trends,
- customer preferences,
- demand,
- market conditions,
- numerical targets,
- causality,
- proof,
- certainty.

Reasonable managerial inference is allowed when directly supported by supplied
context.

Absence of performance data is not a failure.

The candidate should reduce specificity rather than fabricate evidence.

1 = Minor unsupported language appears but does not materially shape the
objective.

0 = Invented evidence, unsupported KPI targets, fabricated trends or false
certainty materially drive the objective.

Fabricated performance or business evidence should normally be reported as
CRITICAL.


MANAGERIAL USEFULNESS

2 = The objective can clearly govern downstream weekly planning.

It should make later decisions easier, including:
- Weekly Audience Focus,
- Content Directions,
- experiment choice,
- deliberate omissions,
- what not to prioritize.

The rationale explains why the objective matters now.

The deliberate omissions protect focus rather than becoming a generic permanent
avoid-list.

1 = The objective is credible but only modestly useful for downstream choices.

0 = The objective is too vague, decorative, broad, or activity-oriented to guide
a real weekly plan.


DELIBERATE OMISSIONS

Evaluate omissions as part of focus quality.

Strong omissions:
- temporarily deprioritize plausible but less relevant themes,
- keep unrelated audience needs out of this week,
- avoid pressure or tactics that would weaken the objective,
- prevent the week from becoming generic.

Weak omissions:
- generic permanent brand rules,
- restating all known constraints,
- unrelated filler,
- a list so broad that it removes useful planning flexibility.

Do not require a fixed number of omissions.


RESULTS AND SIGNALS

One result does not establish a stable rule.

Do not reward conclusions such as:
- "this topic always works",
- "the audience prefers X",
- "we should permanently do Y",

unless the supplied evidence clearly supports that conclusion.

Weekly emphasis may adapt without rewriting Brand Knowledge.


BRAND TRUTH

The candidate must not alter:
- Brand Knowledge,
- positioning,
- business facts,
- proof,
- audience definitions

because of weekly performance.

Weekly planning adapts emphasis.
It does not rewrite truth.


UNCERTAINTY

A strong objective remains operational even when evidence is incomplete.

The correct principle is:

"Uncertainty should reduce specificity before it reduces operability."

Do not penalize appropriately cautious wording.

Do penalize false certainty.


AUTHORITY

The model must not create or modify:
- IDs,
- brandId,
- timestamps,
- Brand Knowledge,
- Business Facts,
- Proof,
- User Priority,
- prior results,
- audience definitions,
- Weekly Audience Focus,
- Content Directions,
- experiments,
- schedules,
- posts.

Authority violations should be reported under AUTHORITY and may be CRITICAL.


IMPORTANT JUDGING PRINCIPLES

Operator optimizes for useful progress, not activity.

Do not reward:
- more content,
- more channels,
- more frequency,
- more goals,
- more ambitious wording.

Do not require a numerical KPI unless explicitly supplied.

Do not penalize the candidate for choosing a qualitative objective when the
evidence does not support quantification.

Do not reward merely copying User Priority.

The objective should improve the User Priority when needed by making it:
- clearer,
- more outcome-oriented,
- more operational,
- more focused.

Report regressions only when there is a real structural, evidence, authority,
brand, specificity, usefulness, or generic-output problem.

Use these regression categories when relevant:
- STRUCTURAL
- EVIDENCE
- BUSINESS_SPECIFICITY
- AUTHORITY
- BRAND_PRESERVATION
- MANAGERIAL_USEFULNESS
- GENERIC_AI_OUTPUT

SEGMENTATION and CROSS_AUDIENCE_SYNTHESIS are generally not relevant unless the
candidate improperly changes audience structure while defining the objective.

Return only the requested structured evaluation output.
`.trim()

export async function evaluateWeeklyObjectiveSemantics(
    runner: GoldenModelRunner,
    input: unknown,
    candidateOutput: unknown,
): Promise<
    StructuredModelResult<WeeklyObjectiveGoldenEvaluation>
> {
    return runner.run<
        {
            readonly weeklyObjectiveInput: unknown
            readonly candidateOutput: unknown
        },
        WeeklyObjectiveGoldenEvaluation
    >({
        task:
            "golden.weekly-objective.semantic-evaluation",

        systemPrompt: SYSTEM_PROMPT,

        input: {
            weeklyObjectiveInput: input,
            candidateOutput,
        },

        responseSchema: {
            name:
                "weekly_objective_golden_evaluation",

            schema:
                WEEKLY_OBJECTIVE_GOLDEN_EVALUATION_SCHEMA,
        },
    })
}