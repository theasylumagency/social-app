# UNDA Social Operator — Golden Brand Evaluation Spec v1

## 0. Purpose

Golden Brand Evaluation Spec განსაზღვრავს, როგორ ვამოწმებთ Social Operator-ის semantic reasoning კომპონენტების ხარისხს რეალურ reference brand-ზე.

პირველი Golden Brand:

```text
Total Charm Dent
```

Evaluation-ის მიზანი არ არის სიტყვასიტყვითი output match.

მიზანია შევამოწმოთ:

> Prompt-ის, model-ის ან orchestration-ის ცვლილების შემდეგ Operator კვლავ იმავე დონის ბიზნეს-გაგებას, audience reasoning-ს და communication strategy-ს აჩვენებს თუ არა.

---

# 1. Why Golden Brand Exists

LLM output შეიძლება ტექნიკურად სწორი იყოს და მაინც მნიშვნელოვნად გაუარესდეს.

მაგალითად:

```text
before:
decision-ready customer comparing clinics

after:
women aged 25–45 interested in dental care
```

ორივე შეიძლება schema-ს აკმაყოფილებდეს.

მეორე კი აშკარად ხარისხობრივი regression-ია.

ამიტომ საჭიროა semantic evaluation.

---

# 2. Golden Test Philosophy

Golden test არ ამოწმებს:

```text
exact wording
exact segment names
exact sentence order
exact number of recommendations
```

იგი ამოწმებს:

```text
reasoning quality
business specificity
evidence discipline
decision usefulness
uncertainty discipline
managerial maturity
```

---

# 3. Evaluation Layers

Total Charm Dent Golden evaluation მოიცავს:

1. **Audience Hypothesis Generator**
2. **Founder Feedback / Audience Landscape**
3. **Audience Communication Profiles**
4. **Communication Envelope**
5. მომავალში:
   - Weekly Planner
   - Content Directions
   - Writer
   - Results / Learning

v1-ში პირველი ოთხი სავალდებულოა.

---

# 4. Fixed Golden Input

Golden test უნდა იყენებდეს სტაბილურ compiled business context-ს.

Input უნდა შეიცავდეს მხოლოდ იმ ინფორმაციას, რომელიც რეალურად ვიცით brand-ზე.

არ უნდა შეიცვალოს test run-ებს შორის prompt/model comparison-ის დროს.

---

# 5. Total Charm Dent — Reference Business Understanding

Golden fixture დაახლოებით უნდა ასახავდეს:

```text
Business:
multi-service dental clinic

Location:
Tbilisi / Vake

Offers:
therapy
diagnostics
orthodontics
implantology
aesthetic dentistry
veneers
periodontology
digital planning
related dental services

Positioning:
professional
calm
quality-focused
premium but restrained

Brand communication:
quiet confidence
competence
trust
clarity

Purchase characteristics:
high trust requirement
high perceived risk
technical complexity
provider comparison
decision uncertainty
treatment continuity
```

ეს fixture source-derived context-ის compiled representation უნდა იყოს.

---

# 6. Audience Generator — Hard Fail Conditions

Run ავტომატურად FAIL-დება თუ:

- ქმნის ძირითადად demographic personas-ს evidence-ის გარეშე;
- იგონებს ასაკს, შემოსავალს, პროფესიას, ინტერესებს;
- უბრალოდ service catalog-ს გარდაქმნის audience list-ად;
- ყველა segment generic-ია;
- segment-ები რეალურად ერთ buying situation-ს აღწერს;
- უცნობ offer-ს იგონებს;
- fabricated evidence reference აქვს;
- assumptions და evidence ერთმანეთში ერევა;
- 5-ზე მეტ segment-ს ქმნის;
- output ვერ გადის schema validation-ს.

---

# 7. Audience Generator — Required Semantic Qualities

Good output-ში უნდა ჩანდეს მინიმუმ სამი განსხვავებული decision situation.

Reference concepts:

```text
decision-ready / provider comparison

problem-aware but undecided

existing / returning patient

decision-maker for another person
```

Exact wording optional.

3 segment-იც acceptable-ია, თუ segmentation coherent-ია.

---

# 8. Audience Distinctness Score

Score:

```text
0 — duplicate/generic
1 — partially distinct
2 — clearly distinct buying situations
```

