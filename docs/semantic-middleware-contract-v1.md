# UNDA Semantic Middleware Contract v1

**Status:** Documentation-only design proposal; no implementation or activation.  
**Scope:** UNDA Social Operator, current organic content/review workflow.  
**Design date:** 2026-10-03.  
**Primary source:** The current repository [Semantic Signal Utility Map v1](semantic-signal-utility-map-v1.md), the canonical version requested for this task. Source snapshot SHA-256: `bcb4e132b0cef9aabd600b18c42ec03d8c4ade0993cbd834be9dc5bbd9bb409d`. The older copy outside this repository is not the design authority.  
**Recommendation:** A small, proposition-scoped observation contract, consumer-specific projections, and a capability-gated hybrid interpretation experiment.

> Semantic middleware interprets what the text says and how propositions are structured. It does not decide truth, authority, support, permission, or publication outcome.

This document defines proposed information boundaries and a conceptual TypeScript schema. It changes no production code, prompts, routing, provider integration, benchmark, or policy. Ontology v2 remains a design reference, not an activated runtime dependency. The next-phase sequence at the end is a recommendation for a separately authorized task.

## 1. Fit into the actual pipeline

Preserve the Utility Map's sequence:

```text
structured values / deterministic candidates
→ bounded semantic interpretation where needed
→ proposition + attributes / bindings
→ authorized fact / eligible Proof / applicable constraint assessment
→ consolidated actionable issue, if warranted
→ existing repair / review / approval consequence
```

The [architecture amendments](Brand%20Knowledge%20Architecture%20%E2%80%94%20Amendments%20%26%20Supersession%20Map%20v1.md), sections 40–52, 66–76 and 85–86, separate scanner candidates, semantic/support validation, editorial quality, business facts, Proof and runtime knowledge acquisition. This proposal places interpretation between candidates and assessment; it does not combine semantic interpretation with support validation.

The inspected implementation establishes these limits:

- [Post context](../src/blueprints/social/weekly-planning/post-context.ts) supplies `publicFacts: []` and `eligibleProof: []`; brand guidance and style excerpts do not authorize public claims. The context is organic and has no campaign identity.
- [Post review](../src/application/weekly-planning/posts.ts) invokes safety and editorial review separately. [Post lifecycle](../src/blueprints/social/weekly-planning/posts.ts) consolidates actionable feedback, preserves the earlier draft and allows one automatic repair. Unresolved blocking issues remain approval blockers.
- [Scanner](../src/blueprints/social/validation.ts) produces lexical/pattern candidates. Its `guaranteed-result` and `only-today` candidates do not establish a clinical endpoint or booking capacity.
- [Domain validation](../src/core/domain/validation.ts) already has support-match and validation outcomes. `supported`, `unsupported`, `ambiguous`, `pass`, `repairable`, `requiresReview` and `blocked` belong to assessment/validation, never to this observation. Weekly issue severity uses a different `blocking` / `advisory` boundary; do not invent a direct enum conversion.

The fact/Proof matcher is a prospective consumer at these existing boundaries, not a connected authoritative feed in the current weekly context. Until approved records reach it, a specific invented or unsupported addition can be reviewed and repaired, but the middleware cannot certify or contradict it. Missing records remain missing support. Preserve existing whole-draft safety and editorial coverage, including claims outside the selected families.

## 2. The observation unit and identity

One `SemanticObservation` describes one independently negatable, attributable proposition, its activated claim families, and only the attributes needed by their consumers. It is not a sentence verdict. A sentence can yield several observations; one observation can carry several families.

Use an affirmative **relation kernel** in `normalizedProposition`, with denial carried separately in `polarity`. For example, normalize “No appointments are available” to “appointments are available” plus `negated`; never normalize it to a negated kernel and negate it again. Preserve the exact original text in source spans. A kernel is a matching aid, not a writer rewrite or a lossless substitute for the spans, time, attribution and qualifiers.

Split propositions when any of the following can vary independently:

- polarity, speaker/adoption, time state, service/entity, amount, or asserted relation;
- an outer report (“Nino said P”) and its embedded content P;
- two services with different prices, even if the second clause omits the verb.

Do not split one clinical comparison into a clinical observation and a comparative observation: it has one proposition and multiple families. Do not merge “discount applied last week” and “discount no longer applies” because their type and amount match. A shared amount may be recovered from a clear antecedent; an unstated service, branch or campaign may not.

`propositionId` is allocated by application code for an anchored proposition within an immutable source revision. It is stable across interpretations of the same reviewed decomposition, not a claim of identity across edited drafts. Use source revision, ordered span anchors and an application-assigned atom ordinal where anchors overlap; do not derive identity from model wording or labels. A repaired draft gets a new revision and fresh observations. `observationId` identifies the interpretation attempt of that proposition; alternate interpretations do not silently overwrite earlier ones.

Spans refer to exact customer-facing field revisions: caption, script, each on-screen text item and each frame heading/body. Use **Unicode code-point** offsets, start inclusive/end exclusive, with exact excerpt equality; do not confuse these with JavaScript UTF-16 offsets. A small array supports shared or discontinuous wording. Context excerpts used to resolve a reference have their own provenance refs; they are not silently added as asserted text. Image-contained claims need equivalent coverage before reliance; this proposal does not establish image inspection.

An unresolved candidate must remain in a separate interpretation work record. An empty observation list means only that no in-scope observations were returned; it is never a whole-draft safety result. Record which anchors/families were requested, interpreted, rejected as non-applicable, or left unresolved. Proposition discovery and classification are separate capabilities.

## 3. Field decisions and ownership

Ownership key: **S** = supplied structured, source-linked value; **D** = deterministic code/extraction; **J** = bounded Jev candidate interpretation, subject to demonstrated capability; **F** = stronger interpretation of a consequential unresolved task; **H** = human/source owner. These are preferred producers, not runtime routes added by this document.

“Structured bypass” applies when a typed rendering and its exact final text still agree. A structured tariff must not overwrite a different price actually written in free text: observe the copy's price, then let assessment compare it with the tariff. A model cannot turn an unapproved structured value into an authorized fact. Models never mint registry IDs, choose business authority or create Proof.

