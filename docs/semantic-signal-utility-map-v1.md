# UNDA Semantic Signal Utility Map v1

**Status:** Design proposal only; no runtime, prompt, routing, provider, or benchmark changes.  
**Owner / scope:** UNDA Social Operator content pipeline.  
**Review date:** 2026-10-03.  
**Decision:** Select signals by the downstream decision they improve. Do not run a classifier merely because a label is available or inexpensive.

> A production semantic signal should have an identifiable consumer and a concrete downstream consequence.

## 1. Evidence and current operating boundary

This map starts with the 17 requested Ontology v2 signals, then evaluates eight requested operational candidates and three candidates already represented in the Social Operator scanner. It preserves the v2 distinction between semantic type, proposition polarity, and incompleteness. The inspected v2 manifest is marked `design-target-not-active`; this document neither activates it nor changes the benchmark.

The following are the relevant local sources, read without modification:

- [Operator overview](../README.md): planning, content, review, scheduling, publishing, and learning are separate stages.
- [Architecture amendments](Brand%20Knowledge%20Architecture%20%E2%80%94%20Amendments%20%26%20Supersession%20Map%20v1.md), especially sections 40–52: detection signals become claim candidates; semantic/support validation determines actual violations. Detection strength is separate from severity. Internal recall and warning precision have different costs.
- [Current post context](../src/blueprints/social/weekly-planning/post-context.ts): task-specific context, separate guidance and constraints, and currently empty `publicFacts` and `eligibleProof` arrays. The current weekly-post contract is organic and has no campaign identity.
- [Current post review](../src/application/weekly-planning/posts.ts), [review contract](../src/blueprints/social/weekly-planning/prompts/posts.ts), and [repair flow](../src/blueprints/social/weekly-planning/posts.ts): safety review and editorial review are separate; actionable issues are consolidated; one automatic repair preserves the earlier draft; unresolved blocking issues remain approval blockers.
- [Georgian scanner](../src/blueprints/social/validation.ts), [validation contracts](../src/core/domain/validation.ts), and [draft validation boundary](../src/blueprints/social/content-draft-validation.ts): lexical/pattern candidates and domain interfaces exist. Their existence does not prove a v2 classifier is connected to weekly review.
- [Social vocabulary](../src/blueprints/social/tokens.ts) and [knowledge-path policies](../src/blueprints/social/knowledge-paths.ts): prices, hours, contacts, availability, and inventory have business-fact vocabulary; locations have a public-fact path. Vocabulary does not establish a current, authoritative feed.
- [Ontology v2 manifest](../../unda-semantic-benchmark/ontology/claim-semantics/v2/manifest.json) and [v2 proposal](../../unda-semantic-benchmark/docs/claim-semantics-ontology-v2-proposal.md): read-only semantic definitions and boundaries.

**Current consequence:** the weekly writer and safety reviewer do not presently receive authorized price, offer, capacity, hours, location, or proof records through the inspected post context. A detected concrete claim can therefore identify an unsupported addition for review/repair; it cannot establish that a business fact is correct. Business understanding, founder notes, style references, and model memory cannot fill this authority gap.

This map names existing components as prospective consumers of signals, not as already integrated signal consumers. No Jev integration or measured Jev reliability was found in the inspected operator sources. “Suitable for Jev” means a bounded semantic task to evaluate, subject to evidence of adequate performance.

Two evidence limits matter for later integration:

- The current lexical scanner is not a v2 semantic contract. For example, its `guaranteed-result` pattern nominates a clinical-outcome candidate even when the result is unnamed, and `only-today` nominates availability without establishing booking capacity. Under v2, neither inference is sufficient. Keep these as internal candidates; do not carry their type directly into a policy decision.
- The [v2 evaluation design](../../unda-semantic-benchmark/docs/claim-semantics-v2-schemas.md) classifies curated proposition anchors. It does not establish that Jev can discover every proposition, extract its arguments, or resolve attribution in an arbitrary full draft. Those capabilities need separate evidence before a consumer relies on them. This document requests no benchmark changes or provider runs.

## 2. Consumers, action classes, and admission rules

| Consumer | Existing boundary | Concrete proposed use of signals |
| --- | --- | --- |
| Safety reviewer | `reviewPosts` / `post_review` assesses truth, safety, and execution completeness. | Inspect the exact proposition for unsupported factual expansion, an applicable constraint, or a missing authorized fact; produce a precise issue only if warranted. |
| Knowledge / Proof matcher | Domain validation contracts and draft-evaluation dependency boundaries exist; source-backed matching is not established in the current weekly-post context. | Match an extracted proposition to a permitted, scoped, fresh fact or eligible Proof. Missing support stays unresolved. |
| Editorial reviewer | Separate task/voice/quality review exists. | Request a clarity edit only when an omission changes reader understanding or task execution; do not invent factual support. |
| Writer repair | Consolidated automatic repair exists. | Change the identified span using permitted facts and constraints; preserve the post's communication job. |
| Validation / approval policy | Blocking/advisory weekly issues and domain `pass`, `repairable`, `requiresReview`, `blocked` outcomes exist at different boundaries. | Map a validated issue to the boundary's existing outcome. A raw detection never directly sets either outcome. |
| Operational fact/date checks | Business-fact vocabulary and scheduling exist; dedicated content-to-hours/contact/campaign/inventory checks are proposed extensions. | Compare normalized, correctly bound values with authorized records; validate dates against the intended publication time. Do not confuse a scheduled publication timestamp with a date asserted in copy. |