PASS requires:

```text
2
```

---

# 9. Business Specificity Score

Question:

> Could this audience output be pasted onto an unrelated business with minimal changes?

Score:

```text
0 — almost universal boilerplate
1 — somewhat tailored
2 — clearly specific to this business category and offer structure
```

PASS requires:

```text
2
```

---

# 10. Evidence Discipline Score

Evaluate:

- known facts vs assumptions separated?
- unsupported demographic claims avoided?
- evidence basis plausible?
- uncertainty represented honestly?

Score:

```text
0 — fabricated certainty
1 — mixed discipline
2 — clear evidence/assumption separation
```

PASS requires:

```text
2
```

---

# 11. Managerial Usefulness Score

Question:

> Could a senior social media manager make meaningfully better planning decisions from these segments?

Score:

```text
0 — no operational value
1 — somewhat useful
2 — directly useful for strategy
```

PASS requires:

```text
2
```

---

# 12. Audience Founder Impact Score

Question:

> Would a knowledgeable founder plausibly feel that Operator actually understood the business?

Score:

```text
0 — obvious AI filler
1 — acceptable
2 — materially insightful
```

Target:

```text
2
```

This metric is subjective but important.

---

# 13. Audience Generator PASS Rule

Audience Generator passes if:

```text
no hard fail
AND
Distinctness = 2
AND
Business Specificity = 2
AND
Evidence Discipline = 2
AND
Managerial Usefulness = 2
AND
Founder Impact >= 1
```

Preferred production bar:

```text
Founder Impact = 2
```

---

# 14. Audience Landscape Test Scenario

Golden scenario should inject founder reactions after Operator generation.

Example:

```text
Audience A:
Founder = agree

Audience B:
Founder = unsure

Audience C:
Founder = disagree

Founder adds Audience D
```

This tests whether provenance and authority remain separated.

---

# 15. Landscape Hard Fail Conditions

FAIL if:

- disagree deletes Operator hypothesis;
- founder-added audience overwrites existing one;
- origin is lost;
- founder stance becomes model-generated;
- model changes influence directly;
- all audiences become equal-weight by accident.

---

# 16. Landscape Resolution Expected Behavior

Expected:

```text
Operator + agree
→ strong influence

Operator + unsure
→ standard influence

Operator + not reviewed
→ standard influence

Operator + disagree
→ limited influence

Founder-provided
→ strong influence

retired
→ none
```

v1-ში ეს deterministic.

---

# 17. Communication Profile Evaluation

Each materially relevant audience should produce a communication profile that:

```text
preserves Brand Voice
adapts to audience need
changes explanation depth appropriately
changes framing appropriately
changes CTA posture appropriately
```

---

# 18. Communication Profile Hard Fail

FAIL if profile:

- invents new Brand Voice;
- contradicts brand tone;
- recommends loud/trendy tone without support;
- writes actual posts instead of guidance;
- invents audience facts;
- ignores decision stage;
- uses identical profile for every audience;
- produces vanity-metric goals.

---

# 19. Decision-Ready Audience Reference Quality

Expected semantic behavior:

```text
more concrete
more process-oriented
more decision-supportive
more specific
proof-aware
consultative CTA
```

Not required exact words.

---

# 20. Problem-Aware Audience Reference Quality

Expected:

```text
more explanatory
lower assumed knowledge
reassuring / non-alarmist
uncertainty reduction
low-pressure CTA
```

---

# 21. Existing / Returning Audience Reference Quality

Expected:

```text
continuation
maintenance
practical relevance
less acquisition-heavy framing
more familiarity without losing professionalism
```

---

# 22. Profile Differentiation Score

Question:

> Do profiles meaningfully differ based on audience state while preserving one brand?

Score:

```text
0 — identical or contradictory
1 — some differentiation
2 — clear, useful differentiation
```

PASS requires:

```text
2
```

---

# 23. Brand Preservation Score

Question:

> Do all profiles still sound like one brand?

Score:

```text
0 — brand fragments into different personalities
1 — mostly preserved
2 — clearly preserved
```

PASS requires:

```text
2
```

---

# 24. Communication Envelope — Core Evaluation

Envelope must solve this tension:

```text
accessible enough for lower-knowledge audience
+
specific enough for decision-ready audience
+
professional enough for existing customer
+
consistent with Brand Voice
```