| Evaluated field / proposed representation | Need and named consumer | Presence | Preferred source; structured override/bypass |
| --- | --- | --- | --- |
| `observationId` | Reviewer/repair trace; distinguish interpretation attempts. | Required. | D only; never inferred or overridden by a model. |
| `sourceSpan` → `sourceSpans[]`, including source/revision IDs, offsets and excerpt | Safety, matching and Writer repair need the exact affected text; stale repairs must be rejected. | Required, nonempty. | D verifies bounds/excerpts. S rendering can supply anchors; J/F may nominate spans, never validate their own source equality. H can correct decomposition. |
| `propositionId` | All consumers join attributes and issues to the same atomic proposition. | Required. | D after anchored decomposition. S bypasses discovery in controlled templates. J/F/H may suggest atomic boundaries, not authoritative IDs. |
| `propositionText` / normalized proposition | Fact/Proof matcher needs the relation being asserted or denied. Safety needs a readable kernel. | Required slot; unresolved is allowed. Exact original text is already in spans, so no duplicate `propositionText`. | S/D for typed renderings; J for prose if capable, F for consequential ambiguity, H if still unresolved. Never fill an unstated endpoint. |
| `claimTypes[]` → `claims[].type` | Select only activated safety/matching checks. | Required collection of interpreted positive memberships; unresolved membership must be recorded separately. | S/D for controlled propositions; J/F for prose; H for unresolved interpretation. Derive `claimTypes[]` for a consumer; do not store a duplicate array. |
| `presentation` | Safety must distinguish an assertion from a question, hypothetical, example or instruction. | Required slot. | S bypass for typed quotation/example objects; otherwise J, then conditional F/H. This is proposition function, not punctuation or grammatical mood alone. |
| `polarity` | Every activated matcher/constraint consumer must assess the asserted or denied relation. | Required slot: affirmed/negated, or explicit unknown/unresolved. | S/D for typed state; J for unrestricted negation scope; conditional F/H. Never global text-level YES/NO. |
| `attribution.mode`, `adoption`, `chain[]` | Safety/source assessment distinguishes first-party assertion, reporting, quotation and textual adoption. | Required mode/adoption slots; chain conditional for attributed content. | S for exact linked quotation/report objects; J/F for open-text/nested framing; H for missing speaker/context. Structured speaker metadata cannot establish testimonial permission or truth. |
| `modality` | Clinical/outcome/guarantee assessment and Writer repair preserve hedging or explicit certainty. A matcher must not expand a possible benefit into a certain one. | Conditional when that distinction changes an activated assessment or repair. | S for exact qualified rendering; J for prose, conditional F/H. Do not infer categorical certainty from future tense. |
| `bindings[]`: role, mention, optional registry ID | Match/repair the right subject, service/item, branch/place, audience, comparator, holder or recipient. | Conditional; include a slot for every role a consumer needs, even if unknown. Multiple bindings may share a role. | S/D for supplied IDs and exact registry resolution; J/F for textual role/reference interpretation. Only D/S attaches registry IDs. H supplies missing subject/service/branch. |
| `time`: relation, expressions, period, relative reference | Offer, price, capacity and date consumers distinguish past/current/future and publication-relevant scope. | Conditional when stated or needed by the consumer; unknown is not “current.” | S/D for dates, references, timezone and date math. J/F identifies prose temporal role/scope. H supplies missing reference/period. |
| `qualifiers[]`: kind and exact text | Fact/Proof matching and repair retain starting-price, condition, eligibility, exception and measurement/scope restrictions. | Conditional when stated and material. Empty means no such qualifier was stated, not unrestricted permission. | S/D for typed terms and exact rendering; J/F attaches prose qualifier to its proposition. H supplies required missing terms. No model default. |
| Extracted arguments → typed `claims[]` payloads | Each family consumer needs only the slots in section 4. | Family object conditional on activation; its listed slots required, using explicit unknown/unresolved/N/A as necessary. | S/D for values and controlled relations; J/F only for contextual meaning/binding; H for unstated input. See per-payload ownership below. |
| Completeness reasons → `reasons[]` | Safety/Editorial/Writer identify only a material missing endpoint, baseline, basis or scope. | Conditional; absent/empty does not certify completeness. | D for required typed slots; J for contextual recoverability; conditional F/H. S can resolve a recoverable slot, but missing authoritative facts are an assessment issue. |
| `interpretation.status`, unresolved field paths, abstention reason | Internal orchestrator/reviewer keeps semantic abstention distinct from missing business support. | Required status; paths/reason conditional on partial/abstained result. | Interpreter can abstain; D also marks invalid/inconsistent responses unresolved. S bypass avoids an inference attempt. H may resolve supplied-text ambiguity. |
| `confidence[]`: target, measure, value, calibration reference | Internal evaluation/selective interpretation of a specific semantic decision. | Optional; omit when unavailable or unused. | Provider probability or explicitly tagged self-report; D associates calibration. Never invented for deterministic values. No structured “confidence=1” shortcut. |
| `provenance`: method, contract version, input/context refs, model/config refs, field origins | Audit/reproduction and evaluation need to know how the interpretation was obtained. | Required method/version; source/model/config/context refs conditional on their use; field origins conditional for mixed production. | D records actual S/D/J/F/H producers. Models cannot self-assert audit lineage. This is interpretation provenance, not proof of the claim. |

The profile supplied by the caller names activated consumers, allowed families and required binding/argument fields. It contains no new permission or publication rule. Omitted optional fields mean **not requested/not emitted**; consumers must request a needed slot rather than treat omission as known, N/A or “no restriction.”

## 4. Runtime families and minimum payloads

The following is a proposed runtime vocabulary derived from Utility Map consumer needs. Runtime names are not a migration of benchmark identifiers or an activation of the ontology. All family checks share proposition polarity, attribution, applicable modality, bindings, qualifiers and time.

In the table, a named payload slot is required whenever its family is emitted, but its value may legitimately be unknown or unresolved. Conditional slots are explicitly marked. Arguments identify stated meaning, not authorized facts. Keep values as exact normalized decimal strings plus units; deterministic code owns arithmetic.

| Utility Map family → runtime representation | Admission and consumer/action | Minimum useful arguments, with slot requirements | Preferred ownership / structured bypass |
| --- | --- | --- | --- |
| Price → `price` | Core where price copy is possible. Safety now; scoped tariff matching when records exist. | Amount, currency, price basis (`exact`/`starting`/`range`); upper amount conditional for a range. Service/item binding required by matcher. Time/conditions only as relevant. | S/D parses amount/currency and controlled price basis; J/F interprets basis/service/time in prose. H supplies unstated currency/service. Starting price cannot be matched as a fixed price. |
| Discount → `discount` | Core for offer copy; assess amount, terms and stated active/end state. | Reduction as quantity/unit; service/item binding. Stated conditions/eligibility in qualifiers; period in time. Unknown terms stay missing, not “everyone/always.” | S/D for typed reductions, terms and calendar math; J/F for denial, expiry, conditional scope and binding; H for missing offer terms. No campaign ID inference. |
| Comparative → `comparison` | Core for material differences/rankings; Safety/Proof matcher assesses actual comparator and basis. | Attribute, direction, baseline, basis. Magnitude conditional if stated. Subject binding; comparator binding only if useful for entity matching. | S/D for typed comparisons/number extraction; J/F for relation/baseline recoverability. H supplies an absent permitted baseline/basis; a model cannot. |
| Superlative → `comparison.ranking` | Useful subtype of comparison; same consumer and one consolidated issue. | Ranking position and comparison class, with comparison basis above. Conditional subtype only for an actual ranking. | J/F distinguishes ranking from idiom; S/D bypass for exact controlled ranking. No separate call or top-level `superlative` family. |
| Guarantee → `guarantee` | Core; Safety applies an existing warranty/assurance constraint. Denials retain type. | Object and kind (`warranty`/`outcomeAssurance`/`absoluteCertainty`); endpoint may remain unknown. | S/D for controlled warranty text; J/F for object, certainty and denial scope. H for required unstated object/terms. A denied guarantee is not an offered guarantee. |
| Outcome promise → `outcomePromise` | Core when future audience benefits are asserted/promised. Safety checks allowed promise/support. | Outcome; affected audience/subject binding where required. Modality and temporal relation if applicable. | J/F interprets audience result, not every future business fact. S bypass for exact supplied promise wording; H supplies missing authorized endpoint. |
| Clinical outcome → `clinicalOutcome` | Core only for relevant health tasks/domain. Safety applies scoped clinical constraint/Proof assessment. | Outcome, affected subject/audience binding when needed; modality; time relation if stated. | J/F for health-result meaning; S bypass for exact typed text. Unnamed “difference/result” cannot be assigned a clinical endpoint. |
| Availability → `availability` | Core when copy asserts bookability/service capacity. Safety now; fresh capacity matcher later. | Resource (a service/resource binding ID). Available/unavailable projection is derived from the affirmative availability kernel and polarity; time and branch as needed. | S/D for controlled capacity state and snapshot matching; J/F for prose status/resource/time. H supplies absent capacity records. No inferred numeric zero. |
| Contact detail → `contactDestination` | Core when a business contact destination is offered. Registry/safety consumer needs its role, not a general “contact claim” classifier. | Kind (phone/email/URL/handle), destination, purpose; business/branch binding when applicable. | D extracts/normalizes exact endpoint; S/D matches approved registry. J/F only for unresolved contact role or attribution. Syntax/reachability never proves ownership. |
| Quantified claim → `quantity` | Targeted extension for a distinct uncovered numeric fact/Proof check. | Quantity and measured attribute; subject, population/time qualifiers as needed. | D for values/units/arithmetic; J/F for what the quantity measures; H for missing scope. Do not add this object merely to duplicate a fully covered price/reduction/comparison magnitude. |
| Opening hours → `openingHours` | Conditional when hours are stated and safety or an enabled hours matcher consumes them. | Stated schedule; branch binding and relevant exception/timezone. | S/D for schedule records and canonical rendering; J/F for prose role/exception binding. Specific operational schedule parsing can be a deterministic consumer DTO; no temporal engine here. |
| Address/location → `location` | Conditional for customer branch, service-place or service-area facts. | Place and role (`branchAddress`/`serviceArea`/`serviceLocation`); branch/entity binding if relevant. | S/D for approved IDs/address normalization; J/F distinguishes incidental place from service location. H supplies absent location/coverage. No geocoding integration. |
| External statistic → `externalStatistic` | Conditional when a material public-world statistic requires source/Proof review. | Quantity, measure, population and stated source; period in time where relevant. | D extracts numeric values; J/F interprets externality, population and source scope. H supplies the actual source. No research/fact retrieval is implied. |
| Attribution → attribute + `report` for an outer reporting proposition | Attribution is always available as an attribute. `report` is conditional for a quote/testimonial/source workflow whose consumer checks that “speaker said P.” | Report source and linked embedded proposition IDs; embedded observations retain their own type, chain and adoption. | S for exact linked quote objects; J/F for scope/adoption/nesting; D verifies links/IDs. H/source owner supplies absent source or permission outside semantics. No redundant `attributedClaim` type on every embedded claim. |
| Credential → `credential` | Targeted credential-led copy; Safety/credential Proof matcher. | Credential and issuer; holder binding; scope/validity when stated. | S/D for holder/issuer registry and dates; J/F for holder/assertion binding; H for missing credential records. Service vocabulary does not establish licensure. |
| Award → `award` | Targeted recognition copy; Safety/award Proof matcher. | Title, issuer and category; recipient binding; year/period in time. | S/D for award records; J/F for recipient/category/attribution; H for absent award details. An award is not a universal superiority claim. |
| Experience → `experience` | Targeted quantified experience check; Safety/fact matcher. | Measure and kind (`practitionerExperience`/`businessExperience`/`businessAge`); holder binding; stated start/date scope. | D calculates elapsed duration only from supplied dates/reference; J/F distinguishes holder/business age; H supplies start/holder. No inferred practitioner experience from founding date. |
| Operative date/deadline → `operativeDate` | Targeted date-sensitive copy; Safety and prospective content-date validator. | Role and event/action; date/period in time, binding/qualifiers if necessary. | D for calendar validity, interval arithmetic and timezone conversion; J/F for operative role/reference; H supplies absent intended reference/timezone. Publication schedule is separate input. |

