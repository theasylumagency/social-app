# Phase 7E — Jev request routing and bounded weekly constraints

Jev is promising for interpreting a small, explicit planning vocabulary and binding caller-supplied quantities to Facebook/Instagram. It has not demonstrated that it can replace the whole contextual-notes interpreter or improve finished-plan quality. Keep strategy, context ownership, arithmetic, calendar resolution, creative generation, and execution in the application/existing interpreter.

The five user-authored prospective messages were confirmed by the human before weekly provider outputs. Their encoded required fields were correct in all three runs of each weekly protocol. Additional fields introduced unintended meanings: a current-week horizon on U04, and a strategy-reconsideration stance on U05. These must not become new instructions.

Fresh paired baseline timing is **pending explicit permission**: automatic approval review rejected sending the five messages to the external OpenAI interpreter. No fresh baseline calls were made, no workaround was attempted, and there is no measured end-to-end speedup or final-content quality improvement.

## Scope and provenance

This is an isolated application experiment in experiments/jev-request-routing-phase-7e/. It is distinct from the frozen Claim Semantics benchmark, Phase 7B claim-family probing, and Phase 7D blind real-content review.

- 32 engineered routing cases: 10 expected local edit candidates; 22 fallbacks/controls. Negation, scope, questions, enduring rules, weekly constraints, policy changes, mixed meanings, publication/deletion, missing context, stale revision and injected instructions are represented.
- Five exact human-authored prospective weekly messages, with original spelling preserved. They are not previously executed production notes.
- The user confirmed the interpretations with “დიახ, ხუთივე სწორია”. Required fields reflect that confirmation. Additional absence/overreach controls are labelled engineering expectations separately.
- The local database contained two notes, both “მოკლე.” and both matching known controlled text. Neither has verified natural-user provenance. They are excluded from claims about real user outcomes.
- No actual selected plan, baseline counts, approval/version state, brand context, or calendar reference was supplied. Relative dates remain unresolved; machine time is never a semantic reference.

References are engineering expectations and human-confirmed meanings, not independent final-content quality gold, Ontology v2 gold, or evidence of unrestricted model performance.

## Protocol audit

Pinned model: jev-1.13.0; endpoint: POST https://api.typesafe.ai/v1/systemone. Requests contain a caller-owned state plus keyed, typed questions.

The current documented interface supports Noul decisions, Choice selection among supplied labels, and Score output. Only Noul and Choice are exercised here. Choice returns the selected label, probabilities for supplied alternatives, and a separate native confidence. Noul returns a numeric probability. Native usage receipts include input/output tokens. These are several decisions sharing one transport request; they are not one jointly calibrated semantic interpretation.

Observed Choice probabilities are serialized to two decimal places. A valid response can therefore sum to 0.99. The original strict validator halted at C06. The isolated v2 validator allows only the mathematical rounding bound, retaining every raw probability; it never renormalizes. Unexpected keys, invalid values, missing decisions, and invalid maxima still fail validation. This was an application schema-validation fault, not a semantic model error or provider outage.

Arbitrary generated argument strings, unrestricted source spans, entity IDs, full SemanticObservation generation, free-text answers and proposition discovery are not supported by this adapter. Exact source strings, number normalization, candidate IDs, observations and diagnostic templates are application-owned. An unresolved Choice is a caller-supplied label, not native UNCERTAIN.

