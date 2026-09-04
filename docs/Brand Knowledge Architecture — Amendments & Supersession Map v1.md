# Brand Knowledge Architecture — Amendments & Supersession Map v1

## 0. Purpose

This document records every architectural correction introduced during the Consolidation Pass.

It exists to prevent older specifications from remaining accidentally authoritative.

Rule:

> If this document conflicts with an earlier specification, this document takes precedence.

This is not a new architectural layer.

It is the canonical migration map from the previously written specs to the consolidated architecture.

---

# 1. Authority Order

Until the documents themselves are rewritten, use this precedence:

```text
1. Amendments & Supersession Map v1
2. Brand Knowledge Architecture — Consolidation Pass v1
3. Later component specs
4. Earlier foundation specs
5. Deprecated prompt contracts
```

Eventually the amendments should be folded into the source documents and this precedence layer can disappear.

---

# 2. Global Architecture Correction

Old conceptual tendency:

```text
Source
→ Evidence already tied to Brand Brain
→ Synthesis
```

New canonical architecture:

```text
Source
→ SourceSnapshot
→ Evidence
→ Normalize / Route
→ Knowledge / Proof / Business Fact destinations
```

This separation is authoritative.

---

# 3. Evidence & Provenance Model — Amendment

## OLD

Evidence contains:

```ts
pathCandidates: KnowledgePath[]
```

and possibly normalized values closely tied to canonical schema.

## NEW

Remove `pathCandidates` from immutable Evidence.

Canonical Evidence becomes schema-independent:

```ts
type Evidence = {
  id: EvidenceId

  brandId: BrandId
  snapshotId: SourceSnapshotId

  type: EvidenceType

  sourceClaimMode:
    | "explicit"
    | "implicit"
    | "derived"

  value: unknown

  evidenceStrength:
    | "weak"
    | "medium"
    | "strong"

  excerpt?: string
  locator?: ArtifactLocator

  temporalMetadata?: TemporalEvidenceMetadata

  independenceGroupId?: string

  lineage?: EvidenceLineage
}
```

---

# 4. New Derived Type — EvidenceTarget

Add:

```ts
type EvidenceTarget =
  | {
      kind: "knowledgePath"
      path: KnowledgePath
    }
  | {
      kind: "proofCandidate"
      proofType: ProofType
    }
  | {
      kind: "businessFact"
      factType: BusinessFactType
    }
  | {
      kind: "corpusSignal"
      signalType: CorpusPatternType
    }
  | {
      kind: "unmapped"
    }
```

---

# 5. New Derived Type — EvidenceRouting

Add:

```ts
type EvidenceRouting = {
  evidenceId: EvidenceId

  routingVersion: string

  targets: Array<{
    target: EvidenceTarget

    support:
      | "direct"
      | "supporting"
      | "weak"
  }>
}
```

Important:

`EvidenceRouting` is derived and re-computable.

`Evidence` remains immutable.

---

# 6. Evidence Routing Versioning

Routing must record:

```text
routingVersion
```

because:

- KnowledgePath registry may change;
- Proof schema may evolve;
- BusinessFact destinations may be added;
- routing logic may improve.

Evidence should not need re-extraction merely because routing changes.

---

# 7. Evidence Normalization Correction

General `normalizedValue` should not be an extractor-owned semantic responsibility.

Normalization belongs to:

```text
Evidence Normalizer / Router
```

Exception:

Deterministic structured adapters may directly normalize unambiguous primitive values.

Examples:

```text
currency
date
numeric amount
canonical URL
language code
```

---

# 8. Source Extractor v2 — Amendment

## REMOVE

From core extractor input:

```ts
allowedPaths: KnowledgePath[]
```

## REPLACE WITH

```ts
type ExtractionProfile = {
  semanticDomains: Array<
    | "identity"
    | "offer"
    | "audience"
    | "positioning"
    | "voice"
    | "content"
    | "proof"
    | "constraints"
    | "visual"
    | "businessFacts"
  >
}
```

---

# 9. Source Extractor v2 — Output Amendment

## OLD