`descriptiveAssertion` has no distinct current consumer and is excluded as a standalone field/call. Campaign-period and inventory/stock families are excluded in the current organic workflow: their identities, authorized records and dedicated consumers are absent. Generic offer/date review and whole-draft safety still cover unsupported wording.

## 5. Cross-cutting semantics

### Polarity and presentation

`affirmed` and `negated` apply to the normalized proposition, not sentiment, a lexical trigger, or the whole sentence. Types survive denial. A question/hypothetical/example is not automatically a first-party assertion. A sentence phrased as an instruction can contain an implicit contact proposition (“book via this URL” identifies a destination); observe that proposition with its actual assertion function rather than exempting every imperative.

Multiple services/entities can share a proposition only when the same stated relation, polarity, time and attributes really apply to them. Return separate role bindings; consumers must not form an arbitrary Cartesian product of branches, services and values. Otherwise split the proposition. When negation scopes over only one of several outcomes, split them instead of sharing a polarity.

### Attribution and adoption

`mode` distinguishes first-party, reported and quoted presentation. Unknown/unresolved mode is carried by the value-state wrapper. `adoption` records textual adoption by the brand, not source credibility or a speaker's actual permission. A direct first-party assertion is adopted as a textual stance, but not thereby authorized. A neutral report may have unknown adoption if surrounding framing does not settle it; do not guess intent.

An ordered outer-to-inner chain retains the source/speaker and report/quote mode at each level. An outer assertion “Nino says P” can be first-party while embedded P is quoted. Nested outer reports and embedded propositions receive distinct IDs and optional parent links. A quote adopted by surrounding brand copy retains its quote chain and adopted stance. A new first-party promise in the framing is a separate proposition.

Attribution never exempts support/permission review. A matcher may need to verify that a quotation/report exists and separately assess the embedded claim under an applicable rule. The model cannot verify source truth, authenticity, business authority or consent.

### Modality: retain a compact conditional field

Keep `possible` / `asserted` / `categorical` where needed. Clinical/outcome Safety review needs the strength of the statement to match scope against permitted support; Writer repair needs it to preserve hedging. This is an identified action even when claim-family membership is unchanged.

| Wording | Modality | Family implications in patient-facing outcome copy |
| --- | --- | --- |
| “Pain may decrease.” | `possible` | Clinical outcome; the hedge does not erase clinical meaning. A possibility alone need not be an audience promise. |
| “Pain will decrease.” | `asserted` | Clinical outcome and future audience outcome promise; future tense alone is not a guarantee. |
| “Pain will definitely decrease.” | `categorical` | Clinical outcome, outcome promise and explicit absolute-certainty guarantee semantics. |

Modality is the text's commitment strength, not the interpreter's confidence. Preserve conditional, population and “up to” wording as qualifiers. In “we do not guarantee a result,” polarity denies the guarantee relation; the certainty of uttering the disclaimer does not create an affirmative guarantee. If a compact value cannot capture consequential scope, return unresolved meaning with the exact qualifier rather than add a modal logic system. Omit modality for ordinary operational assertions where no consumer uses it.

### Time: scope, not a logic engine

Retain past/current/future relation when consequential, exact stated temporal expressions, an explicit period when resolvable, and a reference ID for relative expressions. No expression means unknown time when a consumer requires it; never default to now. A claim like “ended” establishes the current negative offer state without inventing its previous boundaries.

Date math, interval boundaries, calendar validity and timezone conversion are deterministic. Interpret “today/tomorrow/last week” only against a caller-supplied reference appropriate to the intended publication. If absent, retain the expression and unknown reference/period. Do not substitute model time, workstation time or the drafting date. A future scheduling timestamp is not evidence that a deadline in the copy is valid. The consumer checks freshness and applicability at intended publication, using its authorized records and existing rule.

For hours, preserve the expressed schedule/exception without inferring capacity. A local time lacking a necessary timezone remains unresolved for operational comparison. Do not implement recurrence algebra, event calculus, campaign inference or a general temporal reasoner.

## 6. Unknown, N/A, unresolved and completeness

Use a small value-state wrapper for requested semantic slots:

| State | Meaning | Example / consequence |
| --- | --- | --- |
| `known` | Meaning/value is recoverable from supplied text or explicitly linked structured context. | “150 ლარი” gives amount/currency, not an approved tariff. |
| `unknown` | Required information is not stated/supplied, or this slot was explicitly not interpreted. | No comparison baseline or relative-date reference. Ask the source owner only if needed for an actual action. |
| `notApplicable` | The slot has no meaning for this proposition/task. | Ranking class on an ordinary non-ranking comparison; no relative reference for an absolute date. |
| `unresolved` | Supplied wording has competing interpretations or cannot be bound reliably. | “ამ სერვისზე” after two equally plausible services. Retain alternatives only when they help a consequential interpretation task. |

Do not serialize all three non-known states as null, an empty string, numeric zero or a model guess. Optional field omission is outside this wrapper and means it was not requested/emitted. A known mention can still have no resolved registry ID; entity name recognition does not establish identity or authority. Unknown price/service/outcome/Proof/source truth/campaign identity must not be filled from brand memory, generic domain knowledge or model confidence. Authority, Proof and source truth have no slots in this contract at all; their missing values belong to assessment records.