Action classes used below:

- **Deterministic:** normalization, arithmetic, exact scoped matching, validity/freshness checks, and application state transitions.
- **Prompt-level:** a bounded reviewer instruction or a specific repair/clarification instruction. These are design recommendations; no prompt is edited here.
- **Routing-level:** selecting a specialized semantic reviewer or stronger model for an unresolved interpretation. This document describes eligibility only.
- **Policy-level:** applying an existing or explicitly adopted permission, support, constraint, or review rule. A model does not author policy.

Several classes can apply in sequence. Classification is semantic even when the subsequent action is deterministic. Conversely, a deterministic lexical hit is a candidate, not a completed semantic classification.

Utility categories are recommendations, not deployment status:

- **production-essential:** omission leaves a material gap in the relevant enabled workflow's factual or claim-safety review.
- **useful:** a named consumer has a concrete benefit, but it is conditional, narrower, or already partly covered by another signal.
- **experimental:** a plausible benefit needs evidence; keep out of automatic interventions until a consumer and acceptable error behavior are established.
- **not needed:** there is no distinct current operational consequence. Do not run it by default.

Production admission requires the consumer to accept the result, an explicit changed action, defined applicable policy/source, error-cost evaluation, and a user-visibility rule. “production-essential” does not waive these conditions. Without integration, retain the existing review path; do not add an unused classification call.

## 3. Detection breadth and intervention breadth

**Detection breadth** is the range of internal candidates, overlapping types, attributes, and omissions considered while interpreting a draft. **Intervention breadth** is the narrower set that changes copy, requests author input, affects approval, or invokes another reviewer.

The proposed decision sequence is:

```text
customer-facing draft fields
→ structured values / deterministic candidates
→ semantic interpretation where needed
→ proposition, polarity, attribution, entity, and time binding
→ permitted-fact / Proof / constraint assessment
→ no issue OR one actionable consolidated issue
→ existing repair and approval flow
```

Include captions, carousel/story frame text, reel scripts, and on-screen text. Use surrounding draft/task context when needed. Incidental references, questions, hypotheticals, instructional examples, and unadopted quotations must not be promoted into brand assertions. Generated visuals containing claims would need equivalent review coverage; this map does not assert that image-text inspection is implemented.

Do not make lexical triggers the only eligibility mechanism for consequential semantic claims: implicit outcomes or comparisons can lack an obvious marker. Until bounded semantic coverage is demonstrated, the existing safety review remains the backstop. Likewise, no detected candidate or low model confidence alone should generate a user warning.

Internal claim records should conceptually retain the span, proposition, entity/service, stated qualifiers, time scope, polarity, and attribution when those are needed by the consumer. This is a design requirement, not a new schema. Unknown information remains unknown. A false negative in an early deterministic scan is a coverage limitation, not affirmative evidence of safety.

### Intervention examples

| Copy | Detection breadth | Downstream consequence | User-facing intervention |
| --- | --- | --- | --- |
| “The 20% discount no longer applies.” | Discount, explicit quantity, descriptive assertion, and negated current discount proposition. | Preserve the ended-offer meaning; check the asserted end state if an authorized offer record is available. Do not create an active promotion. | None if supported; otherwise one issue about the unsupported offer status. |
| “We do not guarantee results.” | Guarantee type, negated guarantee proposition, potentially unspecified outcome. | Distinguish a disclaimer from an offered guarantee. Do not request a named outcome merely to complete a label. | Normally none. |
| “You will notice a difference from the first visit.” | Outcome promise and unspecified outcome. Clinical content is not established. | Reviewer checks whether this audience promise is authorized; repair removes the unsupported promise or uses a permitted, specific statement. | A precise edit only if the promise is a material unsupported claim. |
| “Open Monday–Saturday.” | Opening-hours assertion; no booking-capacity implication. | Match the schedule to authorized branch hours when supplied; otherwise review the unsupported addition. | One issue about the schedule, never a warning about available appointments. |
| “Recovery is twice as fast.” | Comparison, clinical outcome, explicit quantity, missing comparison baseline. | One clinical/comparative support assessment; do not invent the comparator. | One combined issue identifying the missing basis/support. |
| “Our best wishes.” | A superlative word may produce a lexical candidate. | Semantic interpretation rejects a ranking proposition. | None. |

## 4. Current Ontology v2 signals

The two tables in each inventory together answer all ten questions. Columns 1–5 describe meaning and intervention; columns 6–9 describe error costs and detection; column 10 gives the recommended utility.

### 4.1 Meaning, consumer, action, and visibility