```ts
ExtractedEvidenceProposal {
  ...
  normalizedValue?
  pathCandidates
  semanticKey?
}
```

## NEW

Prefer:

```ts
type ExtractedEvidenceProposal = {
  localRef: string

  type:
    | "fact"
    | "claim"
    | "observation"
    | "inference"

  sourceClaimMode:
    | "explicit"
    | "implicit"
    | "derived"

  value: unknown

  evidenceStrength:
    | "weak"
    | "medium"
    | "strong"

  excerpt?: string
  locator?: ArtifactLocator

  temporalMetadata?: TemporalEvidenceMetadata

  semanticHints?: string[]
}
```

`semanticHints` are optional non-authoritative hints.

No canonical target path is created here.

---

# 10. Source Extractor Responsibility — Final Form

Canonical responsibility:

```text
SourceSnapshot
→ minimal semantic Evidence
```

Not:

```text
SourceSnapshot
→ Brand Brain proposals
```

Not:

```text
SourceSnapshot
→ Proof objects
```

Not:

```text
SourceSnapshot
→ BusinessFact objects
```

---

# 11. New Stage — Evidence Normalizer / Router

Insert after Evidence persistence:

```text
Evidence
→ Evidence Normalizer / Router
→ EvidenceRouting
```

Responsibilities:

- semantic equivalence;
- taxonomy normalization;
- entity canonicalization;
- target-domain routing;
- duplicate semantic grouping.

---

# 12. Runtime Simplification for Normalizer / Router

Conceptually separate responsibilities do not require two independent model calls.

v1 may implement one component:

```text
EvidenceSemanticReducer
```

with deterministic fast paths and semantic fallback.

---

# 13. Corpus Pattern Extractor v1 — Amendment

## REMOVE

Persistent:

```ts
pathCandidates: EvidencePathCandidate[]
```

from the core `CorpusPattern`.

CorpusPattern should remain observational and schema-light.

---

# 14. Revised CorpusPattern Core

```ts
type CorpusPattern = {
  id: string

  type: CorpusPatternType

  value: unknown

  evidenceStrength:
    | "weak"
    | "medium"
    | "strong"

  corpusId: string

  temporalCharacter:
    | "stable"
    | "recentShift"
    | "campaignBound"
    | "mixed"
    | "unclear"

  metrics?: Record<string, number>
}
```

Routing into:

```text
voice
content
visualIdentity
LearnedPreference
```

happens later.

---

# 15. Corpus Pattern Routing

Corpus Pattern routing may use the same general routing infrastructure or a parallel lightweight mapper.

Do not force CorpusPattern itself to know canonical Brand Brain schema.

---

# 16. Orchestration Spec v1 — Major Amendment

## OLD

Mandatory:

```text
first synthesis
→ hypothesis generation
→ second synthesis
```

## NEW

Default:

```text
first synthesis
→ gap
→ hypothesis generation
→ deterministic hypothesis activation
```

No mandatory second synthesis.

---

# 17. Targeted Dependent Synthesis

A second synthesis is allowed only when an activated hypothesis affects another explicitly registered dependent path.

Example:

```text
audience.need hypothesis
→ may inform content pillar
```

Then:

```text
targeted dependent synthesis
```

only.

---

# 18. Corrected Initial Build Orchestration

Canonical sequence:

```text
1. Source ingestion
2. Snapshot creation
3. Source extraction
4. Evidence persistence
5. Evidence normalization / routing
6. Corpus item classification where applicable
7. Deterministic corpus aggregation
8. Corpus pattern interpretation where needed
9. Scoped synthesis
10. Proposal validation/application
11. Candidate divergence discovery
12. Conflict detection only when unresolved
13. Gap analysis
14. Hypothesis generation only when eligible
15. Direct hypothesis activation where permitted
16. Priority computation
17. Review Model construction
18. Question eligibility / budget
19. Founder interaction where required
20. Structured apply / Answer Interpreter
21. Targeted reconciliation
22. MVB + Safe Operating Envelope
23. Optional summary prose
```

---

# 19. Knowledge Synthesizer v2 — Amendment

Synthesizer may consume:

```text
EvidenceRouting
EvidenceGroups
CorpusPatterns
```

rather than assuming all Evidence already has KnowledgePaths.

Its input should be pre-scoped by application.

---

# 20. Synthesizer Does Not Own Routing

If evidence destination itself is ambiguous:

resolve routing first.

Do not make Synthesizer simultaneously decide:

```text
what does this evidence mean?
+
where does it belong?
+
what canonical value should exist?
```

unless a deliberately scoped semantic fallback combines those steps.

---

# 21. Mutation Protocol — No Fundamental Change

The Mutation & Proposal Protocol remains authoritative.

Still:

```text
LLM proposes
→ app validates
→ reducer mutates
```

Persistent IDs remain application-generated.

Confirmed claims remain protected.

---

# 22. Proposal Vocabulary — Remains

Canonical mutation proposal vocabulary remains:

```text
proposeSet
proposeAdd
proposeDeactivate
proposeReplace
proposeContextualize
flagConflict
```

No generic JSON Patch.

---

# 23. Conflict Detector v2 — Confirmed Amendment

Conflict Detector is explicitly exception-only.

The application must pre-resolve:

```text
exact equality
canonical-key equality
known aliases
collection compatibility
temporal expiry
explicit contextual coexistence
deterministic precedence
```

before invoking it.

---

# 24. Conflict Detector Invocation Rule

Canonical condition:

```text
code cannot resolve
AND
difference matters
AND
semantic interpretation is required
```

Otherwise:

```text
skip
```

---

# 25. Hypothesis Generator v2 — Confirmed Amendment

Hypotheses do not require re-synthesis merely to become active.

Application may directly create:

```text
Hypothesis
+
hypothesis KnowledgeClaim
```

through normal mutation/state-transition rules.

---

# 26. Hypothesis Scope Remains Narrow

Continue enforcing:

```text
must know
useful to assume
safe to omit
```

Hypothesis Generator handles only:

```text
useful to assume
```

---

# 27. Founder Question Generator v2 — No Structural Change

Still:

```text
question selection = application
question wording = model
```

Question remains exception path.

---

# 28. Answer Interpreter v1 — No Structural Change

Still:

```text
structured answer
→ code

free text requiring semantics
→ Answer Interpreter
```

No `brand-brain-finalizer`.

---

# 29. `brand-brain-finalizer` — Deprecated

Delete from target architecture.

Its former responsibilities are distributed to:

```text
structured founder answer mapping
Answer Interpreter
FounderDecision creation
deterministic mutation
MVB evaluator
Safe Operating Envelope compiler
```

No replacement "finalizer model" should be introduced.

---

# 30. Review & Summary v2 — Amendment

Structured Review should be deterministic/application-built.

The LLM must not decide:

- which claims are visible;
- which claims are confirmable;
- Proof status;
- operating status;
- actions;
- issue priority.

---

# 31. Summary Model Becomes Optional

Canonical default:

```text
ReviewModel
→ deterministic presentation
```

Optional:

```text
ReviewModel
→ small prose summarizer
```

for polished copy.

Summary prose must be semantically closed over ReviewModel.

---

# 32. Review Confirmation Rule Remains

Only explicitly visible claims may be confirmed.

`Continue` means:

```text
continue
```

not:

```text
confirm everything
```

unless UI explicitly says otherwise.

---

# 33. Safe Operating Envelope — No Structural Reversal

The following remains authoritative:

> Uncertainty should reduce specificity before it reduces operability.

---

# 34. Safe Operating Envelope — Required Structure

Retain:

```ts
type SafeOperatingEnvelope = {
  status:
    | "ready"
    | "readyWithUncertainty"
    | "blocked"

  allowedContentModes: ContentMode[]

  blockedOperations: BlockedOperation[]

  blockedPaths: KnowledgePath[]

  proofRequiredPaths: KnowledgePath[]

  unresolvedButNonBlockingPaths: KnowledgePath[]

  fallbackStrategies: ActiveFallbackStrategy[]

  operatingNotes: OperatingNote[]
}
```

---

# 35. `readyWithUncertainty` — Canonical Normal State

Do not treat it as degraded failure.