---

# 25. Envelope Hard Fail

FAIL if envelope:

- is only adjectives;
- simply repeats Brand Voice;
- ignores audience landscape;
- averages audiences into generic communication;
- lets challenged audience dominate;
- invents new audience;
- re-ranks influence;
- becomes overly restrictive;
- gives no usable Writer guidance;
- recommends unsupported sales pressure.

---

# 26. Expected Total Charm Dent Envelope

A strong output should discover something semantically close to:

```text
plain language with professional depth

calm, competent, confident tone

do not assume dental knowledge

explain technical terminology

retain enough specificity for high-intent users

prefer:
problem/question
→ explanation
→ options/implications
→ next step

trust via:
process
specificity
expert explanation
real proof

avoid:
fear-based selling
unsupported superiority
artificial urgency
jargon overload

CTA:
low-pressure / consultative
```

Exact wording not required.

---

# 27. Envelope Trade-off Resolution Score

Question:

> Does the envelope explicitly solve cross-audience communication tensions?

Score:

```text
0 — no real synthesis
1 — partial synthesis
2 — clear trade-off resolution
```

PASS requires:

```text
2
```

---

# 28. Envelope Usefulness Score

Question:

> Could Writer produce better content because this Envelope exists?

Score:

```text
0 — no material difference
1 — some guidance
2 — materially constraining/useful guidance
```

PASS requires:

```text
2
```

---

# 29. Envelope Specificity Score

Question:

> Could this exact envelope be used for almost any professional service brand?

Score:

```text
0 — generic
1 — partially specific
2 — clearly shaped by this brand + audience landscape
```

PASS requires:

```text
2
```

---

# 30. Organic Communication Principle

Envelope should not narrow every post to one audience.

Golden test should reward:

```text
shared accessibility
+
specific content tilt when useful
```

and penalize:

```text
every post is hyper-segmented
```

---

# 31. No Novelty Bias

Evaluation should fail recommendations whose primary logic is:

```text
try something new
follow trends
increase activity
post more
use viral formats
```

without a managerial reason.

---

# 32. No Activity Bias

Quality output should be comfortable recommending:

```text
fewer posts
no experiment this week
repeat a proven structure
avoid unnecessary change
```

This becomes more important in Weekly Planner tests later.

---

# 33. Uncertainty Discipline

Golden evaluator should reward outputs that say, conceptually:

```text
this is plausible
this is supported
this remains uncertain
```

and penalize outputs that flatten everything into certainty.

---

# 34. Founder Disagreement Scenario

Golden test should include:

```text
Operator believes Audience C matters
Founder disagrees
```

Expected:

```text
preserve hypothesis
preserve disagreement
reduce influence
do not delete
do not declare either side correct
```

---

# 35. Founder-Added Audience Scenario

Founder adds a specific business-relevant audience.

Expected:

```text
preserve origin = founder
include materially in landscape
consider strongly in envelope
do not fabricate extra details
```

---

# 36. Regression Categories

Each run should classify failures as:

```text
STRUCTURAL
EVIDENCE
SEGMENTATION
BUSINESS_SPECIFICITY
AUTHORITY
BRAND_PRESERVATION
CROSS_AUDIENCE_SYNTHESIS
MANAGERIAL_USEFULNESS
GENERIC_AI_OUTPUT
```

---

# 37. Regression Severity

Recommended:

```text
critical
major
minor
```

### Critical

Examples:

```text
invented facts
authority violation
invalid schema
founder disagreement erased
fabricated evidence
```

### Major

Examples:

```text
generic personas
poor segmentation
weak envelope
brand fragmentation
```

### Minor

Examples:

```text
slightly redundant wording
one weak content angle
less elegant rationale
```

---

# 38. Production Gate

A prompt/model version must not be promoted if Golden Brand has:

```text
any critical regression
OR
2+ major regressions
```

Preferred:

```text
zero critical
zero major
```

---

# 39. Model Comparison

When comparing Model A vs Model B:

Do not ask only:

```text
which sounds better?
```

Compare separately:

```text
business specificity
evidence discipline
audience distinctness
brand preservation
cross-audience synthesis
managerial usefulness
```

---

# 40. Cost Does Not Win Over Semantic Failure