| Signal | 1. Semantic information | 2. Consumer | 3. Concrete changed action | 4. Action class | 5. Does the user need to see it? | 10. Utility |
| --- | --- | --- | --- | --- | --- | --- |
| `priceClaim` | An asserted or denied specific/starting/past/current/future price; preserve currency, item, qualifier, and stated period. | Safety reviewer; prospective fact matcher. | Check the exact price proposition against authorized scoped price data. With none supplied, identify the unsupported price for repair; never replace a starting price with a fixed price. | Deterministic matching after interpretation; policy-level decision; prompt-level repair. | Only if the price requires correction, support, or author confirmation; never the raw label. | **production-essential** where copy can state prices. |
| `discountClaim` | A discount/price-reduction proposition, including denial or expiry; preserve stated terms. | Safety reviewer; prospective offer matcher. | Require authorized offer amount, eligibility, and period; correct unsupported terms or end-state copy. Do not infer a live campaign from the type. | Deterministic term/date checks; policy-level decision; prompt-level repair. | Only an actionable offer conflict or missing required term. | **production-essential** where copy can state offers. |
| `comparativeClaim` | A relative ranking, difference, advantage, or disadvantage; comparison can be implicit in a superlative. | Safety reviewer; prospective comparative Proof matcher. | Inspect comparator, metric, and permitted support before accepting the comparison; remove or revise an unsupported comparative proposition. | Policy-level support decision; prompt-level repair; routing-level only for material unresolved meaning. | Only if a specific comparison needs repair or support. | **production-essential** for material comparative claims; ordinary contextual comparisons need no warning. |
| `superlativeClaim` | Highest/lowest/top-ranked position within a class; overlaps comparison. | Same comparative safety/support consumer. | Apply ranking-specific basis/support checks; handle “best” and “fastest” under one comparative issue instead of duplicate warnings. | Policy-level; prompt-level repair. | Only a consequential unsupported ranking. | **useful** as a subtype of the essential comparative family; no separate detector call required. |
| `guaranteeClaim` | Explicit guarantee/warranty or absolute certainty; denial retains the semantic type. | Safety reviewer and applicable operator/brand constraint policy. | Distinguish an approved commercial warranty, a denied guarantee, and an unsupported certain outcome. Repair or require review only under the applicable rule. | Policy-level; prompt-level repair; conditional routing-level escalation. | Only a material guarantee needing action; no warning for a clear disclaimer. | **production-essential**. |
| `outcomePromiseClaim` | A future audience result/benefit asserted or promised; not every future business fact is a promise. | Safety reviewer; outcome permission/support assessment. | Inspect ordinary promises that guarantee detection would miss; remove or revise an unsupported audience-result promise without inventing an endpoint. | Policy-level; prompt-level repair. | Only a consequential unsupported promise. | **production-essential** where copy may promise audience outcomes. |
| `clinicalOutcomeClaim` | Patient health, symptom/pain, function, or recovery outcome; hedging retains the type. | Safety reviewer; clinical constraint and scoped Proof assessment. | Apply the relevant clinical support/review requirement; keep an unsupported clinical benefit out of approved copy. Semantic detection cannot establish clinical accuracy. | Policy-level; prompt-level repair; conditional routing-level escalation. | Only the required edit/support/review decision. | **production-essential** for health-related content; disable as a separate task for unrelated domains. |
| `quantifiedClaim` | Explicit numeric or mathematically determinate amount/rate/duration/count/magnitude; not every digit in a string. | Numeric fact/Proof checker within safety review. | Bind a number to a consequential proposition and verify units, scope, and permitted derivation; catch unsupported counts/durations not already covered by price or clinical checks. | Deterministic extraction/arithmetic/matching; policy-level; prompt-level repair. | Only a material unsupported or contradictory value. | **useful**; do not run a broad separate numeric classifier when narrower consumers cover the proposition. |
| `availabilityClaim` | Asserted/denied booking or service capacity; no inference from opening hours or unstated numeric zero. | Safety reviewer; prospective capacity-fact matcher. | Check capacity at the claimed time or mark invented/stale bookability for repair. Do not generate “slots available” from an operating schedule. | Deterministic scoped freshness/matching; policy-level; prompt-level repair. | Only actionable unsupported/stale capacity. | **production-essential** where copy states booking/service capacity. |
| `descriptiveAssertion` | Descriptive content presented as asserted, positive or negative, independently of completeness or verification responsibility. | No distinct current production consumer beyond more specific claim families. | None attributable to this broad label. Do not open a proof request or blanket fact-check from it. | None currently; future use would need a specified policy-level consumer. | No. | **not needed** as an independent production signal. Preserve the ontology concept without running it. |
| `claimPolarity` | `affirmed` or `negated` for each normalized proposition/clause, not sentiment or whole-text tone. | Every activated fact/Proof/constraint consumer. | Match the actual asserted relation: do not activate an ended discount, treat unavailable slots as available, or punish a denied guarantee. Mixed clauses retain separate polarity. | Deterministic downstream decision using semantic interpretation; policy-level where relevant. | Never as a label or warning. | **production-essential** internal attribute, not a separate binary classifier contract. |
| `unspecifiedOutcome` | A promised/guaranteed result is insufficiently identified; does not imply clinical content. | Outcome/guarantee safety reviewer and Writer repair. | If the affirmative promise needs a defined authorized endpoint, request it or remove the unsupported promise. A disclaimer or harmless wording does not require completion. | Prompt-level repair; policy-level only within a covered outcome rule. | Only the missing detail if it is necessary; otherwise internal. | **useful** conditional reason code. |
| `missingComparisonBaseline` | A comparator/reference needed to interpret a comparison is absent or unrecoverable from context. | Comparative safety/support assessment. | Prevent unsupported comparator inference; ask for the permitted baseline or repair the comparison. | Prompt-level repair; policy-level support decision. | Only a needed comparator clarification, consolidated with the claim issue. | **useful** conditional reason code. |
| `undefinedSuperlativeBasis` | A ranking has no stated criterion/measure; distinct from comparison class. | Comparative/ranking assessment. | Ask for a supportable criterion or remove the material ranking; do not ask for evidence of subjective praise solely because “best” appears. | Prompt-level; policy-level for covered rankings. | Only an actionable ranking-basis edit. | **useful** conditional reason code. |
| `vagueQuantifier` | Non-specific frequency/quantity without a meaningful bound/reference where interpretation needs one. | Possible claim-support or editorial consumer; no distinct general intervention is established. | Experimentally identify consequential scale claims that need scope/support. Routine “many” or “often” receives no numeric-precision demand. | Prompt-level only after relevance is established; policy-level only with an explicit rule. | Normally no; only a demonstrated necessary clarification. | **experimental**; do not run globally. |
| `unclearScope` | People, services, period, geography, or other claim domain cannot be recovered clearly. | Activated fact/Proof matcher and safety reviewer. | Stop binding a price, offer, outcome, or capacity claim to a guessed scope; repair or request only the missing dimension needed by that consumer. | Prompt-level clarification; policy-level support decision. | Only the required missing scope. | **useful** within a consequential claim, not a universal clarity detector. |
| `ambiguousReference` | A referring expression has multiple plausible antecedents or no recoverable referent. | Possible entity-binding or editorial consumer. | Resolve which service/offer/outcome a consequential statement concerns before matching it. Escalate only if that binding actually changes a decision. | Prompt-level; conditional routing-level/policy-level. | Usually an edit, only if ambiguity materially affects the post. | **experimental** as a standalone signal; targeted binding resolution can already occur inside an activated consumer. |