It is a healthy operational state.

Unknown values do not automatically become questions or blockers.

---

# 36. Operator Defaults — Boundary Remains

Operator Defaults remain outside Brand Brain.

They answer:

```text
How should the system behave when brand-specific knowledge is insufficient?
```

They do not answer:

```text
What does this brand prefer?
```

---

# 37. Learned Preferences — Boundary Remains

Learned Preferences remain separate from Brand Brain.

Canonical distinction:

```text
Brand Brain
= what the brand is / intends / allows

Learned Preferences
= how the founder tends to prefer generated work

Operator Defaults
= system fallback behavior
```

---

# 38. Generation Context Compiler — No Structural Change

The Compiler remains deterministic and task-specific.

Writer receives:

```text
publicFacts
internalGuidance
constraints
Proof
audience
contentDirection
voice
fallbacks
relevant learned preferences
current instruction
```

Not raw knowledge governance state.

---

# 39. Writer v2 — No Structural Change

Writer remains:

```text
high creative freedom
low knowledge authority
```

It should not receive:

- confidence scores;
- conflicts;
- raw Evidence graph;
- unresolved authority decisions.

---

# 40. Claim Scanner — Major Amendment

Old mental model:

```text
lexical match
→ risky claim
→ violation
```

New canonical model:

```text
lexical/pattern match
→ detection signal
→ claim candidate
→ semantic/support validation
→ actual violation or no issue
```

---

# 41. New Type — ClaimDetectionSignal

Add:

```ts
type ClaimDetectionSignal = {
  type: ClaimSignalType

  span: string

  signalStrength:
    | "low"
    | "medium"
    | "high"

  source:
    | "lexical"
    | "pattern"
    | "structured"
    | "semantic"
}
```

---

# 42. Detection Strength ≠ Risk Severity

These are separate dimensions.

Example:

```text
"საუკეთესო"
```

may have:

```text
signalStrength = high
```

but after semantic analysis:

```text
no violation
```

or:

```text
high-severity unsupported superlative
```

depending context.

---

# 43. Georgian Matching — Mandatory Amendment

Exact string matching is insufficient.

Initial scanner must support:

```text
prefix/stem
regex
phrase
exact
```

matching.

---

# 44. Required Georgian Stem Families

Initial high-value families include:

```text
საუკეთესო*
ყველაზე*
ლიდერ*
ერთადერთ*
გარანტირებულ*
გარანტი*
უმტკივნეულ*
უფასო*
```

---

# 45. Required Comparative Patterns

Include:

```text
უფრო ... ვიდრე ...
-ზე უკეთეს*
ზე უკეთეს*
სხვებზე უკეთეს*
კონკურენტებზე უკეთეს*
```

---

# 46. Clinical Outcome Patterns

Include high inspection signals around:

```text
უმტკივნეულ*
ტკივილის გარეშე
გარანტირებულ შედეგ*
100%
შედეგ* + გარანტირ*
```

Additional clinical lexicon may evolve from production data.

---

# 47. Price Noise — Mandatory Amendment

The stem:

```text
ფას*
```

must not itself create a price claim violation.

Use it as:

```text
low signal
```

---

# 48. Price High Signals

Strong candidates include combinations/patterns such as:

```text
number + ₾
number + ლარ*
ლარიდან
ფასი იწყება + number
უფასო*
percentage + ფასდაკლება
```

---

# 49. Example — No Price Claim

```text
ფასების შესახებ დაგვიკავშირდით
```

Expected:

```text
possibly low signal
→ no structured price assertion
→ no violation
```

---

# 50. Example — Actual Price Claim

```text
კონსულტაცია იწყება 99 ლარიდან
```

Expected:

```text
structured price claim
amount = 99
currency = GEL
qualifier = from
```

Then Proof validation.

---

# 51. Scanner Noise Principle

Internal scanner false positives are acceptable.

User-visible false warnings are expensive.

Therefore:

```text
high recall internally
+
high precision at warning layer
```

is the target.

---

# 52. Generation Validator — Amendment

Validator should operate at claim level.

Do not produce global numeric safety scores.

