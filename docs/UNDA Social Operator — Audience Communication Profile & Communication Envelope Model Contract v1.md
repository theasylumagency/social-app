# UNDA Social Operator — Audience Communication Profile & Communication Envelope Model Contract v1

## 0. Purpose

ეს დოკუმენტი განსაზღვრავს ორ downstream semantic component-ს:

1. **Audience Communication Profile Generator**
2. **Communication Envelope Generator**

Canonical flow:

```text
Audience Landscape
+ Brand Voice
+ Positioning
+ Offers
+ Constraints
↓
Audience Communication Profiles
↓
Communication Envelope
↓
Weekly Planner
↓
Content Direction
↓
Writer
```

ძირითადი განსხვავება:

```text
Audience Communication Profile
= როგორ უნდა ელაპარაკოს ამ ბრენდმა კონკრეტულ audience-ს

Communication Envelope
= როგორ უნდა ილაპარაკოს ბრენდმა ჩვეულებრივ organic content-ში
  ისე, რომ მთავარ audience-ებს ერთდროულად მოერგოს
```

---

# Part I — Audience Communication Profile Generator

## 1. Core Responsibility

Generator პასუხობს:

> ამ კონკრეტულ audience situation-თან როგორ უნდა ადაპტირდეს ბრენდის უკვე არსებული ხმა?

იგი არ ქმნის ახალ Brand Voice-ს.

იგი არ წყვეტს weekly strategy-ს.

იგი არ წერს content-ს.

---

## 2. Input Contract

Conceptual:

```ts
type AudienceCommunicationProfileModelInput = {
  readonly audience: {
    readonly source: "operator" | "founder"

    readonly name: string
    readonly buyingSituation?: string
    readonly currentNeed?: string
    readonly decisionStage?: string
    readonly likelyBarriers?: readonly string[]
    readonly mainQuestions?: readonly string[]
    readonly relevantOffers?: readonly string[]

    readonly founderStance?:
      | "agree"
      | "unsure"
      | "disagree"

    readonly influence:
      | "strong"
      | "standard"
      | "limited"
      | "none"
  }

  readonly brandVoice: {
    readonly primaryTone: readonly string[]
    readonly formality?: string
    readonly energy?: string
    readonly emotionalStyle?: string
    readonly languageRules?: readonly string[]
    readonly preferredPatterns?: readonly string[]
    readonly avoidPatterns?: readonly string[]
  }

  readonly positioning?: {
    readonly corePosition?: string
    readonly differentiators?: readonly string[]
    readonly valuePropositions?: readonly string[]
  }

  readonly relevantOffers?: readonly {
    readonly name: string
    readonly description?: string
  }[]

  readonly eligibleProof?: readonly string[]
  readonly constraints?: readonly string[]

  readonly locale: "ka" | "en"
}
```

---

## 3. Model Output

```ts
type AudienceCommunicationProfileModelOutput = {
  readonly communicationGoal: string

  readonly toneAdjustments: readonly string[]

  readonly preferredFraming: readonly string[]
  readonly usefulContentAngles: readonly string[]

  readonly assumedKnowledge:
    | "none"
    | "basic"
    | "informed"
    | "expert"

  readonly explanationDepth:
    | "light"
    | "balanced"
    | "deep"

  readonly trustMechanisms: readonly string[]

  readonly ctaStyle:
    | "informational"
    | "lowPressure"
    | "consultative"
    | "directWhenJustified"

  readonly avoid: readonly string[]

  readonly rationale: string
}
```

---

## 4. Brand Voice Preservation Rule

The model must treat Brand Voice as a boundary.

Correct:

```text
Brand Voice:
calm, professional, restrained

Audience:
decision-ready

Adaptation:
more concrete
more decision-oriented
more process detail
```

Incorrect:

```text
Audience wants excitement
→ use loud energetic tone
```

unless that tone is compatible with Brand Voice.

---

## 5. Communication Goal

`communicationGoal` answers:

> What does communication need to accomplish for this audience situation?

Examples:

```text
reduce uncertainty
clarify options
support provider comparison
build trust
encourage continuation
make the next step easier
```

It must not be:

```text
increase engagement
get more likes
go viral
```

unless a specific downstream business strategy explicitly requires that.

---

## 6. Tone Adjustments

Tone adjustments must be relative to Brand Voice.

Good:

```text
more explanatory
more concrete
more reassuring
more decision-oriented
```

Bad:

```text
fun
bold
viral
trendy
```

unless justified by Brand Voice and audience situation.

---

## 7. Preferred Framing

Preferred framing expresses useful semantic structures.

Examples:

```text
problem → explanation → options → next step

question → clarification → practical implication

risk → what matters → how to evaluate
```

It is not a rigid post template.

---

## 8. Useful Content Angles

