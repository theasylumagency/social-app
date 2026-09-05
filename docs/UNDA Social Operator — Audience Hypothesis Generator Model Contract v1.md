# UNDA Social Operator — Audience Hypothesis Generator Model Contract v1

## 0. Purpose

Audience Hypothesis Generator არის semantic reasoning component, რომლის ამოცანაა არსებული ბიზნესის ცოდნის საფუძველზე შემოგვთავაზოს:

> ამ ბიზნესისთვის რომელი განსხვავებული audience buying situations შეიძლება იყოს მნიშვნელოვანი?

იგი არ განსაზღვრავს საბოლოო truth-ს.

იგი ქმნის **structured proposals**, რომელსაც application:

1. ამოწმებს;
2. უკავშირებს provenance-ს;
3. უქმნის application-owned ID-ებს;
4. ინახავს `AudienceHypothesis` state-ად.

Canonical flow:

```text
Compiled Business Context
↓
Audience Hypothesis Generator
↓
Structured Model Proposal
↓
Application Validation
↓
Application-generated IDs
↓
Persisted AudienceHypotheses
↓
Founder Audience Review
```

---

# 1. Model Responsibility

Model owns:

```text
semantic segmentation
buying-situation reasoning
need inference
barrier inference
decision-stage classification
short rationale
assumption identification
qualitative confidence proposal
```

Model does **not** own:

```text
IDs
BrandId
timestamps
lifecycle
persistence
founder stance
operational influence
Audience Landscape version
Communication Envelope
Weekly audience selection
```

---

# 2. Core Question

The model answers:

> Given what is currently known about this business, what distinct audience situations are sufficiently plausible and useful for social communication planning?

Not:

> Who is the ideal customer?

Not:

> Create marketing personas.

Not:

> Give us demographic target audiences.

---

# 3. Main Segmentation Principle

The preferred segmentation unit is:

```text
distinct buying / decision situation
```

Prioritize differences in:

```text
problem awareness
decision readiness
relationship to the brand
purchase role
need
barrier
relevant offer
```

Demographics are secondary and may only appear if supported by provided context.

---

# 4. Input Contract

Conceptually:

```ts
type AudienceHypothesisModelInput = {
  readonly business: {
    readonly name: string
    readonly industry?: string
    readonly description?: string
    readonly geography?: readonly string[]
    readonly businessModel?: string
  }

  readonly offers: readonly {
    readonly name: string
    readonly description?: string
    readonly priority?: "primary" | "secondary"
  }[]

  readonly positioning?: {
    readonly corePosition?: string
    readonly differentiators?: readonly string[]
    readonly valuePropositions?: readonly string[]
  }

  readonly voice?: {
    readonly primaryTone?: readonly string[]
  }

  readonly businessContext?: {
    readonly pricingContext?: string
    readonly purchaseCharacteristics?: readonly string[]
    readonly knownDecisionFactors?: readonly string[]
  }

  readonly evidenceSummary: readonly {
    readonly evidenceKey: string
    readonly statement: string
    readonly strength: "weak" | "medium" | "strong"
  }[]

  readonly existingAudienceSignals?: readonly {
    readonly statement: string
    readonly evidenceKey?: string
  }[]

  readonly constraints?: readonly string[]

  readonly locale: "ka" | "en"
}
```

---

# 5. Compiled Input Only

Model არ იღებს:

```text
raw Evidence graph
raw HTML
complete website pages
SourceSnapshots
EvidenceRouting objects
conflicts unrelated to audience
full Brand Brain dump
```

Application აკეთებს task-specific compilation-ს.

Generator იღებს მხოლოდ audience reasoning-ისთვის საჭირო context-ს.

---

# 6. Evidence Keys

Model input-ში raw `EvidenceId`-ების ნაცვლად შეიძლება მიიღოს run-local opaque keys:

```text
e1
e2
e3
...
```

Model output-ში შეუძლია მიუთითოს მხოლოდ ეს keys.

Application შემდეგ resolve-ავს მათ ნამდვილ `EvidenceId`-ებად.

ამით:

- მოდელი ვერ იგონებს persistent ID-ს;
- validation მარტივდება;
- provenance მაინც შენარჩუნებულია.

---

# 7. Output Contract

Model output:

```ts
type AudienceHypothesisModelOutput = {
  readonly segments: readonly AudienceHypothesisProposal[]
}

type AudienceHypothesisProposal = {
  readonly name: string

  readonly buyingSituation: string
  readonly currentNeed: string

  readonly relevantOffers: readonly string[]

  readonly mainQuestions: readonly string[]
  readonly likelyBarriers: readonly string[]

  readonly decisionStage:
    | "unaware"
    | "problemAware"
    | "solutionAware"
    | "providerComparison"
    | "decisionReady"
    | "existingCustomer"
    | "returningCustomer"

  readonly evidenceKeys: readonly string[]

  readonly rationale: string
  readonly assumptions: readonly string[]

  readonly confidenceBand:
    | "tentative"
    | "reasonable"
    | "strong"
}
```

No additional top-level prose.

No IDs.

No timestamps.

No lifecycle.

---

# 8. Segment Count

Default:

```text
2–4 segments
```

Allowed:

```text
1 segment
```

თუ ბიზნესის კონტექსტი ძალიან ვიწროა.

Maximum:

```text
5 segments
```

მხოლოდ მაშინ, როცა ხუთივე materially distinct buying situation-ია.

Model არ უნდა ცდილობდეს quota-ს შევსებას.

---

# 9. Segment Distinctness Rule

ორი segment არ უნდა განსხვავდებოდეს მხოლოდ ზედაპირული ნიშნით.

Bad:

```text
Young customers
Older customers
```

თუ განსხვავებული need/decision context არ გვაქვს.

Bad:

```text
People interested in implants
People interested in veneers
```

თუ რეალური განსხვავება მხოლოდ product category-ია.

Better:

```text
People who already know they need treatment and are comparing providers

People who notice a problem but have not yet decided what treatment they need
```

---

# 10. No Decorative Personas

The model must not invent:

```text
names
ages
professions
income bands
hobbies
lifestyle
family status
media habits
```

unless explicitly supported by input evidence.

Bad:

> Nino, 38, works in finance and values premium service.

Good:

> მომხმარებელი, რომელმაც უკვე იცის რომ მკურნალობა სჭირდება და ახლა კლინიკებს ადარებს.

---

# 11. `name`

Requirements:

- human-readable;
- functional;
- describes the situation;
- not marketing jargon;
- not cute persona naming.

Preferred:

```text
გადაწყვეტილებასთან ახლოს მყოფი მომხმარებელი
```

Avoid:

```text
Premium Seeker
Quality Lover
Modern Explorer
```

---

# 12. `buyingSituation`

Must describe:

```text
what the person currently knows
what decision they are facing
where they are in the process
```

Example:

> უკვე იცის, რომ კონკრეტული მკურნალობა სჭირდება და ახლა არჩევს კლინიკას ან ექიმს.

---

# 13. `currentNeed`

This means:

> what does this audience need from communication right now?

Examples:

```text
understand the problem
understand available options
reduce uncertainty
compare providers
validate a decision
remember to continue treatment
```

Do not describe business goals here.

---

# 14. `relevantOffers`

Must reference only known offers supplied in model input.

The model cannot invent:

```text
new products
new services
discounts
packages
campaigns
```

Application validation rejects unknown offer references.

---

# 15. `mainQuestions`

Questions should represent genuine decision questions.

Good:

```text
როდის არის მკურნალობა საჭირო?
რა განსხვავებაა ვარიანტებს შორის?
როგორ ავირჩიო კლინიკა?
რა უნდა ვიცოდე პროცედურის დაწყებამდე?
```

Avoid generic:

```text
რატომ უნდა აგირჩიოთ თქვენ?
```

unless the buying situation genuinely supports provider comparison.

---

# 16. `likelyBarriers`

Barrier means a reason why a person may delay, avoid or struggle with a relevant decision.

Examples:

```text
uncertainty
risk perception
price uncertainty
fear
lack of trust
complexity
inertia
comparison difficulty
```

Model should not assume sensitive psychological traits without evidence.

---

# 17. `decisionStage`

The stage describes the current audience situation.

Use the closest allowed value.

Do not invent new enum values.

If uncertain between adjacent stages, choose the more conservative stage and mention uncertainty in assumptions.

---

# 18. `evidenceKeys`

Every segment should normally reference at least one evidence key.

However:

A segment may have:

```text
evidenceKeys: []
```

only when:

- it is a useful business-category hypothesis;
- the lack of direct evidence is explicit in `assumptions`;
- `confidenceBand` is `tentative`.

