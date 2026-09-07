# Goal

Improve the Social Operator's brand-voice fidelity across the generation pipeline.

A concrete failure has exposed a general architectural problem:

Brand Discovery can correctly identify a distinctive voice, but the generated post may still flatten it into balanced, generic professional prose.

Almost Another is the failing fixture, not a special case to hard-code.

## Evidence of the failure

Brand Discovery identifies the brand as:

- dialectical and confrontational;
- politically philosophical;
- aphoristic and theatrical;
- strict but explanatorily clear.

It also correctly captures the brand's structure and intellectual positioning.

Yet the generated Facebook post defaults to patterns such as:

- “one answer is...”
- “but there is another question...”
- “neither outcome is predetermined...”

The result is competent and safe, but materially less distinctive than the source brand.

## Important diagnosis to evaluate

There may be a semantic collision between:

- epistemic openness / refusal to claim final truth;
- rhetorical force / willingness to state a sharp thesis.

These must not be treated as the same dimension.

Likewise, global brand goals such as explaining the project to new readers may be leaking into tasks where they are not relevant, causing unnecessary explanatory/promotional endings.

Do not assume this diagnosis is complete. Inspect the implementation and determine the actual failure path.

## Architectural intent

Preserve the existing principles:

- Brand Brain represents brand knowledge/intent, not generated prose.
- Generation context must be task-scoped rather than dumping the full Brand Brain into the Writer.
- Writer should have high creative freedom but low knowledge authority.
- Editorial Quality Review is separate from truth/safety validation.
- Reviewer identifies issues and repair instructions; Writer performs at most one automatic consolidated repair.
- Prefer typed/domain-level semantics over accumulating prompt prose.
- Do not introduce brand-specific hard-coding.
- Do not build a giant voice agent or generic finalizer.

Canonical architecture authority:
`Brand Knowledge Architecture — Amendments & Supersession Map v1`

Use the supplied Almost Another Brand Discovery result and generated post as the primary regression fixture.

## What to determine

Inspect the relevant Brand Discovery, voice/domain types, Generation Context compilation, Writer prompting, and Editorial Quality path.

Determine whether the architecture adequately represents distinctions such as:

- epistemic stance;
- rhetorical stance;
- argumentative structure;
- intensity/assertiveness;
- explanatory density;
- characteristic stylistic behaviors;
- prohibited flattening behaviors.

Do not add these exact concepts mechanically if the existing domain model supports a cleaner solution.

Also determine whether task relevance is correctly filtering brand goals and communication guidance before generation.

## Required outcome

Implement the smallest coherent generalized correction that makes distinctive brand voice materially harder to flatten while remaining safe for ordinary brands with weak or generic voice identity.

The system must work for both:

- a highly distinctive brand such as Almost Another;
- an ordinary business whose voice is only mildly differentiated.

Do not manufacture distinctiveness where evidence does not support it.

## Quality invariant

Epistemic humility must not automatically imply rhetorical timidity.

A brand may remain open to uncertainty while expressing a sharp, forceful thesis.

Editorial Quality Review should be able to detect material voice flattening before Direct Publishing.

## Acceptance criteria

- Identify the actual failure path before modifying it.
- Preserve existing architectural boundaries.
- Make voice representation sufficiently expressive without overbuilding it.
- Ensure Generation Context is task-specific.
- Ensure distinctive voice survives into Writer context.
- Ensure Editorial Quality Review can flag meaningful voice flattening.
- Do not special-case Almost Another.
- Add focused regression tests/fixtures demonstrating both distinctive and ordinary-brand behavior.
- Run targeted tests and relevant type/build validation.
- Do not perform unrelated cleanup.
- Do not browse unless an external technical behavior is genuinely required.

Implementation details are yours.

At completion, report only:
1. root cause;
2. architectural correction;
3. material files/contracts changed;
4. validation performed;
5. any genuine unresolved risk.