Examples:

```text
how the process works
what to consider before choosing
common misunderstanding
how to compare options
what information matters before deciding
what happens after consultation
```

These are strategic directions, not generated post topics.

---

## 9. Assumed Knowledge

The model must estimate how much knowledge may reasonably be assumed.

Default principle:

> Do not assume expert knowledge unless evidence supports it.

For general consumer communication, usually:

```text
none
or
basic
```

---

## 10. Explanation Depth

`explanationDepth` should reflect decision complexity.

For high-risk / high-consideration purchases:

```text
balanced
or
deep
```

may be appropriate.

But depth does not mean jargon.

---

## 11. Trust Mechanisms

Possible examples:

```text
process clarity
specificity
professional explanation
real proof
transparent uncertainty
clear limitations
expertise
practical guidance
```

Avoid unsupported authority signaling.

---

## 12. CTA Style

CTA should match audience readiness.

Examples:

### Problem-aware

```text
informational
lowPressure
```

### Provider comparison

```text
consultative
```

### Decision-ready

```text
directWhenJustified
```

The profile recommends a baseline.

Weekly Planner or campaign context may override it downstream.

---

## 13. Profile for Challenged Audience

If:

```text
founderStance = disagree
influence = limited
```

the model may still generate a profile if application policy requests it.

But it must not treat that audience as central to brand communication.

The profile exists because the hypothesis remains preserved.

---

# Part II — Communication Envelope Generator

## 14. Core Responsibility

Communication Envelope Generator answers:

> Given the current Audience Landscape, Brand Voice and positioning, what communication rules allow ordinary organic content to remain useful and appropriate across the audiences that materially matter?

It creates:

```text
shared communication corridor
```

not:

```text
one average persona
```

---

## 15. Input Contract

```ts
type CommunicationEnvelopeModelInput = {
  readonly brandVoice: {
    readonly primaryTone: readonly string[]
    readonly formality?: string
    readonly energy?: string
    readonly emotionalStyle?: string
    readonly languageRules?: readonly string[]
    readonly preferredPatterns?: readonly string[]
    readonly avoidPatterns?: readonly string[]
  }

  readonly positioning?: {
    readonly corePosition?: string
    readonly differentiators?: readonly string[]
    readonly valuePropositions?: readonly string[]
  }

  readonly audienceLandscape: readonly {
    readonly audienceKey: string

    readonly source: "operator" | "founder"

    readonly name: string
    readonly summary: string

    readonly founderStance?:
      | "agree"
      | "unsure"
      | "disagree"

    readonly influence:
      | "strong"
      | "standard"
      | "limited"
      | "none"
  }[]

  readonly communicationProfiles: readonly {
    readonly audienceKey: string

    readonly communicationGoal: string
    readonly toneAdjustments: readonly string[]
    readonly preferredFraming: readonly string[]
    readonly assumedKnowledge:
      | "none"
      | "basic"
      | "informed"
      | "expert"
    readonly explanationDepth:
      | "light"
      | "balanced"
      | "deep"
    readonly trustMechanisms: readonly string[]
    readonly ctaStyle: string
    readonly avoid: readonly string[]
  }[]

  readonly constraints?: readonly string[]
  readonly channelContext?: readonly string[]

  readonly locale: "ka" | "en"
}
```

---

## 16. Important Authority Rule

The model must **not** change influence.

It receives:

```text
strong
standard
limited
none
```

from deterministic application resolution.

It cannot decide:

> Founder disagreed, but I think this segment matters, therefore strong.

Application owns audience authority.

Model owns semantic synthesis only.

---

## 17. Envelope Output

```ts
type CommunicationEnvelopeModelOutput = {
  readonly complexity:
    | "plain"
    | "plainWithProfessionalDepth"
    | "technicalWhenExplained"
    | "expert"

  readonly assumedKnowledge:
    | "none"
    | "basic"
    | "informed"
    | "expert"

  readonly explanationDepth:
    | "light"
    | "balanced"
    | "deep"

  readonly toneRange: readonly string[]

  readonly framingRules: readonly string[]
  readonly preferredStructures: readonly string[]
  readonly terminologyRules: readonly string[]

  readonly proofStyle: readonly string[]

  readonly ctaStyle:
    | "informational"
    | "lowPressure"
    | "consultative"
    | "directWhenJustified"

  readonly salesPressure:
    | "low"
    | "moderate"
    | "high"

  readonly inclusivityRules: readonly string[]

  readonly trustMechanisms: readonly string[]

  readonly avoid: readonly string[]

  readonly rationale: string
}
```

---

## 18. Weighting Semantics

The model must interpret:

### `strong`

This audience should materially shape the shared envelope.

### `standard`

This audience should remain compatible with the envelope.

### `limited`