### 4.2 Error costs and safe detection choices

False-positive costs below include the worst consequence if a mistaken internal signal is allowed through intervention checks. Candidate noise should normally end internally. False-negative costs describe the missed opportunity for the named consumer; existing review may still catch the issue.

| Signal | 6. False positive consequence | 7. False negative consequence | 8. Can a deterministic rule safely do the job instead? | 9. Requires Jev / semantic classification? |
| --- | --- | --- | --- | --- |
| `priceClaim` | A question/example/enquiry is misclassified as a price assertion, or a correctly detected denied price is mishandled as an affirmative tariff; valid copy is unnecessarily repaired. | Invented, wrong, or stale price reaches approval without focused assessment. | Yes for trusted structured prices and typed templates. Currency/amount patterns safely nominate prose candidates, not assertion/polarity/scope. | Semantic interpretation for unrestricted prose; Jev is a candidate, not a requirement for structured data. |
| `discountClaim` | An expired offer or question becomes a live discount, or valid explanatory copy is held. | Unsupported discount/terms publish; users expect an offer the business cannot honor. | Yes for structured offer terms and date arithmetic; no for varied negation, conditions, or offer binding in prose. | Yes for unresolved free-text meaning; no additional classifier for bound structured offers. |
| `comparativeClaim` | Metaphor, benign contrast, or quotation is over-policed; the post loses its intended argument. | A material superiority/difference claim avoids support assessment. | Explicit patterns are candidates only; safe semantic interpretation of implicit comparisons needs context. | Yes for implicit or contextual prose comparisons. |
| `superlativeClaim` | Idiom or subjective praise triggers an unsupported-ranking warning. | A ranking-specific criterion/support requirement is missed. | Keyword/stem rules are good candidates; they cannot safely establish ranking role and scope in general. | Yes for meaningful ranking vs idiom; usually in the same pass as comparison. |
| `guaranteeClaim` | A denied guarantee is blocked, or a permitted warranty is removed as if it promised clinical success. | Unsupported certainty/warranty enters approved copy. | Explicit terms provide candidates; denial, object, absolute certainty, and scope need interpretation. | Yes for open-text meaning; deterministic typed warranty checks can suffice. |
| `outcomePromiseClaim` | Operating dates, hopes, or illustrative scenarios are mistaken for promised customer results. | A non-guaranteed but unsupported benefit promise escapes review. | No reliable general rule; future tense alone is unsafe. | Yes for prose. |
| `clinicalOutcomeClaim` | General “results” or a non-clinical benefit is assigned a clinical endpoint; unnecessary clinical intervention follows. | Unsupported patient benefit/recovery claim misses domain review. | Clinical terms nominate candidates; they cannot safely infer outcomes or assertion scope. | Yes for open prose, especially hedges, implicit effects, and disclaimers. |
| `quantifiedClaim` | Phone numbers, model names, dates, labels, or hypothetical numbers cause needless proof requests. | Unsupported operational/performance counts, magnitudes, or durations evade targeted checks. | Yes for number/unit extraction and arithmetic; no for consequential assertion role from arbitrary digits. | Only when proposition role/binding remains unresolved. |
| `availabilityClaim` | Opening hours, equipment ownership, or campaign urgency is treated as bookable capacity. | Invented appointments, capacity, or scarcity publish. | Yes for structured capacity status/freshness; lexical urgency alone is insufficient. | Yes for varied prose capacity semantics. |
| `descriptiveAssertion` | Broad positive labels create blanket verification obligations and user friction. | No distinct current action is lost; specific consumers still operate. | No general deterministic rule establishes descriptive assertion, but there is no current reason to solve it separately. | Semantic in principle; **do not request classification in production** without a new consumer. |
| `claimPolarity` | A scoped negation is applied to the wrong proposition, flipping an offer or a guarantee decision. | Denial is treated as affirmation; mixed time/polarity clauses collapse. | Safe for structured affirmative/negative fields. Negation words alone are unsafe for arbitrary clauses. | Yes for open-text scope; return with the proposition, not in a separate global pass. |
| `unspecifiedOutcome` | A contextually clear outcome or a disclaimer is unnecessarily expanded; repair may invent an endpoint. | An unsupported promise passes without the detail needed for support matching. | Structured outcome slots can be checked deterministically; contextual recoverability cannot. | Yes when needed within promise/guarantee interpretation. |
| `missingComparisonBaseline` | A recoverable baseline is requested again, or an implicit superlative class is misread as missing. | A comparison is assessed using an invented comparator. | Yes for required typed comparison fields; not for baseline recoverability in prose/context. | Yes within a comparison assessment. |
| `undefinedSuperlativeBasis` | A stated basis is missed or subjective praise receives an unwarranted evidence demand. | A material ranking passes without the criterion its support would need. | Structured ranking metric checks are safe; keyword checks cannot determine contextual sufficiency. | Yes within ranking assessment, when consequential. |
| `vagueQuantifier` | Conversational copy becomes awkward or is held for unnecessary numeric precision. | A consequential population/frequency assertion lacks supportable scope. | Lexicons can nominate vague terms; the need for precision is contextual. “All/always” is broad, not automatically vague. | Semantic relevance assessment in a scoped experiment only. |
| `unclearScope` | Existing contextual scope is ignored; unnecessary author questions interrupt work. | Correct facts are attached to the wrong service, audience, branch, or period. | Yes for required structured fields; no general prose rule for recoverability. | Yes only when a consuming decision requires missing scope. |
| `ambiguousReference` | Acceptable conversational references are rewritten or sent for unnecessary escalation. | A claim is attached to the wrong entity or outcome. | Typed entity IDs suffice; general coreference rules do not. | Yes for targeted unresolved binding; no standalone production pass recommended. |