Sources: [official API](https://docs.typesafe.ai/api), [models and published rates](https://docs.typesafe.ai/models), [Jev 1.13 limitations](https://docs.typesafe.ai/model-jaggedness/jev-1.13), [intent-routing pattern](https://docs.typesafe.ai/patterns/intent-routing).

## Preserved experimental series

| Series | Composition | Complete runs | Requests | Decisions/request | Requested decisions |
| --- | --- | ---: | ---: | ---: | ---: |
| Routing v1 | Halted after 6 of 32 cases due to rounded probability validation | 0 | 6 | 4 | 24 |
| Routing v2 | Same 32 cases, prompts, references and gates; transport correction only | 3 | 96 | 4 | 384 |
| Option-order controls | Five predeclared reversed-Choice controls | 1 small audit | 5 | 4 | 20 |
| Weekly v1 | All five user messages; eleven related decisions | 3 | 15 | 11 | 165 |
| Weekly v2 supplement | Same five; adds per-week versus aggregate counting basis | 3 | 15 | 12 | 180 |
| **Total** | All attempts retained | | **137** | | **773** |

Weekly v1 did not expose a counting-basis field. The supplementary version adds that missing axis so U03's confirmed “2 per week” cannot be mistaken for “2 total over 3–4 weeks”. All eleven original questions, original expectations and observed errors remain unchanged and preserved. The supplement was separately frozen before its outputs. It is not a replacement score for v1.

Frozen hashes:

- Routing v1: 409196f361be6fa6a03b105904c81d8e0dc9e7e537ec28964bb3a7c4288ac162
- Routing v2: 5bbe28a420d14dd8168d02deb4d328ea85cfaf3b21d6dbe25859e035a4369adf
- Weekly v1: 2d9b497311517fca0ef68a707f963c0e6f5e637c7f2971a0c9de35b7c27ab830
- Weekly v2: 4184eb9670e23b0f64903fbedfdbbb4aff7775d8dd0e46a3af8bfbf6bfddcb71

## Routing results

On 96 primary routing-v2 requests, operation classification matched the engineering expectation in 86, scope in 71, standalone-edit decision in 87, and additional-meaning decision in 72. These fields have different purposes; their correctness is not collapsed into one score.

The combined diagnostic route selected 27 of 30 expected positive presentations and none of 66 fallback controls. C06 (“ძალიან ოფიციალურია.”) consistently missed the local edit candidate: operation was lessFormal, but standaloneEdit did not support it. This loses a possible latency benefit while retaining the existing interpreter. No trial route executed anything.

There were six diagnostic tensions between a local-edit operation/scope and a negative standalone-edit decision. Multi-question transport does not guarantee semantic coherence. Scope and additional-meaning outputs are too weak to own application scope or atom preservation.

All 32 diagnostic routes remained stable across primary runs; full decision vectors were stable in 28/32 cases. C14, C15, C19 and C21 had decision flips. Four of five option-order controls retained operation/scope labels; C32 changed its operation between multipleMeanings and unsupported. All five audit routes remained on the same diagnostic path.

The 0.5 Noul split and Choice argmax are diagnostic descriptors only. They are not production thresholds, calibrated joint confidence, or permission to apply changes.

## Weekly results

| Human message | Confirmed content demonstrated in both series | Limits / extra-field errors |
| --- | --- | --- |
| U01 | Instagram set 3; Facebook set 5; current week; keep direction | No actual plan/version supplied |
| U02 | Reconsider direction; strengthen Facebook; no numeric cadence | Strategy execution still needs full interpretation/context |
| U03 | Instagram 2; Facebook delegated; 3–4-week duration; supplement correctly selects per-week basis | No calendar interval resolved; delegated Facebook requires planner |
| U04 | Both channels increase by 1; shared source candidate binds both | Model inferred currentWeek although text does not specify it; final counts require baselines |
| U05 | Facebook +1; Instagram −2; explicit video→carousel; now; future video remains possible/unconfirmed | Model added reconsider direction; duration alternated between notSpecified and unresolved |

Across weekly v1, all 93 encoded human-confirmed field decisions were correct. Across supplementary v2, all 102 encoded confirmed field decisions were correct, including counting basis for explicitly timed messages. In each version, 15/15 requests matched all required encoded fields, but only 9/15 matched every declared field including engineering overreach controls. These numbers must be reported together.

The twelve-field supplement kept all confirmed fields stable across three passes for all five messages. Full vectors were stable in 4/5 messages. Per-option probability ranges reached 0.09; population variance and raw probabilities are retained in the machine-readable summary. These are only five distinct examples, not 15 independent human tasks.

Quantity phrases and offsets are deterministic, caller-supplied candidates. Unicode code-point spans reproduce exact source text. The bounded parser supports only documented Georgian forms/digits/ranges and caps the candidate set at eight. Candidate binding does not establish free-form extraction.

The video quantity “ორ” and tentative future-time quantity “ერთი” were not confused with the channel deltas “ერთით”/“ორით”. The app never invents final counts. Delta arithmetic requires baselines; existing 0–5 cadence bounds produce unresolved results rather than clamping. Delegated quantities need a planner. Calendar interpretation needs a supplied reference.

## Capability matrix

| Capability | Protocol support | Demonstrated quality | Stability | Next experiment readiness |
| --- | --- | --- | --- | --- |
| Closed operation classification | Choice | Promising for narrow local edits; 86/96 operation decisions | Some flips/order sensitivity | Disabled shadow; preserve text and fallback |
| Application scope / atomic meanings | Closed selections only | Insufficient: scope 71/96; additional-meaning 72/96 | Several flips | App ownership; stronger interpreter for mixed requests |
| Related decisions in one transport | Yes | 4, 11 and 12 targets; no corrected-series technical failures | Transport stable; semantics not guaranteed coherent | Demonstrated transport; diagnostic use |
| Supplied numeric candidate binding | Choice | All tested channel quantities correct in both weekly series | Tested quantities stable | Promising; verify grounding and real app context |
| Absolute / delta / delegated mode | Choice | Correct on these five examples | Stable confirmed fields | Promising, bounded vocabulary |
| Per-week vs aggregate basis | Choice | Correct on U03 in 3 supplementary runs | Stable | Promising; one periodic example |
| Bounded format / future-video state | Choice | Correct on U05 | Required fields stable | Promising; one example, preserve uncertainty |
| Broad strategy intent | Choice | U02 correct; U05 added unsupported reconsideration | Incorrect U05 stance stable | Insufficient; retain full interpreter |
| Explicit temporal horizon | Choice | Explicit horizons correct; U04 over-inferred horizon | Stable over-inference; U05 duration flip | App owns interval and calendar reference |
| Free-form argument/source extraction | No support in current adapter | Not demonstrated | Not applicable | Unsupported by current interface |
| Proposition discovery | No supported extraction interface here | Not demonstrated | Not applicable | Unsupported by current adapter |
| Arbitrary response / finished-plan generation | No | Not demonstrated | Not applicable | Existing generative path |
| Native abstention | No documented UNCERTAIN here | Caller labels only | Not applicable | App unresolved / technical failure stay separate |
| Probability / confidence output | Yes | Usable diagnostics; wrong U05 direction probability 0.91–0.93 | Numerical variation retained | No calibrated production routing |
| Final response quality improvement | Not established by classification | No independent paired content review | Unmeasured | Blind human comparison needed |
| End-to-end response-time improvement | Not established by isolated calls | No completed-plan A/B timing | Unmeasured | Paired baseline and end-to-end shadow receipts needed |

## Errors and downstream consequences

Every scored mismatch has an entry in results/analysis.json or results/summary.json. Taxonomy labels are engineering diagnoses, not human benchmark annotations.

- **Implicit-semantics miss:** C06 misses the selected-post edit candidate; existing interpreter remains necessary.
- **Family / operation confusion:** C15 may prioritize policy over mixed meanings, C30 depends on an absent target, and U05 adds strategy reconsideration. U05 could broaden a planning change into strategy revision if consumed blindly.
- **Attribution / presentation:** C18 can choose shorten for a question. C28/C32 show why publication/injection controls need app gates. Combined routes still fall back here.
- **Proposition-boundary dependency:** the additional-meaning question over-triggers on several single non-pilot statements. An operation/scope pair cannot preserve arbitrary atomic meanings.
- **Scope / binding:** C15, C20–C22, C25–C26, C29 and C32 expose unreliable inference of context needed to authorize a mutation.
- **Temporal-state error:** U04 adds current-week horizon; U05's irrelevant duration toggles. Do not convert either into a firm interval.
- **Application transport/schema failure:** one v1 response rejected rounded probabilities; raw values and native usage remain available. No provider HTTP/timeout failure occurred in corrected series.

No downstream action occurred: every result is diagnostic, production routing is absent, and existing ownership/revision/approval/Safety boundaries remain.

## Latency and cost

| Series | Requests | Mean | p50 | p95 | Published-rate estimate |
| --- | ---: | ---: | ---: | ---: | ---: |
| Halted routing v1 | 6 | 308.82 ms | 288.48 ms | 400.77 ms | $0.000421344 |
| Routing v2 incl. order audit | 101 | 294.77 ms | 288.47 ms | 347.28 ms | $0.007122192 |
| Weekly v1 | 15 | 356.94 ms | 314.70 ms | 819.30 ms | $0.002225790 |
| Weekly v2 supplement | 15 | 345.96 ms | 313.75 ms | 789.69 ms | $0.002359980 |
| **All Jev calls** | **137** | Cohorts separate | | | **$0.012129306** |

Native receipts total 288,793 input tokens and 46,917 output tokens. Estimate uses published $0.042/million input and free output; it is not an invoice. Latency covers provider request plus local validation/observation, excludes plan generation and user-visible completion. Quantiles use nearest rank; on 15 requests, p95 is the maximum. Different question-count cohorts use different prompts/inputs, so they do not establish paired batching speedup. Separate-vs-batched round trips were not benchmarked here.

The one historical controlled note has native stage receipts of 6,784 ms for interpretation and 7,710 ms for post revision. Their 14,494 ms sum is not end-to-end latency, not a weekly request, not fresh A/B data, and not verified natural-user provenance. No speedup ratio is computed from it.

Adding Jev while still running the same full interpreter can increase latency. Savings require a demonstrated safe skip/reduction of work. A quick acknowledgement is not completion of a new weekly plan.

## Confidence, abstention and quality

Choice probabilities, native confidence, Noul probability, semantic unresolved and technical failure remain separate. Vectors are never renormalized or converted into fabricated joint confidence.

Routing Choice confidence ranged 0.29–1.00 (mean 0.8153, p50 0.89). Supplementary weekly confidence ranged 0.01–1.00 (mean 0.8773, p50 0.96). U05's unwanted direction has native confidence 0.86–0.89 and selected probability 0.91–0.93. Confidence alone cannot establish intent fidelity. No production cutoff/dead-zone was selected.

Independent full-response quality and user-perceived completion remain unmeasured. The prepared fresh baseline uses the unchanged existing prompt/schema/reasoner and configured model, five logical tasks with existing bounded retries. Only the five texts and frozen minimal context would be sent; no brand data or DB mutations. It remains unrun pending authorization for that destination.

## Smallest next integration experiment

Use a disabled shadow path:

app-established context + bounded source candidates → Jev channel/mode/quantity/counting-basis suggestions → app-owned diagnostic constraints → existing planner and Safety review.

Original text accompanies constraints. The app owns real plan selection, identity, version/freshness, existing counts, arithmetic, cadence bounds, interval resolution, ambiguity/fallback and authority. Jev labels must not introduce strategy changes or calendar horizons. Broad strategy, missing antecedents, multiple scopes, unsupported operations and unverified context continue through the stronger interpreter.

For selected-post edits, a separate shadow candidate can test shorten/moreFormal/lessFormal/removeEmoji against unchanged gates and existing revision/Safety. The controls support testing this narrow shape, not activating it.

Next evidence: explicitly authorized paired interpreter timing on frozen inputs, blind human review of intent/clarification quality, then disabled shadow observations with real verified context and end-to-end receipts. Do not bypass the interpreter or claim a quality gain before that evidence.

## Files and verification

All new files are confined to this experiment: protocol/transport, datasets/freezing, runners, analysis, tests, provenance, blocked-baseline receipt, documentation and integrity checks. Generated files preserve every raw run, usage, decision, frozen sample, source inventory and analysis. The exact created-file list is in integrity/verification.json.

Offline experiment tests: 21 passed. Type checking and isolated lint passed; receipts are in verification-tests.json.

Existing npm run test:notes: 18/19 passed. The unrelated unchanged voice-silence test fails at line 13: source timeout is 3,000 ms while the test expects continuation near 6,000 ms. Its independent rerun reproduced the failure. Source and test were not edited; their pre-experiment hashes are checked. No repository-wide passing test run is claimed.

Final integrity verifies 644 original UNDA files and 200 original benchmark files, unchanged Git heads, no added tracked/nonignored files outside scope, and all four frozen samples/protocols. Production semantic shadow remains disabled. Production sources/configuration, benchmark provider adapters, v1 data/reviews, frozen v2 candidate, 834-item review state, Ontology v2 and Phase 7D artifacts remain unchanged. No production routing, DB mutations, publication decisions, deployment or user-facing behavior were introduced.