This prevents fabricated provenance.

---

# 19. `rationale`

Rationale is **not chain-of-thought**.

It is a concise user-safe explanation:

> რატომ შემოგვთავაზა Operator-მა ეს სეგმენტი?

Example:

> კლინიკა სთავაზობს რამდენიმე მაღალი ჩართულობის მკურნალობას, სადაც მომხმარებელს ჩვეულებრივ სჭირდება არჩევანის შედარება და ნდობის ჩამოყალიბება.

Rationale should typically be 1–3 sentences.

---

# 20. `assumptions`

Assumptions explicitly separate:

```text
what we know
from
what we are inferring
```

Example:

> პირდაპირი მონაცემი კლინიკების შედარების ქცევაზე ჯერ არ გვაქვს; provider comparison inferred არის მომსახურების ტიპიდან და purchase risk-იდან.

This field must not be empty merely to make output look confident.

---

# 21. `confidenceBand`

The model proposes only:

```text
strong
reasonable
tentative
```

### Strong

Use only when:

- multiple relevant input signals support the segment;
- buying situation is directly or strongly implied.

### Reasonable

Use when:

- the segment is a credible inference from business/offer structure;
- some assumptions remain.

### Tentative

Use when:

- useful to consider;
- evidence is limited;
- substantially inferred from category/context.

No percentages.

---

# 22. Confidence Is Not Authority

Model confidence does not determine persistence authority.

Application may accept a `tentative` hypothesis as internal working guidance.

Likewise `strong` does not make it confirmed truth.

All model-generated segments start as:

```text
origin = operator
lifecycle = active
```

unless application policy says otherwise.

---

# 23. Important Negative Instruction

The model must never answer:

> There is insufficient information to identify any audience.

unless essentially no usable business/offer context exists.

If the business is understandable but audience specifics are uncertain:

> generate cautious hypotheses.

This follows the principle:

> uncertainty should reduce specificity before it reduces operability.

---

# 24. Avoid Over-Segmentation

Model should merge segments when they have materially similar:

```text
need
buying situation
barriers
communication requirements
```

Different services alone do not justify different audience segments.

---

# 25. Avoid Universal Business Boilerplate

Reject generic segment sets such as:

```text
new customers
existing customers
potential customers
loyal customers
```

unless the model explains genuinely distinct buying situations for the specific business.

Output should fail Golden Brand evaluation if the same segments could be pasted onto almost any company.

---

# 26. Founder Knowledge Is Not Included in v1 Generation

For the initial generation call:

```text
Founder Stances
Founder-Provided Audiences
```

do not exist yet.

The model first proposes independently.

Then Founder reviews.

This prevents founder assumptions from contaminating the initial Operator assessment.

---

# 27. Application Validation

After model output, application validates:

### Structure

```text
segments is array
1–5 segments
all required fields present
enum values valid
```

### Length

Recommended caps:

```text
name <= 120 chars
buyingSituation <= 500
currentNeed <= 300
rationale <= 700

mainQuestions <= 6
likelyBarriers <= 6
relevantOffers <= known offer count
assumptions <= 6
evidenceKeys <= available evidence count
```

### References

```text
every evidenceKey exists in supplied input
every relevantOffer exists in supplied input
```

### Semantic duplicates

Application can perform deterministic normalization for exact/near-identical names.

True semantic duplication may require either:

- reject/retry; or
- later narrow semantic review.

Do not silently merge distinct model proposals via another uncontrolled model call.

---

# 28. Model Failure

Treat as invalid output if:

- JSON/structured output fails parsing;
- >5 segments;
- unknown enum value;
- invented evidence key;
- invented offer;
- required field missing;
- all segments are generic demographics;
- rationale is absent;
- model returns persistent IDs.

---

# 29. Retry Policy

At most:

```text
1 automatic repair/retry
```

Repair prompt receives only:

- validation failures;
- original valid input;
- invalid proposal.

It should correct structure or explicit contract violations.

Do not enter repeated self-rewrite loops.

---

# 30. Application Mutation Boundary

After successful validation:

```text
for each proposal:
  app generates AudienceHypothesisId
  app resolves evidenceKeys → EvidenceIds
  app assigns BrandId
  app assigns lifecycle
  app assigns timestamps
  app persists
```

Model output is never persisted as an authoritative object unchanged.

---

# 31. Suggested Model Prompt — System Contract

Conceptual prompt:

```text
You are the Audience Hypothesis Generator for a professional Social Operator.

Your job is to identify a small number of distinct, useful audience buying or
decision situations from the business context provided.

You are not creating marketing personas.
Do not invent demographics, lifestyles, income, occupations or interests unless
they are directly supported by the supplied information.

Prefer segmentation by:
- problem awareness
- decision readiness
- relationship to the brand
- purchase role
- need
- barrier
- relevant offer

Generate only materially distinct segments.
Usually return 2–4. Never exceed 5.

Every segment must clearly separate:
1. what is supported by the supplied information,
2. what is inferred,
3. how confident the inference should be.

Do not invent offers.
Do not invent evidence references.
Do not generate IDs, timestamps, lifecycle state, founder feedback,
operational weights or communication strategy.

If information is uncertain, reduce specificity rather than refusing to operate.

Return only the requested structured output.
```

---

# 32. Task Instruction

Conceptual task prompt:

```text
Analyze the supplied business context and propose the smallest useful set of
distinct audience situations for organic social communication planning.

The segments should help a senior social-media manager decide:
- what audiences may matter,
- what situation each audience is in,
- what they need to understand,
- what may block their decision.

Do not yet recommend content, tone, posting strategy, ads or targeting.
```

---

# 33. What This Generator Does Not Produce

Explicitly out of scope:

```text
Communication Envelope
Brand Voice
post ideas
weekly strategy
content pillars
ad targeting
Meta interests
age ranges
lookalike audiences
campaign objectives
CTA recommendations
content format recommendations
```

Those belong downstream.

---

# 34. Total Charm Dent — Golden Brand Expected Shape

The Golden Brand test should not require exact wording.

It should require semantic qualities.

For Total Charm Dent, a good run should recognize several meaningfully different situations roughly equivalent to:

```text
A. already knows treatment is needed / comparing options or providers

B. has a problem or concern but has not yet decided what action is needed

C. existing or returning patient with continuation / prevention context

D. decision-maker for another person, if sufficiently supported or reasonably
   inferred
```

The model may produce 3 rather than 4 if its reasoning is coherent.

Exact segment names are not part of the test.

---

# 35. Golden Brand Failure Examples

Fail if output is mainly:

```text
Women 25–45
Men 30–50
People interested in health
High-income Tbilisi residents
People who like premium services
```

without evidence.

Fail if:

```text
Implant audience
Veneer audience
Orthodontics audience
Cleaning audience
```

is merely a copy of the service catalog.

Fail if all rationales are generic:

> This audience may need dental services.

---

# 36. Golden Brand Quality Questions

Evaluator asks:

### Distinctness

> Are these genuinely different decision situations?

### Specificity

> Could these segments belong to almost any business?

### Evidence discipline

> Did the model invent facts?

### Usefulness

> Could Weekly Planner make better decisions because these segments exist?

### Founder impact

> Would a knowledgeable founder recognize a meaningful interpretation of the business rather than AI-generated marketing filler?

---

# 37. Model-Agnostic Contract

The contract should not depend on:

```text
Claude-specific features
OpenAI-specific features
Gemini-specific features
```

Provider adapter is infrastructure.

Domain/application sees only:

```text
AudienceHypothesisModelInput
→
AudienceHypothesisModelOutput
```

This lets us benchmark several strong models against the same Golden Brand cases.

---

# 38. Model Selection Principle

Audience generation is a relatively infrequent, high-value semantic task.

Therefore preference should be:

```text
quality > lowest token cost
```

It runs:

- during initial Brand Brain build;
- after material brand/offer changes when audience assumptions are affected;
- not on every post;
- not on every weekly cycle.

A stronger model is justified here.

---

# 39. Refresh Principle

Do not regenerate audience hypotheses simply because:

```text
a source refresh occurred
a post was published
a metric changed
a new week started
```

Regenerate/reconcile only when materially relevant business knowledge changes.

Examples:

```text
new major service
new market/geography
material positioning change
new business model
founder adds a materially different audience
strong repeated performance evidence creates tension
```

---

# 40. Final Invariant

Audience Hypothesis Generator should behave like:

> a senior strategist forming cautious, useful customer hypotheses from incomplete business information.

Not like:

> a persona generator filling a marketing template.

Its success is not measured by how many segments it produces.

Its success is measured by whether downstream planning becomes more intelligent without pretending uncertain assumptions are facts.