Interpretation `resolved` means the text has been interpreted successfully, including genuine omissions. It does not mean all slots are known or that the claim is complete/supported. Use `partial` for unresolved or not-evaluated required semantic fields and `abstained` when the attempted interpretation cannot be supplied. A consumer cannot use unknown polarity/adoption/binding as an affirmative default. A provider/transport/schema error is recorded as a technical execution failure, not a semantic answer or confident absence.

Run completeness checks only within an activated, material proposition whose consumer needs the missing dimension:

| Reason code | Admission condition | Consumer/action |
| --- | --- | --- |
| `unspecifiedOutcome` | Affirmative covered outcome/guarantee needs an endpoint that cannot be recovered. | Safety/Writer request an authorized endpoint or remove the promise. Do not demand an endpoint for a harmless denied guarantee. |
| `missingComparisonBaseline` | Comparative interpretation/support matching needs a missing baseline, unrecoverable from supplied context. | Comparative reviewer avoids an invented comparator; repair or source clarification if material. |
| `undefinedSuperlativeBasis` | Material ranking lacks a usable stated criterion/measure. | Same comparative reviewer asks for a permitted ranking basis or removes the ranking. A recoverable comparison class does not supply its metric. |
| `unclearScope` | A needed entity, service, branch, audience or time scope is missing/ambiguous. | Matcher/Writer identify the exact unresolved dimension, not a general “vague text” warning. |

Each reason carries affected field paths. Several reasons/families can feed one issue when the smallest repair is shared. Reasons are semantic diagnostics, not violations. Keep `vagueQuantifier` and `ambiguousReference` experimental; neither is a v1 global pass or reason enum. A material reference-binding problem can already use an unresolved binding plus `unclearScope`, without promoting the experimental classifier. Ordinary conversational vagueness does not trigger numeric precision demands.

## 7. Proposed output schema

This is a documentation schema, not a new application module. Required slots in an activated payload must use `Slot<T>` even when absent in the copy. A production serializer could restrict payload families to the caller's profile; it must not infer N/A from omitted required slots.

```ts
type Slot<T> =
  | { state: "known"; value: T }
  | { state: "unknown"; reason: "notStated" | "notSupplied" | "notEvaluated" }
  | { state: "notApplicable" }
  | { state: "unresolved"; alternatives?: readonly T[] };

type SourceSpan = {
  sourceId: string;
  revisionId: string;
  start: number; // inclusive Unicode code-point offset
  end: number;   // exclusive Unicode code-point offset
  excerpt: string;
};
type EntityRef = { mention: string; registryId?: string }; // ID from S/D only
type Binding = {
  bindingId: string; // application-owned local ID
  role: "subject" | "serviceOrItem" | "branchOrPlace" | "audience"
    | "comparator" | "holder" | "recipient";
  target: Slot<EntityRef>;
};
type Quantity = { value: string; unit: Slot<string> };
type Period = {
  start: Slot<string>; end: Slot<string>; // deterministic ISO date/time values
  timeZone: Slot<string>; endInclusive: Slot<boolean>;
};
type TemporalScope = {
  relation: Slot<"past" | "current" | "future">;
  expressions: readonly string[];
  period: Slot<Period>;
  relativeReferenceId?: Slot<string>;
};
type Attribution = {
  mode: Slot<"firstParty" | "reported" | "quoted">;
  adoption: Slot<"adopted" | "notAdopted">;
  chain?: readonly {
    mode: "reported" | "quoted";
    speaker: Slot<string>;
  }[]; // outermost to innermost; exact source speakers, not evidence
};
type Qualifier = {
  kind: "condition" | "eligibility" | "scope" | "exception" | "measurementBasis";
  text: string; // exact relevant wording; basis/start-price also normalized below
};
type Claim =
  | { type: "price"; amount: Slot<string>; currency: Slot<string>;
      basis: Slot<"exact" | "starting" | "range">; upperAmount?: Slot<string> }
  | { type: "discount"; reduction: Slot<Quantity> }
  | { type: "comparison"; attribute: Slot<string>;
      direction: Slot<"more" | "less" | "same" | "different">;
      baseline: Slot<string>; basis: Slot<string>; magnitude?: Slot<Quantity>;
      ranking?: { position: Slot<string>; comparisonClass: Slot<string> } }
  | { type: "guarantee"; object: Slot<string>;
      kind: Slot<"warranty" | "outcomeAssurance" | "absoluteCertainty"> }
  | { type: "outcomePromise" | "clinicalOutcome"; outcome: Slot<string> }
  | { type: "availability"; resource: Slot<string> } // local binding ID
  | { type: "contactDestination"; kind: Slot<"phone" | "email" | "url" | "handle">;
      destination: Slot<string>; purpose: Slot<string> }
  | { type: "quantity"; quantity: Slot<Quantity>; measure: Slot<string> }
  | { type: "openingHours"; schedule: Slot<string> }
  | { type: "location"; place: Slot<string>;
      role: Slot<"branchAddress" | "serviceArea" | "serviceLocation"> }
  | { type: "externalStatistic"; quantity: Slot<Quantity>; measure: Slot<string>;
      population: Slot<string>; source: Slot<string> }
  | { type: "report"; source: Slot<string>; contentPropositionIds: readonly string[] }
  | { type: "credential"; credential: Slot<string>; issuer: Slot<string> }
  | { type: "award"; title: Slot<string>; issuer: Slot<string>; category: Slot<string> }
  | { type: "experience"; measure: Slot<Quantity>;
      kind: Slot<"practitionerExperience" | "businessExperience" | "businessAge"> }
  | { type: "operativeDate"; role: Slot<"deadline" | "eventDate"
      | "operationDate" | "eligibilityPeriod">; event: Slot<string> };
type CompletenessReason = {
  code: "unspecifiedOutcome" | "missingComparisonBaseline"
    | "undefinedSuperlativeBasis" | "unclearScope";
  fields: readonly string[];
};
type InterpretationMethod =
  "structured" | "deterministic" | "jevCandidate" | "strongerModel" | "human";
interface SemanticObservation {
  observationId: string;
  propositionId: string;
  sourceSpans: readonly SourceSpan[];
  normalizedProposition: Slot<string>;
  presentation: Slot<"assertion" | "question" | "hypothetical" | "example" | "instruction">;
  claims: readonly Claim[]; // claimTypes projection = claims.map(c => c.type)
  polarity: Slot<"affirmed" | "negated">;
  attribution: Attribution;
  parentPropositionId?: string;
  modality?: Slot<"possible" | "asserted" | "categorical">;
  bindings?: readonly Binding[];
  time?: TemporalScope;
  qualifiers?: readonly Qualifier[];
  reasons?: readonly CompletenessReason[];
  interpretation: {
    status: "resolved" | "partial" | "abstained";
    unresolvedFields?: readonly string[];
    abstentionReason?: "insufficientContext" | "semanticAmbiguity" | "capabilityLimit";
  };
  confidence?: readonly {
    target: string; // exact semantic field/event being scored
    measure: "binaryProbability" | "selfReported";
    value: number; // 0..1; not a publication/support score
    calibrationRef?: string;
  }[];
  provenance: {
    contractVersion: "unda-semantic-observation-v1";
    method: InterpretationMethod;
    inputRefs?: readonly string[]; // structured/source-owner inputs, if used
    contextRefs?: readonly string[]; // immutable supplied context, if used
    interpreter?: { provider: string; model: string; configurationRef: string };
    fieldOrigins?: readonly {
      field: string; method: InterpretationMethod; sourceRef?: string;
    }[];
  };
}
```

Additional ownership/presence rules for schema members:

- `bindingId`, source/revision IDs, parent/content links and provenance refs are D-owned. Registry IDs attach only after an exact supplied/registry identity match, never a model guess. An omitted registry ID means unbound; an unresolved competing identity belongs in the binding slot.
- `Period.start`, `end`, `timeZone`, `endInclusive`, and `relativeReferenceId` use explicit value states when requested. Open interval boundaries can be N/A; unstated necessary boundaries/timezone are unknown. D resolves them from supplied expressions/reference/configuration; J/F cannot invent them. `Period` is conditional inside the time slot, not a required calendar object on every claim.
- Attribution chain mode/speaker and qualifier kind/text are J/F interpretations of supplied wording or S/D exact-rendering values. They are conditional when relevant, and H can supply missing context. Claims retain one semantic payload per family; a shared outcome across clinical/promise families must remain consistent.
- Confidence target/measure/value come from the actual prediction/self-report; calibration refs and interpreter configuration refs are D-owned. Model/config refs are required for J/F interpretations; input refs are required when S/H inputs are used. Mixed-field results must list origins for fields produced differently from the primary method.
- No raw probability or experimental reason changes required field presence. Confidence cannot turn an unresolved slot into known. The schema version describes this observation boundary, not an ontology, dataset or benchmark-protocol version.

Deterministic acceptance checks validate exact spans, current revisions, IDs/link integrity, unique family objects, allowed profile fields, numeric formats, value-state shape and structural consistency. They reject an availability resource ID that does not refer to a binding, model-minted registry IDs and a claimed structured bypass whose exact rendering does not match the source revision. A tariff/copy difference remains a downstream assessment, not grounds to replace the observation. Detecting double-negation normalization, misread expiry, proposition atomicity or incorrect attribution in unrestricted prose still requires semantic review/evaluation; a format validator cannot certify these meanings. Successful JSON validation does not prove interpretation correct. Rejected interpretations remain unresolved work, never a default NO or pass.

## 8. Jev call design alternatives

These are qualitative design tradeoffs, not measured costs or provider performance claims. A “call” means a bounded interpretation request; several narrow questions can share one transport request. The [current benchmark adapter](../../unda-semantic-benchmark/src/lib/benchmark/providers.ts) already batches keyed Noul questions over one text. It demonstrates binary probabilities, not arbitrary proposition discovery, argument extraction or native structured-observation output.

| Dimension | A. Many narrow YES/NO decisions | B. One bounded structured proposition interpretation | C. Deterministic candidates → one bounded Jev interpretation → consequential unresolved fallback |
| --- | --- | --- | --- |
| Cost | More decision targets and repeated context; batching can reduce transport overhead. Does not extract missing arguments. | Shared context/attributes can reduce repeated work; richer output and validation have cost. | Zero inference for exact typed text; candidate validation plus occasional fallback can dominate savings. Measure total cost per consumed assessment. |
| Latency | Parallel/batched targets may be fast; serial calls multiply round trips. Reconciliation adds work. | One request avoids serial attribute rounds; larger bounded task can take longer. | Fast deterministic path; tail latency includes unresolved fallback. Compare p50/p95 and fallback rate. |
| Consistency | Independent type/polarity/adoption answers can contradict or refer to different clauses. | Shared proposition anchor improves alignment; still needs coherence validation. | Shared anchors and deterministic checks improve alignment; candidate coverage remains a risk. |
| Calibration | Individual binary events can be calibrated on reviewed labels. Not a joint correctness probability. | Scalar self-confidence is inadequate for extraction, segmentation and multiple attributes; evaluate per field. | Calibrate the actual requested semantic targets and selective acceptance; no confidence invented for deterministic paths. |
| Correlated errors | Shared model/context means nominally separate decisions are not independent. | One mistaken segmentation/attribution can corrupt several attributes together. | Candidate omission and shared bindings can propagate errors; stronger models can share the same mistake. Keep a whole-draft backstop. |
| Observability | Easy per-target logs; harder to reconstruct one coherent proposition from whole-text labels. | One trace includes anchors, payload and unresolved fields; errors are inspectable. | Trace candidate → interpreted fields → assessment → action, including unresolved and bypass paths. |
| Testability | Simple target-level cases; insufficient evidence of extraction or combined downstream behavior. | Requires atomicity, payload, attribute-coherence and abstention cases. | Requires candidate coverage, deterministic parity, interpretation, fallback eligibility and consumer/action tests. |
| Prompt complexity | Small questions individually; definitions/reconciliation multiply with targets. | Bounded joint task is more complex and must limit fields/context. | More orchestration, but each interpretation is constrained by a consumer profile and supplied anchors. |
| Abstention | Current Jev adapter supplies application abstention from probability dead-zone; not native UNCERTAIN. | Can expose field-level unknown/unresolved if the provider supports that output; capability is unproven locally. | Preserve semantic unresolved states and technical failures; use a named task for fallback. |
| Migration risk | Lowest only for existing binary capabilities; adapting old whole-text/denial rules is still semantic migration. | Highest if treated as an already-supported extractor or if multi-field output silently replaces reviewer judgment. | Controlled shadow integration and projections; risk lies in candidate gating and unsafe schema/provider assumptions. |

**Recommend C for a production experiment**, with B's proposition-level return shape as an adapter contract **only where capability is demonstrated**. Keep one bounded request per small related anchor group, not one request per family or an unbounded whole-draft ontology inventory. Supply exact source revisions/anchors, necessary surrounding context, requested fields and known structured candidates. Return observations plus unresolved work through deterministic validation.

The inspected Jev adapter cannot be assumed to generate these free-text arguments or discover propositions. Before choosing its request encoding, verify supported capabilities in the separately authorized next phase. If Jev remains a keyed binary service, it can interpret bounded family/polarity alternatives on independently established anchors, batching uniquely keyed proposition/target questions. S/D supplies typed payloads; an unresolved free-text argument goes to the existing qualified reviewer or a consequential stronger-interpretation task. Do not approximate arbitrary extraction by guessing values and asking endless YES/NO questions. If the supported subset has no consumed benefit, make no Jev call. This document changes no adapter or prompt and performs no capability query/provider run.

Candidate detection must not be the sole eligibility gate: implicit comparisons/outcomes lack lexical markers. Continue current whole-draft safety review, and evaluate candidate/discovery coverage separately. Bounded requests can cover small ambiguous passages flagged by the existing review, but classification scores on supplied anchors cannot establish unrestricted discovery recall.

## 9. Confidence, abstention and escalation

Confidence is useful internally for calibrated selective acceptance of a specific family/polarity decision, error analysis and prioritizing a consequential unresolved interpretation. It is not support probability, clinical truth, source authority, risk severity, permission or a publication score. `possible` modality is not low model confidence. Multiple high-confidence fields do not establish a high-confidence correct proposition decomposition.

The [existing benchmark methodology](../../unda-semantic-benchmark/docs/methodology.md) distinguishes Jev's application probability dead-zone from native baseline UNCERTAIN and technical errors. Do not transplant its 0.40/0.60 decision boundaries, binary confidence aggregation or v1 gold semantics into this contract. Per-field calibration and acceptance criteria must be evaluated on the proposed task and consequences; no numeric production threshold is selected here. A model that returns no usable probabilities supplies no probability-based calibration evidence. Tag self-reported confidence explicitly and do not treat it as calibrated probability.

No escalation is justified by a low score alone, an unused optional field, benign language, a clear denied guarantee, an experimental vagueness label, or missing authoritative records. If all plausible interpretations yield the same permitted repair/review action, escalation has no decision-changing task. Insufficient offer terms, missing Proof, business authority or source permission belong to source/human resolution or already permitted repair.

Stronger interpretation is eligible only when all these conditions hold:

1. An activated consumer has an existing applicable rule/source need and a material pending action.
2. A required **semantic** field remains unresolved after checking available structured data, deterministic extraction and bounded interpretation.
3. At least two plausible interpretations of the supplied text would change the actual assessment, requested repair or review handling.
4. The task can name the field, exact spans/context and the differing consequences. It asks to resolve meaning/binding or abstain, never to decide support or supply new facts.