Do not let this audience dominate communication decisions.

### `none`

Ignore for envelope synthesis.

---

## 19. Founder-Provided Audience

Founder-provided audiences may have `strong` influence.

But the model must not invent details that founder did not provide.

If founder says:

> უცხოეთში მცხოვრები ქართველები, რომლებიც საქართველოში ჩამოდიან სამკურნალოდ.

The model may infer only carefully.

It should not invent:

```text
age
income
specific countries
travel frequency
media habits
```

---

## 20. The Envelope Must Resolve Trade-offs

This is one of the model's main jobs.

Example:

```text
Audience A:
needs concrete decision detail

Audience B:
needs simple explanation
```

Bad output:

```text
Use simple language.
```

Too weak.

Better:

> Start in everyday language, explain professional terms briefly, but include enough concrete detail for a reader who is already comparing options.

This is what `inclusivityRules` are for.

---

## 21. Inclusivity Rules

These rules explicitly manage cross-audience trade-offs.

Examples:

```text
Do not assume specialist knowledge.

Do not oversimplify to the point that decision-ready users learn nothing.

Explain technical terms when they materially affect a decision.

Keep direct selling secondary to useful explanation.

Let a specific post lean toward one audience without sounding foreign to others.
```

---

## 22. Complexity

The envelope should choose the minimum complexity needed to remain useful.

Common default for professional consumer brands:

```text
plainWithProfessionalDepth
```

But this is not globally hard-coded.

---

## 23. Tone Range

Tone Range defines allowed movement.

Example:

```text
calm
competent
clear
confident
reassuring
```

Avoid contradictory combinations such as:

```text
restrained
hyper-energetic
provocative
```

unless the Brand Voice genuinely supports them.

---

## 24. Framing Rules

Framing rules should guide reasoning, not create repetitive templates.

Examples:

```text
Lead with a real customer question or decision.

Explain before selling.

Move from uncertainty toward clarity.

Use service mentions as solutions to a problem, not as catalog promotion.

Prefer practical implications over generic claims.
```

---

## 25. Preferred Structures

Examples:

```text
question → explanation → decision guidance

problem → what it may mean → options → next step

claim → evidence → implication

process → why it matters → what to expect
```

Writer may vary structure.

---

## 26. Terminology Rules

Example:

> Use professional terminology only when it improves accuracy; explain it in plain language at first meaningful use.

Or:

> Avoid internal industry terms that customers are unlikely to know.

---

## 27. Proof Style

Possible output:

```text
prefer concrete facts
prefer real process
prefer verified expertise
prefer specific proof
avoid superiority claims
avoid unsupported outcomes
```

Proof Style does not authorize claims.

Actual claim eligibility still comes from Brand Knowledge / Proof / safety rules.

---

## 28. Sales Pressure

Organic baseline should usually remain:

```text
low
or
moderate
```

but this depends on brand and business model.

Envelope does not prohibit direct campaign content later.

---

## 29. CTA Style

Envelope defines default CTA posture.

A weekly plan or specific content role can narrow it.

Example:

```text
Envelope:
lowPressure

Specific decision-ready post:
consultative
```

---

## 30. Avoid List

Should contain material constraints, not generic writing advice.

Useful:

```text
fear-based selling
unsupported superlatives
artificial urgency
excessive jargon
fake certainty
empty motivational language
forced youth slang
```

Weak:

```text
bad writing
boring content
unprofessional tone
```

---

# Part III — Generation Order

## 31. Correct Order

```text
Audience Landscape
↓
Audience Communication Profiles
↓
Communication Envelope
```

Do not generate Envelope before Profiles when materially different audience situations exist.

---

## 32. Profile Generation Strategy

v1 may use:

```text
one model call per materially relevant audience
```

or a single batched structured call.

Preferred v1:

```text
one batched strong-model call
```

for cost and consistency, if output quality remains high.

Maximum profile count should remain small because Audience Landscape itself is small.

---

## 33. Envelope Generation

Envelope should be a separate call.

Reason:

```text
Profiles = segment-specific reasoning

Envelope = cross-segment synthesis
```

Combining both into one giant prompt makes debugging and quality regression harder.

---

# Part IV — Application Validation

## 34. Profile Validation

Application checks:

```text
valid audience reference
valid enum values
required fields present
array caps
no unknown audience
no state fields
no IDs generated by model
```

Recommended caps:

```text
toneAdjustments <= 6
preferredFraming <= 6
usefulContentAngles <= 8
trustMechanisms <= 6
avoid <= 8
```

---

## 35. Envelope Validation

Recommended caps:

```text
toneRange <= 6
framingRules <= 8
preferredStructures <= 6
terminologyRules <= 6
proofStyle <= 6
inclusivityRules <= 8
trustMechanisms <= 6
avoid <= 10
```