## 5. Additional operational candidates

These are proposed operational interpretations, not additions to the benchmark ontology. Keep `address/locationClaim` and `inventory/stockClaim` as inventory names here; no production identifier/schema is being selected.

### 5.1 Meaning, consumer, action, and visibility

| Signal | 1. Semantic information | 2. Consumer | 3. Concrete changed action | 4. Action class | 5. Does the user need to see it? | 10. Utility |
| --- | --- | --- | --- | --- | --- | --- |
| `openingHoursClaim` | An operating schedule, closure, holiday exception, or branch-specific hours assertion; separate from capacity. | Safety reviewer now; proposed hours-fact check when records are compiled. | Identify an unsupported schedule addition; with authorized hours, compare branch/day/exception/timezone and repair only a conflict or unresolved material detail. | Deterministic normalization/matching; policy-level; prompt-level repair. | Only incorrect/unsupported hours or needed exception confirmation. | **useful**; essential in an enabled hours-publishing workflow with authoritative schedules. |
| `contactDetailClaim` | A phone, email, URL, handle, or contact destination offered as a way to reach the business; distinguish incidental references. | Existing safety reviewer for invented contact links; proposed contact-registry validator. | Reject invented customer contact destinations; with an approved registry, normalize and match without substituting an unapproved endpoint. Syntax validity alone does not establish ownership. | Deterministic extraction/registry matching; policy-level; prompt-level repair. | Only an invalid, unauthorized, or unsupported destination requiring action. | **production-essential** where content includes contact destinations. |
| `address/locationClaim` | A customer-facing physical address/branch, geographic service area, or place of service; distinguish incidental place names. | Safety reviewer; prospective location/coverage fact matcher. | Identify invented branch/service-area details; with permitted records, bind the correct branch and coverage before accepting the location claim. | Deterministic scoped matching; prompt-level binding/repair; policy-level. | Only wrong/unsupported location or necessary branch clarification. | **useful**; essential when location-specific copy is enabled. |
| `campaignPeriodClaim` | A start/end/active period tied to a particular promotion/campaign. | Future campaign fact/validity consumer; current generic safety review can assess unsupported date/offer text without a campaign-specific label. | Future: compare campaign identity and validity with intended publication time; repair expired/premature offer copy. No unique campaign-specific action is currently available. | Future deterministic date checks and policy-level decision; prompt-level repair. | Only a date/offer correction; never a campaign-period badge. | **not needed** currently as an independent signal: organic post context has no campaign identity or connected period source. Reassess when that workflow exists. |
| `inventory/stockClaim` | Physical product quantity/in-stock/out-of-stock state for an item and location; distinct from service booking capacity. | Future inventory consumer; no current live inventory-to-post check is established. | Future: require correctly bound fresh stock data or omit unsupported scarcity/count claims. Current unsupported facts remain covered by safety review without a stock-specific classifier. | Future deterministic item/location/freshness checks; policy-level; prompt-level repair. | Only needed stock refresh/correction. | **not needed** currently as an independent signal. Vocabulary alone does not justify a feed or classifier. |
| `deadline/dateClaim` | A date/deadline controlling an event, eligibility, response, or promised operation; not an incidental/historical date. | Safety reviewer; proposed operative-date validator. | Check impossible dates and stated date relations; identify unsupported deadlines. Where publication time changes validity, request review/correction before scheduling rather than silently changing the post date. | Deterministic calendar/time arithmetic after binding; prompt-level clarification; policy-level. | Only a necessary date, timezone, or deadline correction. | **useful** for time-sensitive copy; no global classification of every date. |
| `externalStatisticClaim` | An asserted external count/rate/trend about a study, population, industry, or public-world phenomenon; not merely any number. | Safety reviewer and scoped source/Proof assessment; a research consumer is not established here. | Identify a statistic lacking permitted source support; remove it or request the actual source for authorized review. External verification would require a separately approved evidence workflow. | Policy-level; prompt-level repair; future routing-level sourcing only with a real consumer. | Only when source input or a material edit is needed. | **useful** when drafts assert external statistics; do not run for content with no such claims. |
| `attributedClaim` | A proposition assigned to a source/speaker, plus whether the brand adopts it; separate outer reporting assertion from embedded content. | Safety reviewer and provenance/Proof matcher. | Preserve quotation/source identity; avoid treating attribution as first-party adoption or as an evidence exemption; flag fabricated testimonials or unsupported source reports under the relevant policy. | Prompt-level interpretation/repair; policy-level; conditional routing-level for nested scope. | Only missing/fabricated source, changed attribution, or a permission issue requiring author input. | **useful** generally; essential in enabled testimonial/quotation/statistic workflows. |
| `credentialClaim` | Claimed license/certification/accreditation held by a named business/person/product, including issuer and applicable scope. | Existing credential candidate scanner and safety reviewer; prospective credential Proof matcher. | Check that a concrete credential is authorized and applies to the named holder; remove invented credentials. Do not infer licensure from service vocabulary. | Deterministic structured holder/issuer/validity matching; policy-level; prompt-level repair. | Only unsupported/incorrect credential or necessary issuer/holder detail. | **useful**; essential for credential-led content. Added because the current review forbids fabricated credentials and a scanner family already exists. |
| `awardClaim` | Award/ranking recognition attributed to a recipient, issuer, category, and period; separate from generic “best.” | Existing award candidate scanner; safety reviewer and prospective award Proof matcher. | Match recipient/title/year/category; remove an invented award or unsupported expansion into a universal ranking. | Deterministic structured matching; policy-level; prompt-level repair. | Only a concrete award correction or support request. | **useful** when award claims are present; no separate pass otherwise. |
| `experienceClaim` | Claimed duration/scale of relevant business or practitioner experience; distinguish business age from individual experience. | Existing experience candidate scanner; quantified fact/Proof consumer. | Check holder, start date, and permitted duration/scale; compute elapsed years deterministically rather than inventing experience. | Deterministic arithmetic/matching; policy-level; prompt-level repair. | Only a material unsupported duration or holder mismatch. | **useful** as a typed quantitative case, not a separate model call. |