Examples: resolve which clause negates the offer; identify whether certainty attaches to a clinical endpoint; determine whether a quotation is adopted; bind a comparison baseline recoverable from supplied context; bind a consequential price/date to the right branch. Missing baseline that is nowhere supplied is a source input problem, not a harder-model puzzle. After one stronger interpretation attempt, retain unresolved meaning for the existing review/source-owner path or a permitted repair; do not create an indefinite retry/escalation loop. Returned stronger interpretations go through the same contract/validation and remain separately traceable.

## 10. Consumer projections and visibility

A projection is a whitelist assembled for an identified task. It does not add a new prompt or policy in this design. The example observation “recovery is twice as fast” can carry clinical and comparative types, a factor of two, and a missing baseline, while each consumer receives a smaller view.

| Consumer | Minimal observation projection | Separate required assessment input / resulting action |
| --- | --- | --- |
| Safety reviewer | Proposition/observation IDs, exact spans, kernel, relevant family payloads, polarity, attribution/adoption, needed modality/bindings/time/qualifiers and relevant reasons. | Existing applicable constraints and supplied authorized facts/Proof. Assess the exact claim, not a detection label; produce a justified actionable issue or no issue. For the recovery example, inspect the clinical comparison without inventing a baseline. |
| Fact / Proof matcher | Proposition ID, relevant typed arguments, bindings, polarity, relevant attribution, modality, qualifiers and temporal scope; span refs for trace. | Authorized records, eligibility/freshness/scope rules and intended publication reference. Match the right relation and units. Unknown baseline or missing records remains unresolved support; no inferred Proof. |
| Editorial reviewer | Exact text/span and task; only semantic qualifiers, references or incompleteness that affect reader understanding. | Voice/task context. A missing comparison baseline can motivate a precise clarity edit. Do not send all types, confidence, routing, registries or source authority to the editorial prompt. |
| Writer repair | After assessment: the affected revision/span/proposition, concrete consolidated repair instruction, attributes that must be preserved and only permitted replacement inputs. | Validated issue and approved material. Remove/revise the unsupported comparison without inventing the comparator or changing hedged clinical meaning. No confidence-driven rewrite. |
| Validation / approval policy | Observation/proposition trace IDs and referenced assessment/issue records; only rule-needed semantic facts, such as a confirmed negative guarantee, if required. | Existing rule, assessed support/constraint result, issue severity and repair/review state. Policy owns the existing consequence; a raw `claims[]`, empty list or interpretation confidence cannot pass/block publication. |

The same issue can cover price/discount/quantity/scope when one repair resolves them. Avoid duplicate warnings for clinical+comparative claims or superlative subtypes. Repair invalidates old observations; re-evaluate the changed revision through the existing final-validation/review boundary, within the current one-repair lifecycle.

Default semantic output is internal. Users see an exact conflict, a missing required input, a specific repair request or an actual review consequence. For example: “კონსულტაციის 20%-იანი ფასდაკლება ტექსტშია, მაგრამ დამტკიცებული პირობები არ არის მოწოდებული. ამოიღეთ ეს შეთავაზება ან მოგვაწოდეთ შესაბამისი მომსახურება და მოქმედების პერიოდი.” A genuine contradiction is shown only when an applicable authorized record actually conflicts; missing support is not called false.

Do not expose raw labels, confidence, disagreement, internal routing, ontology terminology or a payload dump. User-facing feedback is produced after the separate assessment establishes why action is necessary. No user warning is emitted merely because interpretation is partial.

## 11. Ten worked Georgian examples

These are illustrative semantic examples, not facts about an actual business or model outputs. No provider was run. In the compact records below, `K(x)` means a known slot, `U` an unknown/not-stated slot, and `R(...)` an unresolved slot. `firstParty/adopted` describes the text's stance only. Each `p1`, `p2` etc. is local to that example.

Every emitted observation also has application-owned `observationId`, `propositionId`, source/revision IDs, exact code-point spans verified against the displayed input, presentation and interpretation/provenance metadata from section 7. The abbreviated records show exact excerpts and semantic fields rather than inventing a model, run ID or confidence. They are projections, not complete serialized schema instances. No caller date reference, authoritative registry, tariff, offer or Proof is supplied unless explicitly stated.

### 1. Starting price

**Input:** “კონსულტაციის ფასი 150 ლარიდან იწყება.”

**Observation:** `p1`, exact excerpt = input; kernel `K("კონსულტაციის ფასი იწყება 150 ლარიდან")`; claims `[price { amount: K("150"), currency: K("GEL"), basis: K("starting") }]`; polarity `affirmed`; attribution `firstParty/adopted`; binding service `K("კონსულტაცია")` without a registry ID. No time supplied.

**Unknown:** Which exact consultation/branch tariff and effective period apply; whether an approved starting-price record exists. The amount is not a fixed price or guaranteed final total.

**Consumer/action:** Safety identifies the exact price addition. A future tariff matcher must use starting-price semantics and correct service scope. With the current empty facts, remove the unsupported tariff or request approved input only if required by review; do not claim a contradiction or invent a replacement price.

### 2. Ended discount

**Input:** “კონსულტაციაზე 20%-იანი ფასდაკლება დასრულდა.”

**Observation:** `p1`, excerpt = input; kernel `K("კონსულტაციაზე 20%-იანი ფასდაკლება მოქმედებს")`; `[discount { reduction: K({ value: "20", unit: K("percent") }) }]`; polarity `negated`; time relation `current`, period `U`; service `K("კონსულტაცია")`; attribution `firstParty/adopted`. “დასრულდა” anchors the ended/current-negative interpretation.

**Unknown:** Exact start/end dates, conditions, eligibility, branch, campaign identity and authorized end-state record. Do not calculate a new price or infer a live campaign.

**Consumer/action:** Offer-status assessment checks the asserted end state if authorized terms become available. It must not produce an active discount or an automatic expired-promotion warning. Unsupported end-state wording can still need a specific repair under current review.

### 3. Denied guarantee

**Input:** “შედეგზე გარანტიას არ ვიძლევით.”

**Observation:** `p1`; excerpt = input; kernel `K("ბრენდი შედეგზე გარანტიას იძლევა")`; `[guarantee { object: K("შედეგი"), kind: K("outcomeAssurance") }]`; polarity `negated`; attribution `firstParty/adopted`; modality, if requested for this review, `asserted`. The kind describes the denied assurance, not an offered warranty.

**Unknown:** A specific endpoint and service. Neither a clinical result nor a future audience promise is inferred. No `unspecifiedOutcome` intervention is warranted merely to complete this disclaimer.

**Consumer/action:** Safety recognizes a denial rather than an affirmative guarantee. The guarantee family alone causes no block, endpoint request or stronger interpretation. Any required disclaimer adequacy remains an existing constraint assessment.

### 4. Possible, asserted and categorical clinical outcomes

**Inputs, as separate patient-facing variants:**

1. “ტკივილი შეიძლება შეგიმცირდეთ.”
2. “ტკივილი შეგიმცირდებათ.”
3. “ტკივილი აუცილებლად შეგიმცირდებათ.”

**Observations:** Each variant has its own `p1` and exact input span, an affirmative kernel `K("მკითხველის ტკივილი მცირდება")`, future relation, reader/audience binding from “შეგიმცირდეთ/შეგიმცირდებათ” and first-party/adopted stance.

- Variant 1: `[clinicalOutcome { outcome: K("ტკივილის შემცირება") }]`, modality `possible`. A possible effect alone does not establish a promise.
- Variant 2: `[clinicalOutcome, outcomePromise]`, both carrying that same outcome, modality `asserted`; no guarantee from future tense alone.
- Variant 3: `[clinicalOutcome, outcomePromise, guarantee]`, with guarantee object that outcome and kind `absoluteCertainty`, modality `categorical` from “აუცილებლად.”

**Unknown:** Service/treatment, patient population, degree/onset/duration of effect and eligible clinical Proof. The audience pronoun does not identify a disease or universal patient response.