Canonical outcomes remain:

```text
pass
repairable
requiresReview
blocked
```

---

# 53. Editorial Quality — New Required Layer

Add a separate:

```text
Editorial Quality Reviewer
```

This is not part of truth/safety validation.

---

# 54. Why It Is Required

A draft may be safe but:

```text
generic
boring
off-brand
weak
repetitive
poorly structured
```

Direct Publishing requires more than safety.

---

# 55. Quality Reviewer Responsibility

It answers:

> Is this good enough for this task and this brand?

It does not answer:

> Is this claim supported?

---

# 56. Editorial Quality Dimensions

Initial dimensions:

```text
taskFit
brandFidelity
specificity
nonGenericity
clarity
structure
channelFit
creativeStrength
CTAQuality
```

Not all dimensions apply to every task.

---

# 57. Editorial Quality Result

Add:

```ts
type EditorialQualityResult = {
  status:
    | "pass"
    | "revise"

  dimensions: Array<{
    dimension: EditorialQualityDimension

    rating:
      | "strong"
      | "acceptable"
      | "weak"

    note?: string
  }>

  issues: EditorialQualityIssue[]

  repairInstructions?: string[]
}
```

---

# 58. No Numeric Quality Score in v1

Do not use:

```text
82/100
```

Use semantic bands:

```text
strong
acceptable
weak
```

This avoids false precision.

---

# 59. Quality Reviewer Does Not Rewrite

It produces:

```text
issues
repair instructions
```

Writer performs repair.

This preserves role clarity.

---

# 60. Quality Reviewer Context

Give only:

```text
task
draft
compiled voice
relevant positioning
relevant audience
content direction
few reference examples
recent-content fingerprints when useful
```

No full Brand Brain.

---

# 61. Recent Content Repetition

Quality Review may use lightweight recent-content fingerprints.

Potential fields:

```ts
type RecentContentFingerprint = {
  contentId: string

  topicKey?: string
  hookKey?: string
  structureKey?: string

  normalizedSummary?: string
}
```

---

# 62. Recent Archive Must Stay Small

Do not send entire publication history.

Use:

```text
recent relevant examples
+
structured fingerprints
```

only.

---

# 63. Direct Publishing Quality Rule

For Direct Publishing:

```text
Safety pass alone is insufficient.
```

Require acceptable Editorial Quality.

This is now a canonical product invariant.

---

# 64. Review Mode Quality Rule

Quality Review may still run in Review Mode, but policy may use a lower threshold because human review remains available.

---

# 65. Draft / Exploration Mode

Quality Reviewer may be optional depending workflow.

---

# 66. Consolidated Repair Loop — New Canonical Flow

Avoid independent safety and quality rewrite loops.

Canonical:

```text
Writer
→ Safety Analysis
+
Quality Analysis
→ Validation/Quality Reducer
→ one consolidated repair brief
→ Writer repair
→ final checks
```

---

# 67. Repair Budget

Recommended:

```text
initial Writer call
+
maximum one automatic consolidated repair
```

If still unacceptable:

```text
requiresReview
or
blocked
```

depending reason.

---

# 68. Final Check After Repair

Always rerun:

```text
deterministic claim scanner
hard constraints
failed safety checks
```

Semantic quality re-review is conditional.

---

# 69. Safety Repair Must Not Destroy Quality

Repair instruction should preserve:

```text
tone
task intent
specificity
structure
```

where possible.

---

# 70. Quality Repair Must Not Create New Safety Risk

Quality Reviewer cannot request:

```text
make stronger claims
add urgency
add a number
say we are the best
```

unless context already permits them.

Repair stays inside GenerationContext.

---

# 71. Business Facts Boundary — New Formal Reservation

Add a lightweight `BusinessFacts` domain outside Brand Brain.

Initial candidates:

```text
prices
openingHours
contactDetails
availability
inventory
campaignTerms
teamSchedules
```

---

# 72. Do Not Overbuild Business Facts v1

No large generic database framework is required yet.

Implement only typed registries needed by Social Operator.

---

# 73. Price Belongs Outside Brand Brain

This correction is authoritative.