### 5.2 Error costs and safe detection choices

| Signal | 6. False positive consequence | 7. False negative consequence | 8. Can a deterministic rule safely do the job instead? | 9. Requires Jev / semantic classification? |
| --- | --- | --- | --- | --- |
| `openingHoursClaim` | Appointment time or historical/holiday exception is mistaken for regular hours; valid copy is challenged. | Customers receive invented/stale hours or the wrong branch schedule. | Yes for structured schedules, typed exceptions, and matching; free-text schedule role/branch binding may need semantics. | Usually no for controlled fields; conditional for varied prose. |
| `contactDetailClaim` | A valid alternate contact is removed, or an incidental/example URL is treated as the business endpoint. | Wrong/invented destinations direct customers elsewhere or prevent contact. | Yes for exact approved endpoints, syntax, bounded normalization, and typed templates. URL reachability cannot prove ownership. | Generally no; only unresolved contact role/ownership attribution in prose needs interpretation. |
| `address/locationClaim` | An incidental place or service area is misread as a branch address; a correct branch is flagged. | Copy directs customers to the wrong place or claims unsupported geographic coverage. | Yes for known branch IDs and approved address/coverage fields. Fuzzy matches or geocoding results cannot establish business authority. No geocoding/provider call is proposed in this task. | Conditional for branch vs service-area vs incidental-reference meaning. |
| `campaignPeriodClaim` | Teasers, evergreen copy, or another campaign's dates cause an unnecessary hold. | Once the campaign workflow exists, premature/expired terms can publish; currently no distinct campaign-label consequence beyond generic offer/date review. | Yes once campaign ID, authorized boundaries, inclusivity, and publication time are structured. | Conditional for free-text period-to-campaign binding; **do not run a campaign classifier now**. |
| `inventory/stockClaim` | Equipment ownership or service capacity is mistaken for physical stock; volatile copy is repeatedly held. | Unsupported stock/scarcity survives generic review; a future stock-specific consumer would miss stale counts. | Yes with item/location IDs, a trusted inventory snapshot, and freshness policy; none is established in current post context. | Conditional for prose product/status binding; **do not run a stock classifier now**. |
| `deadline/dateClaim` | Historical dates/examples trigger deadline interventions; valid time-sensitive copy is delayed. | Impossible, ambiguous, or expired deadlines reach approval/scheduling without focused review. | Yes for structured dates, calendar validity, timezone conversion, and interval checks. Relative dates need an explicit reference and intended publication time. | Conditional for role/binding in prose; date extraction alone usually needs no model. |
| `externalStatisticClaim` | A first-party price, illustrative number, or opinion is sent for unnecessary sourcing. | Unsupported public-world statistics are presented as fact. | Numeric/source markers nominate candidates; externality, population, assertion, and attribution need context. | Yes for ambiguous prose classification; a classifier cannot retrieve or validate evidence. |
| `attributedClaim` | Brand assertions are incorrectly excused as quotation, or real attribution is removed. | Testimonial/reported text becomes a brand assertion; fabricated attribution or quoted unsupported content evades the right checks. | Yes for trusted structured source/quote objects; quote marks and “according to” alone are insufficient for adoption or nested scope. | Yes for open-text attribution/adoption; conditional stronger review for consequential nested cases. |
| `credentialClaim` | Aspirational training, quoted credentials, or an unrelated holder is treated as the brand's current credential. | Invented/expired credential is presented as current or applies to the wrong holder. | Yes for structured credentials and known holders; lexical terms only nominate prose candidates. | Conditional for assertion and holder binding. |
| `awardClaim` | Generic praise or another entity's award becomes a brand recognition claim. | Invented recognition/year/category or an unsupported “best” expansion publishes. | Yes for an approved award record and typed rendering; no general keyword-only judgment. | Conditional for recipient/category/attribution binding. |
| `experienceClaim` | A date, business founding year, or hypothetical duration becomes practitioner experience. | Unsupported years/scale or misleading conflation of business and individual experience publishes. | Yes for verified start dates, holder IDs, and calendar arithmetic; no general prose equivalence rule. | Conditional for holder and asserted-duration interpretation. |