**Consumer/action:** Clinical Safety/Proof assessment checks the exact claimed strength under existing constraints. Writer must preserve “შეიძლება” in an otherwise permitted repair; adding it to an unsupported claim does not supply evidence. Modality differences can change review/repair, justifying the conditional field; they do not settle permission.

### 5. Missing comparison baseline and overlapping clinical type

**Input:** “ჩვენთან აღდგენა ორჯერ სწრაფია.”

**Observation:** `p1`; kernel `K("ჩვენთან აღდგენა უფრო სწრაფია")`; `[comparison { attribute: K("აღდგენის სიჩქარე"), direction: K("more"), baseline: U, basis: U, magnitude: K({ value: "2", unit: K("ratio") }) }, clinicalOutcome { outcome: K("უფრო სწრაფი აღდგენა") }]`; polarity `affirmed`; attribution `firstParty/adopted`; reasons `missingComparisonBaseline` targeting comparison baseline, and `unclearScope` only if the enabled matcher requires the unstated treatment/population. No duplicate quantity object when the comparative consumer already checks the factor.

**Unknown:** Compared treatment/provider/prior state, operational metric, treatment, population and Proof. “ორჯერ” is stated, but does not supply the comparison baseline.

**Consumer/action:** One combined clinical/comparative assessment and, if necessary, one repair. A baseline absent from all supplied context goes to source input or removal, not repeated model escalation.

### 6. Superlative subtype with undefined basis

**Input:** “ჩვენი კლინიკა ქალაქში საუკეთესოა.”

**Observation:** `p1`; `[comparison { attribute: U, direction: K("more"), baseline: K("ქალაქის კლინიკები"), basis: U, ranking: { position: K("highest"), comparisonClass: K("ქალაქის კლინიკები") } }]`; kernel `K("ჩვენი კლინიკა ქალაქის კლინიკებში უმაღლეს ადგილზეა")`; polarity `affirmed`; attribution `firstParty/adopted`; reason `undefinedSuperlativeBasis` targeting comparison basis/attribute.

**Unknown:** Which criterion, actual city identity if not in supplied context, ranking source and valid comparison period. The local clinic class is recoverable; the metric is not. Do not also label a missing baseline solely because the superlative is implicit.

**Consumer/action:** Comparative reviewer requests a supportable ranking basis or removes a material ranking under the applicable rule. The ranking subtype produces no separate Jev call or duplicate warning. “საუკეთესო სურვილებით” would not be a clinic-ranking proposition.

### 7. Opening hours versus booking availability

**Input:** “თბილისის ფილიალი ორშაბათობით 09:00–18:00 მუშაობს, მაგრამ დღეს კონსულტაციაზე თავისუფალი ადგილები არ არის.”

**Observations:**

- `p1`, excerpt “თბილისის ფილიალი ორშაბათობით 09:00–18:00 მუშაობს”: `[openingHours { schedule: K("ორშაბათობით 09:00–18:00") }]`; affirmed; current operating-schedule relation; branch mention `თბილისის ფილიალი`.
- `p2`, excerpt “დღეს კონსულტაციაზე თავისუფალი ადგილები არ არის”: availability resource `K("service1")`, binding `service1 = K("კონსულტაცია")`, branch recovered from the clear shared clause; kernel `K("კონსულტაციაზე თავისუფალი ადგილებია")`; negated; time expression `დღეს`, current relation, unknown period/reference. Both propositions are first-party/adopted.

**Unknown:** Authoritative hours/exception/timezone and fresh capacity record; exact publication-relative “today.” No slot count of zero is extracted. Open hours provide no evidence of bookability.

**Consumer/action:** Separate hours and capacity matching if their records are supplied; current Safety can identify unsupported additions. D resolves “today” only after a reference is supplied. Do not create a booking-capacity issue from `p1` or infer capacity from 09:00–18:00.

### 8. Nested attribution and separate outer reports

**Input:** “ნინო ამბობს: „პაციენტმა თქვა: ‘ტკივილი შემიმცირდა’“.”

**Observations:**

- `p1`: outer report, `[report { source: K("ნინო"), contentPropositionIds: ["p2"] }]`; kernel `K("ნინო ამბობს p2-ს")`; affirmed; first-party/adopted **reporting assertion**.
- `p2`: the reported assertion that the patient said `p3`; `[report { source: K("პაციენტი"), contentPropositionIds: ["p3"] }]`; parent `p1`; affirmed; quoted mode, chain `[ნინო / quoted]`, brand adoption unknown absent decisive framing.
- `p3`: embedded `[clinicalOutcome { outcome: K("ტკივილის შემცირება") }]`; parent `p2`; kernel `K("პაციენტის ტკივილი შემცირდა")`; affirmed; past; quoted mode, chain `[ნინო / quoted, პაციენტი / quoted]`, brand adoption unknown. Exact content excerpt is “ტკივილი შემიმცირდა”.

**Unknown:** Whether either report/quotation exists, patient identity, service, testimonial permission and clinical support. Nino's statement is not evidence that the patient's outcome is true. Quote marks do not determine endorsement or consent.

**Consumer/action:** Source/testimonial review can check the outer reporting assertions separately from embedded clinical content. Only consequential unresolved adoption/speaker binding warrants stronger interpretation of supplied framing. Absent source/permission goes to the source owner, not a model. A later brand sentence “იმავე შედეგს ჩვენც გპირდებით” would add a separate adopted outcome promise; it would not rewrite `p3` into a first-party quote-free fact.

### 9. Mixed polarity and temporal change

**Input:** “გასულ კვირას კონსულტაციაზე 20%-იანი ფასდაკლება მოქმედებდა, ახლა აღარ მოქმედებს, ხოლო მომავალ კვირას ვაკის ფილიალში იმოქმედებს.”

**Observations:** Three discount propositions, each with reduction `20 percent`, service consultation and kernel “კონსულტაციაზე 20%-იანი ფასდაკლება მოქმედებს,” first-party/adopted:

| Proposition / exact clause | Polarity | Time expression / relation | Branch |
| --- | --- | --- | --- |
| `p1`: “გასულ კვირას კონსულტაციაზე 20%-იანი ფასდაკლება მოქმედებდა” | affirmed | `გასულ კვირას` / past | unknown |
| `p2`: “ახლა აღარ მოქმედებს” | negated | `ახლა` / current | unknown |
| `p3`: “ხოლო მომავალ კვირას ვაკის ფილიალში იმოქმედებს” | affirmed | `მომავალ კვირას` / future | stated Vake branch mention |

Shared discount/service arguments are recoverable through this clear antecedent; their context refs are retained. The future branch is not retroactively attached to the past/current claims.

**Unknown:** Calendar weeks until a valid publication reference is supplied, offer conditions/eligibility, approved offer records, earlier branches and campaign identity. No single “active” status represents the sentence.

**Consumer/action:** Offer assessment checks each stated temporal proposition. D later computes explicit dates from a supplied reference and checks authorized periods against intended publication. Material ambiguity that would swap active/ended meaning qualifies for a bounded semantic fallback; missing offer authority does not.

### 10. Distinct branches, prices and a contact destination

**Input:** “ვაკის ფილიალში კონსულტაცია 150 ლარი ღირს, საბურთალოს ფილიალში — 180 ლარი. დასაჯავშნად მოგვწერეთ booking@example.test-ზე.”

**Observations:**

- `p1`, excerpt “ვაკის ფილიალში კონსულტაცია 150 ლარი ღირს”: price amount `150`, currency `GEL`, basis `exact`; consultation + Vake bindings; affirmed.
- `p2`, excerpt “საბურთალოს ფილიალში — 180 ლარი”: price amount `180`, currency `GEL`, basis `exact`; consultation recovered from `p1`, Saburtalo binding; affirmed. The ellipsis does not collapse these into one price.
- `p3`, excerpt “დასაჯავშნად მოგვწერეთ booking@example.test-ზე”: contact destination kind `email`, normalized destination `booking@example.test`, purpose `booking`; implicit kernel “ბრენდის დაჯავშნის საკონტაქტო მისამართია booking@example.test”; assertion function, affirmed, first-party/adopted. The Georgian suffix is outside the extracted email. The reserved example address is not a real contact record.