---

## 36. Invalid Envelope

Reject if:

- audience influence values are rewritten;
- founder stance is contradicted as authority;
- output invents new audiences;
- output creates new brand voice;
- output is only adjective lists;
- inclusivity rules are missing;
- envelope simply repeats Brand Voice;
- recommendations are internally contradictory.

---

# Part V — Model Prompt

## 37. Audience Communication Profile System Prompt

Conceptual:

```text
You are the Audience Communication Profiler for a professional Social Operator.

Your task is to determine how the existing Brand Voice should adapt when
communicating with a specific audience situation.

Do not create a new brand personality.
Do not write posts.
Do not recommend weekly strategy.
Do not invent demographics or audience facts.

Focus on:
- what communication must accomplish,
- how much knowledge can be assumed,
- what level of explanation is needed,
- what framing helps,
- what builds trust,
- what CTA posture is appropriate,
- what should be avoided.

All adaptations must remain compatible with the supplied Brand Voice and
constraints.

Return only the requested structured output.
```

---

## 38. Communication Envelope System Prompt

Conceptual:

```text
You are the Communication Envelope Generator for a professional Social Operator.

Your task is to synthesize a shared organic communication corridor from:
- Brand Voice,
- current Audience Landscape,
- audience communication profiles,
- positioning,
- constraints.

Audience influence is already determined by the application.
Do not re-rank, override or reinterpret that authority.

The envelope should preserve Brand Voice while keeping normal organic
communication useful across the audiences that materially matter.

Do not average audiences into a generic persona.

Resolve real communication trade-offs explicitly:
- simple vs informative,
- accessible vs professionally useful,
- broad relevance vs decision depth,
- helpfulness vs sales pressure.

Do not write posts.
Do not create weekly strategy.
Do not invent audiences.
Do not generate IDs or state.

Return only the requested structured output.
```

---

# Part VI — Total Charm Dent Golden Brand Test

## 39. Expected Audience Profile Quality

For a decision-ready dental audience, a good profile should roughly produce:

```text
communication goal:
help the user evaluate options and make a confident decision

tone adaptation:
more concrete
more process-oriented
still calm and professional

explanation:
balanced/deep

trust:
process clarity
specificity
proof
professional explanation

CTA:
consultative
```

---

## 40. Expected Profile for Problem-Aware Audience

Roughly:

```text
goal:
reduce uncertainty and make the problem understandable

tone:
more explanatory
reassuring
non-alarmist

assumed knowledge:
none/basic

CTA:
informational or low-pressure
```

---

## 41. Expected Communication Envelope Shape

A good Total Charm Dent envelope should discover something close to:

```text
plain language with professional depth

calm, competent, confident tone

do not assume dental knowledge

explain terminology

give enough concrete detail for high-intent users

prefer:
question/problem → explanation → options → next step

build trust through:
process
expertise
specificity
real proof

avoid:
fear
unsupported superlatives
artificial urgency
overly technical language

CTA:
low-pressure / consultative
```

Exact wording is not required.

---

## 42. Golden Failure

Fail if Envelope becomes:

```text
Professional
Friendly
Trustworthy
Informative
```

This is not an envelope.

Fail if:

```text
Use emotional storytelling and viral hooks
```

without Brand Voice or audience support.

Fail if:

```text
Always speak specifically to the highest-intent audience
```

because organic communication must remain cross-audience compatible.

---

# Part VII — Refresh Rules

## 43. Recompute Audience Profile When

```text
audience materially changes
Brand Voice materially changes
relevant positioning changes
major barrier/need knowledge changes
```

---

## 44. Recompute Communication Envelope When

```text
Audience Landscape materially changes
Brand Voice changes
important communication constraints change
positioning changes materially
```

Do not regenerate because:

```text
new week started
one post performed differently
one metric changed
content was published
```

---

# Part VIII — Final Invariants

## 45. Audience Profile Invariant

> Adapt the brand to the audience without turning the brand into someone else.

---

## 46. Communication Envelope Invariant

> Make ordinary organic communication useful across the important audience landscape without reducing it to generic content.

---

## 47. Writer Boundary

Writer receives:

```text
Brand Voice
+
Communication Envelope
+
specific Audience Focus if any
+
Weekly Objective
+
Content Role
+
Facts / Proof
```

Writer does not derive the communication system itself.

---

# 48. Final Flow

```text
BRAND KNOWLEDGE
+
AUDIENCE LANDSCAPE
↓
AUDIENCE COMMUNICATION PROFILES
↓
COMMUNICATION ENVELOPE
↓
WEEKLY PLANNER
↓
AUDIENCE FOCUS
+
CONTENT ROLE
↓
WRITER
```

This keeps semantic authority upstream and creative execution downstream.