## 6. Consequence limits and source requirements

Semantic type alone says nothing about truth, authority, freshness, sufficiency of Proof, or permission to publish. These remain separate consumer inputs. In particular:

- A first-party operational fact can be checked against authorized business data; do not demand an external research source merely because it is asserted or numeric. Equally, first-party authorship alone does not authorize an objective clinical or comparative outcome.
- A deterministic record comparison is safe only after subject, polarity, units, qualifiers, time, branch, and conditions are correctly bound. A matching amount attached to the wrong service is unsupported.
- Preserve negative meaning. Checking “150 GEL is not the price” requires assessing that denied proposition; a positive tariff lookup must not silently rewrite it into an affirmative amount. “No slots available” does not imply an extracted numeric zero.
- Attribution is not proof or permission. A reported statistic needs the actual supporting source; testimonials may need applicable authorization/permission. A quotation can also be adopted by the surrounding brand copy.
- Missing data is unresolved support, not a proven contradiction. A stronger model cannot supply missing business records or authorize an invented fact. Keep the issue with the appropriate human/source owner or repair using already permitted material.
- Time-sensitive support must cover intended publication, not only draft creation. Relative “today/tomorrow,” campaign boundaries, and capacity/stock statements need a reference time and an explicit freshness rule. This is a proposed content validity check, not implemented scheduling behavior.
- Completeness labels are diagnostic reasons inside a relevant assessment. Do not auto-complete vague promises, fabricate comparison baselines, or impose a precision rule on every conversational phrase.

A user issue should identify the exact span, what is unresolved or conflicts with the applicable source/rule, and the smallest needed action. Example: “The draft promises a 20% discount, but no approved offer terms were supplied. Remove the discount or provide the approved amount, eligible services, and period.” Overlapping price/discount/quantity/scope detections should produce one issue if they require the same repair.

## 7. Final recommendations

### 7.1 Recommended minimum production signal set

For the current organic drafting/review workflow, the smallest recommended integrated set is:

1. **Material claim families:** `priceClaim`, `discountClaim`, `comparativeClaim`, `guaranteeClaim`, `outcomePromiseClaim`, and `availabilityClaim`.
2. **Clinical subtype when relevant to the brand/task:** `clinicalOutcomeClaim`.
3. **Customer contact destinations when present:** `contactDetailClaim`, preferably from deterministic extraction and approved structured fields.
4. **Per-proposition interpretation:** `claimPolarity`, with entity/time/qualifier binding wherever the consumer needs it.

Return `superlativeClaim` as a useful subtype within comparative interpretation when ranking-specific support changes the decision; it does not need a separate call. Return `unspecifiedOutcome`, `missingComparisonBaseline`, `undefinedSuperlativeBasis`, and `unclearScope` only when they explain a material unresolved claim. These are not independent always-on detection tasks.

For workflows that actually publish the relevant facts, extend the minimum with `openingHoursClaim` and `address/locationClaim`; include `attributedClaim` for quotes/testimonials/reported claims and `externalStatisticClaim` for external-statistic content. Integrate source-backed checks only after approved, scoped, fresh records can reach the consumer. Current empty fact/Proof arrays must remain an explicit limitation, not be papered over by classification.

`quantifiedClaim`, `credentialClaim`, `awardClaim`, `experienceClaim`, and `deadline/dateClaim` are targeted extensions when the post contains those consequential propositions and the consumer has a distinct check. Do not reclassify quantities already fully handled by a price/offer/outcome check.

This is a recommendation for a later bounded integration. It does not authorize changing prompts or routing, adding providers, connecting feeds, or weakening existing review/approval.