**Unknown:** Registry identities, approved branch tariffs/effective periods and whether the email is an approved owned destination. Booking-purpose text does not assert that appointments are available.

**Consumer/action:** D extracts two prices and the endpoint; semantic interpretation is needed only for unresolved elliptical service/role binding. Matcher checks each branch separately, contact consumer matches its approved registry. In the current context Safety reviews the unsupported additions. Never distribute both prices across both branches or approve the email merely because its syntax is valid.

## 12. Final recommendation and next phase

**Recommended v1 runtime contract:** Application-owned identity/exact source anchors; one normalized proposition with independent polarity, presentation and attribution/adoption; typed consumer-selected claim payloads; conditional entity/time/qualifier/modality bindings; explicit unknown/N/A/unresolved slots; conditional material completeness reasons; interpretation resolution/provenance and optional field-specific confidence. The core is price, discount, comparative with ranking subtype, guarantee, outcome promise and availability; clinical outcomes are domain-conditional and contact destinations are present-conditional. Include typed hours/location/report/statistic/quantity/credential/award/experience/operative-date extensions only for an identified consuming assessment. This is a contract proposal, not an always-on detector list.

**Intentionally excluded:** Publication verdict, support/Proof requirement or sufficiency, authority, truth, permission, severity and a global safety/confidence score; standalone `descriptiveAssertion`, duplicate stored `claimTypes[]` and original proposition text, separate superlative/attribution classifiers, global ambiguity passes, active campaign/inventory families, inferred campaign/registry IDs, speculative missing arguments and general temporal/ontology machinery. Existing whole-draft review remains responsible for unsupported facts outside the selected profile.

**Preferred Jev integration:** C, the capability-gated hybrid: exact structured rendering bypass; deterministic candidate/anchor preparation; one bounded interpretation of only needed fields; validated proposition observations and unresolved work; stronger interpretation only for a named decision-changing uncertainty. The desired structured return shape belongs to the application adapter. The inspected binary Jev adapter does not establish native extraction/discovery capability, so use only a demonstrated consumed subset or retain the existing review path.

**Remain deterministic:** IDs/revisions/span checks, numeric/date/contact normalization, arithmetic and date math, exact registry identity and scoped record matching, authorized-record freshness checks, projection/schema validation, issue consolidation, repair budgeting, permissions, scheduling and state/approval transitions. H/source owners supply missing facts and authority; semantic models interpret supplied wording only. These ownership boundaries do not implement new feeds or a policy layer.

**Stronger-model condition:** Material existing consumer + unresolved required meaning + plausible interpretations yielding different actions + an explicit supplied-text resolution task. Missing authority, facts, Proof, permissions or absent-from-context arguments never qualify by themselves. One bounded stronger attempt then returns to existing human/review/repair handling if still unresolved.

### Benchmark capabilities needed versus non-blockers

The benchmark is read-only in this task. Its active v1 contracts contain denial/expiry/quotation exclusions that differ from the proposed proposition-scoped contract; for example, ended discounts and denied guarantees remain typed here. Do not use a v1 score or label as evidence of this observation's production correctness. The [v2 schema design](../../unda-semantic-benchmark/docs/claim-semantics-v2-schemas.md) explicitly uses curated proposition anchors and excludes proposition discovery; it remains inactive.

| Needed capability/evidence | Existing support and limitation |
| --- | --- |
| Reviewed Georgian interpretation examples for the enabled families and conditional reasons | Existing cases, ontology review and v2 definitions are useful semantic design material. Revalidate compatible meanings; inactive v2 schema/review tooling is preparation, not demonstrated model performance. |
| Proposition-scoped polarity, mixed clauses, multi-family overlap, attribution/adoption, modality, time/entity binding | Curated v2 anchors/polarity design help specify evaluation. Current v1 whole-text classification does not demonstrate this complete contract. |
| Calibration/selective acceptance, answer coverage, error capture and repeatability for the actual enabled targets | Existing probability/coverage/stability tooling offers methodology. Historical scores/dead-zones are not transferable and are not reviewed evidence of safe warning precision. |
| Full consumer-path measures: false interventions, missed material claims, invalid payloads, unresolved/fallback rates and end-to-end cost/latency | Existing request-time/token/error reports help account for calls, but do not measure the complete proposed action path. Evidence must include deterministic bypass and fallback. |
| Discovery/candidate coverage, exact argument extraction, nested attribution and binding correctness if any consumer relies on them | Not established by classification on curated anchors or current local adapter. These are separate admission requirements for the respective inferred paths; use structured bypass/existing review until demonstrated. |

Not production blockers for the bounded experiment: completion/activation of the entire Ontology v2 inventory or migration UI; standalone descriptive-assertion accuracy; global vague-quantifier/reference classification; campaign/stock classifiers without their consumers; every possible family/payload extension; editorial-quality scoring by Jev; a generic evidence router; a 1/5/10/20-question latency matrix; or a sealed holdout infrastructure rollout. Existing error-cost review, task-specific quality/coverage evidence and preserved safety review are still required for the paths actually consumed. A sealed final holdout and broader research can be later milestones; they are not substitutes for source authority or consumer validation. No benchmark changes or model runs are requested here.

### Specific implementation sequence for the next phase

1. **Agree on one consumer slice and admission criteria.** Start with price/discount/availability plus proposition polarity and entity/time binding, against real Georgian drafting cases; retain existing safety/editorial review and one-repair limits. Record which issue/action a projection can improve. Health tasks require a separate enabled clinical slice and applicable existing constraints.
2. **Connect only the slice's required authorized inputs through existing context boundaries.** Establish scoped tariff/offer/capacity records and publication references, or explicitly limit the experiment to precise unsupported-addition review. Do not hide current empty fact/Proof arrays, invent feeds or add campaign identity. This is not a general business-facts platform.
3. **Add the application contract/trace boundary and deterministic bypass.** Validate revisions, spans, numeric units, exact typed rendering and IDs; implement required consumer projections. Keep semantic observation storage separate from support/constraint decisions. Use a controlled source-owner example first to demonstrate identical bypass and interpreted consumer inputs.
4. **Establish anchor/candidate coverage and provider feasibility before consuming inference.** Evaluate omissions, implicit claims, mixed polarity, Georgian morphology, quotation, elliptical binding and temporal changes. Confirm what Jev can actually return; restrict its role to demonstrated targets rather than assuming structured extraction. Plan any separate evaluation task explicitly; do not activate Ontology v2 as a dependency.
5. **Run an authorized shadow experiment with one bounded interpretation request.** Compare against reviewed proposition/attribute/argument references and the existing reviewer outcome. Record technical failures, per-field unresolved states, coherence errors, cost/latency and false/missed interventions. No automatic user issue or publication state is changed in shadow mode.
6. **Evaluate the consequential fallback gate.** For each unresolved field document two plausible readings and their different actions; send only that meaning task to a stronger interpreter when justified. Measure whether it resolves the field and changes the downstream assessment correctly. Missing records stay with source/human input or permitted repair.
7. **Admit the verified slice through the existing review boundary.** Use accepted projections as supplementary inputs, consolidate one concrete issue per repair and revalidate changed revisions. Reject reliance if intervention precision, material-claim coverage, calibrated selective behavior or total latency/cost is inadequate. Preserve fallback to the current review path.
8. **Extend only when a named consumer demonstrates a new need.** Hours/location, clinical outcomes, attribution/statistics and typed credential/award/experience/date payloads each need their own enabled consumer, inputs and evidence. Revisit inventory/campaign families only after those dedicated workflows and identities exist.

This sequence is proposed future work. The result of the current task is this documentation contract alone.