If cheaper model:

```text
passes structure
but loses strategic quality
```

it should not replace stronger model for high-value semantic tasks.

Audience generation and envelope synthesis are low-frequency, high-impact operations.

---

# 41. Deterministic Evaluation vs Semantic Evaluation

Use deterministic checks for:

```text
schema
enum validity
array caps
known offer references
known evidence references
IDs absent
authority fields absent
segment count
```

Use semantic evaluator for:

```text
distinctness
specificity
managerial usefulness
brand preservation
trade-off resolution
generic AI detection
```

---

# 42. Semantic Evaluator Must Not Reward Eloquence

Evaluation should explicitly ignore:

```text
beautiful prose
verbosity
marketing language
creative naming
```

unless it improves decision usefulness.

A shorter but sharper output should beat a polished generic one.

---

# 43. Evaluation Output Contract

Conceptual:

```ts
type GoldenEvaluationResult = {
  readonly caseId: string
  readonly component:
    | "audienceHypothesis"
    | "audienceLandscape"
    | "communicationProfile"
    | "communicationEnvelope"

  readonly passed: boolean

  readonly scores: {
    readonly distinctness?: 0 | 1 | 2
    readonly businessSpecificity?: 0 | 1 | 2
    readonly evidenceDiscipline?: 0 | 1 | 2
    readonly managerialUsefulness?: 0 | 1 | 2
    readonly founderImpact?: 0 | 1 | 2
    readonly profileDifferentiation?: 0 | 1 | 2
    readonly brandPreservation?: 0 | 1 | 2
    readonly tradeoffResolution?: 0 | 1 | 2
    readonly envelopeUsefulness?: 0 | 1 | 2
  }

  readonly regressions: readonly {
    readonly category: string
    readonly severity: "critical" | "major" | "minor"
    readonly explanation: string
  }[]

  readonly summary: string
}
```

---

# 44. Golden Evaluation Is Not Runtime Logic

This evaluator belongs to:

```text
tests / evals
```

not production decision flow.

Runtime Operator does not consult Golden Brand.

Golden Brand exists only to protect product quality.

---

# 45. Snapshot Storage

For each approved model/prompt version store:

```text
input fixture
raw structured output
normalized output
evaluation result
model identifier
prompt version
timestamp
```

This allows longitudinal comparison.

---

# 46. Golden Baseline

First manually approved baseline should be based on the Total Charm Dent reasoning quality we already established.

The baseline should not freeze exact wording.

Instead freeze:

```text
semantic expectations
quality thresholds
hard fail rules
```

---

# 47. Adding More Golden Brands

Total Charm Dent alone is not enough permanently.

Later add brands with different reasoning challenges:

```text
B2B professional service
retail/ecommerce
restaurant/hospitality
education
local service
high-frequency low-consideration product
```

But v1 should begin with one strong Golden Brand rather than six weak fixtures.

---

# 48. Why Total Charm Dent Is a Good First Case

It tests:

```text
high-trust purchase
complex decision
multiple services
existing-customer relationship
professional communication
high need for proof
risk of generic healthcare marketing
need for cross-audience communication
```

Therefore it exercises many of the exact capabilities Social Operator needs.

---

# 49. Human Review Requirement

Before changing production prompt/model for Audience or Envelope:

```text
automated evaluation
+
human review of Golden Brand output
```

Human reviewer should answer:

> Would I trust this Operator to manage this brand?

If no:

production gate fails, even if schema and automated score pass.

---

# 50. Final Golden Question

The most important final evaluation is:

> Does this output look like the work of an experienced social-media manager who understands why each decision exists?

If instead it looks like:

> an AI filling a marketing framework,

the run fails.

---

# 51. v1 PASS Definition

Total Charm Dent Golden Brand passes only when:

```text
Audience Segments are distinct and business-specific
+
Evidence and assumptions remain separated
+
Founder feedback authority is preserved
+
Communication Profiles adapt without fragmenting Brand Voice
+
Communication Envelope resolves real cross-audience trade-offs
+
Output materially improves downstream planning
+
No critical regression exists
```

---

# 52. Final Product Principle

Golden Brand testing protects one thing:

> Social Operator must become more useful as it evolves, not merely more complicated.

A new model, larger prompt or more features are improvements only if they produce better managerial decisions.