“Minimum set” names the information that consequential consumers should retain; it is not a list of always-on model calls. It supplements the existing whole-draft safety review. Selecting a smaller signal set must not remove review of unsupported credentials, numbers, locations, or other facts outside that set.

### 7.2 Signals that should remain internal only

- `claimPolarity`: always internal; never shown as a warning.
- `unspecifiedOutcome`, `missingComparisonBaseline`, `undefinedSuperlativeBasis`, and `unclearScope`: internal reason codes; expose only a necessary detail/edit within the consolidated claim issue.
- `vagueQuantifier` and `ambiguousReference`: internal, scoped experiments; no standalone warnings.
- `attributedClaim`, subtype relationships such as superlative/comparative, entity/time bindings, confidence/disagreement, and routing metadata: internal by default. Show only an actual source/permission/binding question when required.
- `descriptiveAssertion`: retain as an ontology concept; if examined for research, keep it internal. No production run is recommended.

All other raw signal names also remain internal. Users see consequential source conflicts, required input, precise repairs, and review decisions—not the detector inventory.

### 7.3 Signals suitable for deterministic detection

Use deterministic extraction/rendering first for controlled, source-linked fields: prices, discounts/offer terms, explicit quantities, contact endpoints, hours, known locations, operative dates, credential/award records, and experience calculations. Structured capacity states can also be checked deterministically. Campaign periods and stock become suitable only once their dedicated identities and authorized records exist.

In unrestricted prose, currency/percentage/number/date/contact patterns and Georgian guarantee/ranking/comparison/capacity stems are candidate detection. They do not safely replace interpretation of assertions, negation, quotation, implied comparisons/outcomes, or scope. Safe deterministic checking is distinct from comprehensive deterministic semantic detection. Do not add live link checks, geocoding, inventory queries, or other provider calls in this design task.

### 7.4 Signals suitable for Jev

Evaluate Jev for bounded open-text claim interpretation: `priceClaim`, `discountClaim`, `comparativeClaim` with `superlativeClaim`, `guaranteeClaim`, `outcomePromiseClaim`, `clinicalOutcomeClaim`, `availabilityClaim`, and proposition-level `claimPolarity`.

Include only consumer-required completeness fields in the same interpretation: `unspecifiedOutcome`, `missingComparisonBaseline`, `undefinedSuperlativeBasis`, and `unclearScope`. Consider `attributedClaim`, `externalStatisticClaim`, and unresolved operative-date/location/hours/credential/award/experience binding when those fields change an activated assessment. Jev is unnecessary for well-typed structured values, arithmetic, registry lookups, freshness, permissions, or state changes.

Do not assume Jev is reliable because classification is inexpensive. Admission needs representative real Georgian content, paraphrases without lexical triggers, mixed polarity, quotations, implicit claims, and error costs assessed at the downstream action. Keep benchmark evaluation separate; this document changes no dataset, schema, prompt, or benchmark run.

### 7.5 Signals that should escalate to a stronger model

No signal escalates solely because it is detected. A proposed stronger-model task is warranted only if meaning remains unresolved, the outcome could materially change an edit/review decision, and bounded interpretation has not resolved it:

- Clinical outcome / guarantee / outcome promise with ambiguous endpoint, certainty, denial, or adoption that changes applicable policy.
- Mixed-polarity, multi-clause price/discount/availability claims, especially changing past/current/future state.
- Comparative/superlative claims whose missing baseline or ranking basis may be recoverable from supplied context.
- Nested/ambiguous attributed claims, including an outer source-report assertion and embedded clinical/statistical/guarantee content.
- Entity/reference/scope ambiguity that could bind a material price, location, date, credential, or offer to the wrong subject.

The task must be explicit: resolve the proposition/binding from supplied text, or report unresolved meaning. Return the result to the same validation/policy consumer. Do not ask the stronger model to invent facts, substitute confidence for Proof, decide business authority, or bypass approval. Missing authoritative data goes to source/human resolution or a permitted repair, not repeated model escalation. This section defines no routing implementation or new calls.

### 7.6 Signals with no current operational value and no reason to run

- **`descriptiveAssertion` independently:** no distinct consumer/action beyond narrower consequential claim families.
- **`campaignPeriodClaim` independently in the current organic workflow:** no campaign identity or dedicated period source; reuse applicable offer/date review until those dependencies exist.
- **`inventory/stockClaim` independently now:** no established inventory-to-post consumer or fresh item/location source; business-fact vocabulary is insufficient.
- **Global `vagueQuantifier` or `ambiguousReference` passes:** no established general intervention. Restrict to research or demonstrated consequential binding problems.
- **Separate `superlativeClaim` model calls and duplicate comparative warnings:** the comparative consumer can retain the subtype and produce one action.
- **Unconditional completeness classification:** an omitted outcome, baseline, basis, or scope has no independent value when no consuming decision needs it.
- **Unconditional quantity/date/external-statistic/attribution/credential/award/experience classification:** run only for relevant propositions with an activated distinct consumer; incidental dates and numbers do not qualify.
- **Any signal returned but discarded, any label added only because it is cheap, or any escalation without a decision-changing task:** no production reason to run.

Detection may be broad internally. Production admission and user intervention remain tied to identifiable consumers and concrete consequences.