`offer.pricingContext` remains strategic:

```text
budget
value
midMarket
premium
luxury
quoteRequired
publicPricing
unknown
```

Actual prices belong to:

```text
BusinessFacts / Proof
```

---

# 74. Opening Hours / Contact Details

Likewise:

```text
openingHours
phone
email
```

are not Brand Brain strategic knowledge.

They belong in structured Business Facts / business profile data.

---

# 75. Availability

High-volatility availability belongs outside Brand Brain.

It may be task/publishing dependency.

---

# 76. Proof Remains Separate from Business Facts

Business Fact:

```text
consultation price = 99 GEL
```

Proof answers:

```text
what evidence allows this fact to be publicly asserted?
```

They may reference each other but are not identical objects.

---

# 77. Revised Knowledge Domains

Final conceptual domains:

```text
Brand Knowledge
Business Facts
Proof
Learned Preferences
Operator Defaults
Operator Policy
```

Do not collapse them.

---

# 78. Priority System — No Change

Keep one:

```text
priorityScore 0–100
priorityBand low|medium|high
```

Application-owned.

Do not create separate:

```text
conflictPriority
reviewPriority
questionPriority
refreshPriority
```

---

# 79. Confidence System — No Change

LLMs emit:

```text
evidenceStrength
semantic signals
```

Application computes numeric confidence.

---

# 80. Freshness System — No Change

Freshness remains separate from:

```text
epistemicStatus
confidence
```

---

# 81. Epistemic Status — No Change

Canonical:

```text
observed
inferred
hypothesis
confirmed
```

It represents provenance/origin.

It is not a maturity ladder.

---

# 82. No Status Graduation

Still prohibited:

```text
hypothesis automatically becomes inferred
inferred automatically becomes observed
observed automatically becomes confirmed
```

New provenance creates new claim/state.

---

# 83. Generation Permission — No Change

Canonical:

```text
internalGuidance
publicUse
publicUseWithProof
blocked
```

Application-derived.

---

# 84. MVB — Refined but Preserved

Still requires:

```text
usableOffer
contentLanguage
usableVoice
```

`usableVoice` may be satisfied by safe Operator Default where blueprint policy permits.

`usableOffer` cannot be invented by defaults.

`contentLanguage` requires actual authorization/knowledge.

---

# 85. Runtime Generation — Final Canonical Path

```text
Task
→ Capability Resolver
→ Task Safe Operating Envelope
→ Generation Context Compiler
→ Writer
→ Deterministic Claim Scan
→ Deterministic Quality Checks
→ Semantic validators/reviewer only where needed
→ Consolidated repair if needed
→ Final validation
→ Review / Publish
```

---

# 86. Runtime Knowledge Acquisition Prohibition

Generation must not trigger:

```text
Source Extractor
Corpus Pattern Extractor
Knowledge Synthesizer
Conflict Detector
Hypothesis Generator
```

merely because Writer wants more information.

Knowledge acquisition remains a separate workflow.

---

# 87. Refresh Path — Final Canonical Form

```text
Source change
→ Snapshot diff
→ changed extraction only
→ evidence normalization/routing
→ affected-path reconciliation
→ targeted synthesis if needed
→ conflict/hypothesis only if needed
→ deterministic mutation
→ affected derived-state recompute
```

---

# 88. Feedback Path — Final Canonical Form

```text
User action
→ FeedbackEvent
→ deterministic diff
→ semantic classification only where needed
→ LearnedPreference update
```

Strategic/factual tensions escalate to Review instead of silently becoming preferences.

---

# 89. Component Invocation Philosophy

### Frequent

```text
Source Extractor on changed unstructured sources
Generation Context Compiler
Writer
basic Claim Scanner
basic validators
```

### Sometimes

```text
Normalizer semantic fallback
Corpus Pattern semantic interpreter
Knowledge Synthesizer
Editorial Quality Reviewer
semantic Claim Matcher
```

### Rare

```text
Conflict Detector
Hypothesis Generator
Founder Question Generator
Answer Interpreter
```

---

# 90. Zero-Call Success

A mature brand refresh may need:

```text
zero semantic conflict calls
zero hypothesis calls
zero founder questions
```

This is desirable.

---

# 91. Component Naming Recommendation

Suggested stable conceptual names:

```text
SourceExtractor
EvidenceSemanticReducer
CorpusPatternExtractor
KnowledgeSynthesizer
ConflictDetector
HypothesisGenerator
FounderQuestionGenerator
AnswerInterpreter

CapabilityResolver
SafeOperatingEnvelopeCompiler
GenerationContextCompiler

Writer
ClaimScanner
GenerationValidator
EditorialQualityReviewer

FeedbackReducer
RefreshReconciler
```

Exact implementation names may differ.

---

# 92. Do Not Mirror Every Concept as a Service

Important:

```text
conceptual component
≠
network service
≠
model call
≠
class
```

Several conceptual responsibilities may live as small pure functions/modules.

This preserves system lightness.

---

# 93. `src/core` Ownership After Consolidation

`src/core` should own generic mechanisms:

```text
IDs/types
Evidence core
routing interfaces
KnowledgeClaim lifecycle
Mutation Protocol
confidence/freshness/priority
FounderDecision mechanics
Proof framework
Capability resolution
Safe Operating Envelope framework
GenerationContext core
validation interfaces
revision/audit infrastructure
```

It must know nothing about social-media semantics.

---

# 94. `src/blueprints/social` Ownership

Should own:

```text
Social KnowledgePath policies where operator-specific
Social extraction profiles
Social corpus pattern taxonomy/config
Social content modes
Social defaults
Social fallback policies
channel rules
Georgian claim lexicon
Social quality dimensions/config
Social task requirements
Social Writer prompt adapters
```

---

# 95. `app/` Ownership

Still:

```text
UI
API
interaction surfaces
```

No direct model/provider calls.

---

# 96. `worker/` Ownership

Still:

> the only place work executes.

Model/provider execution remains here.

---

# 97. Architecture Anti-Patterns Now Explicitly Forbidden

Do not build:

```text
one giant BrandBrainAgent
one giant Validator
one giant prompt containing all brand state
one full refresh per source change
one LLM call per rule
one questionnaire per unknown
one repair loop per reviewer
```

---

# 98. Architecture Success Shape

The implementation should look more like:

```text
typed registries
pure reducers
small scoped model contracts
incremental jobs
cached derived state
task-specific compilation
```

than:

```text
multi-agent orchestration theater
```

---

# 99. Documents Requiring Direct Edits Later

The following specs should eventually be revised in-place:

```text
Brand Knowledge Domain Model v1
Unified Types & Vocabulary Spec v1
Orchestration Spec v1
Evidence & Provenance Model v1
Source Extractor v2
Corpus Pattern Extractor v1
Knowledge Synthesizer v2
Generation Validator v1
```

Other specs need only minor cross-reference updates.

---

# 100. High-Priority In-Place Corrections

When consolidating actual files, fix first:

```text
1. Evidence.pathCandidates removal
2. EvidenceRouting addition
3. SourceExtractor allowedPaths removal
4. CorpusPattern pathCandidates removal
5. orchestration second-synthesis change
6. ClaimDetectionSignal addition
7. Georgian morphology rules
8. price signal severity rules
9. EditorialQualityReviewer addition
10. consolidated repair flow
```

These are the changes most likely to cause implementation divergence if left ambiguous.

---

# 101. Final Invariant

Every runtime component should answer one of four kinds of questions:

### Evidence

> What did the source/user behavior actually provide?

### Knowledge / Authority

> What does the system currently believe or authorize?

### Operation

> What can we safely and usefully do now?

### Creation / Evaluation

> What should we create, and is the result good enough?

A component that repeatedly answers questions from multiple categories is probably too broad.

---

# 102. Final Rule

The architecture is considered consolidated when:

```text
old specs no longer create alternative schemas,
Evidence is independent from destination schema,
ordinary workflows use deterministic fast paths,
semantic models appear only at ambiguity boundaries,
generation is both safe and editorially strong,
and uncertainty remains bounded without blocking useful work.
```

That is the canonical target architecture.