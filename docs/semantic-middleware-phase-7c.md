Phase 7C — Jev Semantic Middleware Shadow Integration
====================================================

Implemented in UNDA Social Operator against `unda-semantic-observation-v1`. Shadow data is evaluation-only. Production enablement and admission are outside this phase. No live provider call was made. The local `.env.local` still resolves to `{ enabled: false, reason: "disabled" }` and was not edited.

References: [utility map](semantic-signal-utility-map-v1.md), [accepted contract](semantic-middleware-contract-v1.md), [Phase 7A](semantic-middleware-phase-7a.md), and the separate [Phase 7B capability report](../../unda-semantic-benchmark/experiments/semantic-middleware-phase-7b/REPORT.md). Phase 7B demonstrated bounded decisions and identified repeatable elliptical service-binding failure. This integration preserves that boundary; its synthetic fixtures are engineering verification, not further model-quality evidence or benchmark gold.

**1. Files created/changed.** Four existing files changed; fifteen files were added. The pre-existing Phase 7A package changes and unrelated workspace changes were preserved.

| Existing file | Change |
| --- | --- |
| `.env.example` | Disabled shadow configuration template; no credentials or approved thresholds |
| `package.json` | Shadow test and fixture commands; shadow tests included in normal test command |
| `src/application/weekly-planning/posts.ts` | Optional isolated observer of a cloned original Safety result; reviewer calls and consolidation unchanged |
| `src/worker/weekly-posts.ts` | Detached review snapshots; collection after normal worker stages finish and checkpoints are saved |

| New file | Responsibility |
| --- | --- |
| `src/blueprints/social/semantic-middleware/shadow.ts` | Bounded task, provider-neutral port, evaluation envelope and trace types |
| `src/blueprints/social/semantic-middleware/shadow-task.ts` | Task validation, keyed targets and deliberately narrow deterministic anchor grammar |
| `src/blueprints/social/semantic-middleware/shadow-metrics.ts` | Separate capability, eligibility, unresolved, failure, latency and usage metrics |
| `src/application/semantic-middleware/adapt-shadow.ts` | Existing-contract projection and binding safeguards |
| `src/application/semantic-middleware/collect-shadow.ts` | Raw probability collection, optional experimental derivation and bounded failure isolation |
| `src/infrastructure/models/semantic-shadow-config.ts` | Explicit opt-in, pinned model, path/budget validation and public metadata |
| `src/infrastructure/models/jev-semantic-shadow.ts` | Isolated official Jev HTTP adapter and native response validation |
| `src/infrastructure/semantic-shadow/jsonl-trace-store.ts` | Worker-local evaluation sidecar storage |
| `src/worker/semantic-shadow.ts` | Review/source linkage and existing-worker collection boundary |
| `tests/fixtures/semantic-shadow.ts` | Phase 7A caller-established tasks and synthetic native responses |
| `tests/semantic-middleware-shadow.test.mts` | Runtime integration and failure tests |
| `tests/semantic-middleware-shadow.test-d.ts` | Compile-time policy/repair/publication and consumer-boundary rejection checks |
| `scripts/semantic-middleware-shadow.mts` | Controlled fixture runner and explicit manual provider mode |
| `docs/semantic-middleware-phase-7c.md` | Completion report and evaluation instructions |
| `docs/semantic-middleware-phase-7c-verification.json` | File-integrity verification receipt |

**2. Middleware/provider architecture.** The application constructs a trusted `BoundedSemanticTask` with exact source revision and Unicode code-point span. The middleware turns it into independent semantic questions. The infrastructure adapter alone handles Jev Noul objects and HTTP. It validates answer identities, probabilities, model and token usage, returning a provider-neutral probability map. Application code optionally derives experimental yes/no/dead-zone states, assembles the existing Phase 7A observation and invokes the existing contract checker.

```text
app-owned source, anchor, literal arguments and supplied candidates
  -> bounded semantic request
  -> isolated Jev Noul adapter
  -> validated keyed probabilities
  -> application-owned Phase 7A observation
  -> evaluation-only trace
```

The trace envelope is evaluation metadata, not a second semantic-observation schema. The adapter does not import benchmark runtime code or use a baseline model. It calls only `https://api.typesafe.ai/v1/systemone`. Structural checking does not certify meaning, support, Proof or permission. Checked observations are stored without exposing the contract checker's branded consumer value. Collection returns `Promise<void>`; no result enters workflow payloads, review feedback or publication policy.

**3. Environment/config controls.** All settings use the `SEMANTIC_MIDDLEWARE_SHADOW_` prefix.

| Suffix | Control |
| --- | --- |
| `ENABLED` | Only literal `true` enables; unset/false disables |
| `PROVIDER` | Explicit `jev` required |
| `MODEL` | Explicit pinned `jev-X.Y.Z`; template uses `jev-1.13.0` |
| `JEV_API_KEY` | Dedicated secret required; retained only in adapter configuration |
| `TRACE_PATH` | Required `.jsonl` file strictly inside `.local/semantic-shadow/` |
| `TIMEOUT_MS` | Default 1,000; accepted range 20–2,000 |
| `BUDGET_MS` | Default 2,500 per review snapshot; accepted range 20–5,000; worker remaining time can reduce it |
| `MAX_TASKS` | Default 3 provider requests per snapshot; accepted range 1–5 |
| `EXPERIMENT_LOW`, `EXPERIMENT_HIGH`, `EXPERIMENT_REF` | Optional, explicit analysis experiment; both bounds and reference required together |
| `INPUT_USD_PER_M`, `OUTPUT_USD_PER_M` | Optional account-specific cost-estimate rates; unknown if absent |

Missing or invalid enabled configuration disables collection without failing the application. The configuration fingerprint excludes credentials. Public metadata records the model, question protocol, timeout, budget, request limit, execution mode and probability policy. Trace cost estimates retain the supplied rates. There is no endpoint override, fallback provider or automatic retry.

The default probability policy is `rawOnly`: probabilities are retained, binary states are `notDerived`, and unresolved observation fields remain partial. An explicitly configured experimental dead-zone can derive yes/no/applicationDeadZone independently for each target. Fixture bounds 0.2/0.8 and probabilities 0.05/0.95 exercise mechanics only; they are not measured or recommended production cutoffs. Jev probabilities are per-question P(YES), not a calibrated joint-observation confidence. The Phase 7A consumer profile excludes observation confidence, so probabilities stay in traces.

**4. Exact Jev targets implemented.** Each task chooses only the enabled families and up to two bounded candidate dimensions. Candidate sets are caller-owned, have at most two values each, and cannot represent an unbounded search.

| Target | Scope and ownership |
| --- | --- |
| `family_price`, `family_discount`, `family_availability` | Family survives denial; hours/working today/contact instructions alone do not imply availability |
| `polarity_affirmed`, `polarity_negated` | Independent internal relation polarity; ended/no-longer-active discount is negated relative to discount-is-active |
| `binding_<set>_<candidate>` | Supplied service or branch mention; no free-form entity output |
| `time_<candidate>` | Supplied linguistic past/current/future state; no clock-based interval resolution |
| `amount_<candidate>` | Confirmation of supplied price amount/currency/basis or discount reduction; cannot replace the application's normalized value with a distractor |

The application owns IDs, exact spans, normalized literals, presentation/attribution, qualifiers and relative-time references. Registry IDs require an exact trusted application resolution and provenance reference; a candidate or provider cannot establish registry authority by itself. No Jev question asks for arbitrary strings, SemanticObservation JSON, business truth, source authority, Proof or publication judgment. Unsupported free-form extraction, unrestricted discovery and native abstention remain unsupported.

The initial automatic worker path is intentionally narrower than the port. It accepts an entire caption/script/frame/screen-text field only when it matches a controlled single-relation Georgian grammar over a supplied service catalogue: exact or starting GEL price, percentage discount, or explicit available/unavailable slots. The catalogue supplies vocabulary, not authoritative facts. Literal amounts are parsed by the application. Service candidates and, where present, current/future linguistic time candidates are batched. Branch and amount confirmation are available to caller-established tasks and controlled tests; the automatic grammar does not discover branch propositions or enumerate amount candidates.

Compounds, quotations, questions, lexical hits, arbitrary prose, unknown services and opening hours are ineligible. A source field with no bounded task gets a `noBoundedAnchor` trace and no model call. Caller-established/fixture tasks can cover richer source text while retaining an exact supplied anchor. This narrow grammar is not evidence of unrestricted proposition discovery. Real-content coverage may be low and must be measured in Phase 7D.

**5. Batching behavior.** There is one HTTP request per eligible supplied anchor, carrying independently keyed binary questions. A task has 1–3 family questions, two polarity questions and up to four candidate questions: at most nine decisions per request. The ordinary worker shape uses three families, two polarity questions, one service candidate, and optionally two time candidates. This is several binary questions in one transport, not native structured semantic output. Answers keep their identities even when polarity or binding conflicts with correct family classification. Exactly the requested answer keys are required; invalid/missing/extra answers reject the whole provider response for evaluation.

**6. Ellipsis/ambiguous-binding safeguard.** The second clause in “ვაკეში კონსულტაცია 150 ლარია, საბურთალოზე — 180.” is deliberately represented with an unresolved service target and `ellipticalBinding` flag. A model YES cannot turn an `elliptical` or `ambiguous` candidate into a known binding. An explicit mention must occur in the selected span. A safely established inherited binding requires a trusted application's `applicationEstablished` candidate and a matching supplied context reference. Multiple YES candidates also remain unresolved. The guard applies to service and branch bindings. Availability resource identity stays unresolved until its service binding is established.

**7. Trace schema/storage.** `unda-semantic-shadow-trace-v1` links source ID, exact revision/text, proposition/span/anchor rule, workflow/review run IDs, post/channel/surface, original Safety prompt version and per-post outcome, and the consolidated review outcome. It records the application task including normalized claim candidates, requested targets, supplied candidates, per-target probabilities/derived states, evaluation-only observation, unresolved paths, contract result/issues, capability-limit flags, invocation/not-invoked reason, sanitized technical codes, latency, counts, tokens, estimated cost/rates, model, configuration and timestamp.

The worker stores append-only JSONL in the existing ignored `.local/semantic-shadow/` directory. The controlled runner writes a unique JSONL plus summary there. No database schema, API route, policy reader or background queue was introduced. Credentials, authorization headers, exception messages/stacks, arbitrary response bodies and full business/reviewer prompts are not persisted. Source text and the original reviewer outcome are necessary evaluation context. Semantic provenance remains separate from business Proof. This is local best-effort evaluation storage, not durable delivery infrastructure: worker termination, a deadline or disk failure can lose a trace. No retention/rotation service was invented; trace completeness and file management need review before sustained shadow collection.

**8. Failure/timeout isolation.** The existing worker captures detached original reviewed copy and Safety outcome before `applyPostReview` can move repair drafts. Only a successful existing checkpoint save makes that snapshot eligible for collection. The worker completes its normal stages and repairs first, then uses its remaining execution time for shadow collection. No Jev wait consumes the normal stage loop's time or enters `saveWeeklyPosts`/`failWeeklyPosts` results. Ready/repair state is already saved and visible before collection begins.

Each request races its bounded timeout with AbortSignal cancellation; the whole collection also has a deadline. A 100 ms storage reserve prevents starting another provider request too close to that deadline. Aborted tasks, request limits and insufficient budget are recorded without a provider call where storage remains available. Late results from a port that ignores cancellation are not admitted. Setup, snapshot, observer, HTTP, schema, provider, timeout and sink failures are isolated; errors persist only as allowlisted codes and optional HTTP status. An accidentally asynchronous Safety observer rejection is also swallowed. Worker return can have a bounded collection tail while its already-committed workflow result remains unchanged. Storage is allowed to fail independently.

**9. Metrics collected.** The shared metrics function summarizes saved traces, and the local runner emits the summary. Worker traces retain the inputs needed for the same later aggregation. Counts remain separate: eligible/ineligible source revisions, provider requests, total decisions, family/polarity/entity-binding/time/amount decisions, application dead-zone events, provider schema failures, contract-invalid observations, unresolved fields, ellipsis/ambiguous cases, provider failures, timeouts/rate, mean/p50/p95 latency, tokens, known estimated cost and requests with unknown usage/cost. No combined semantic-quality score or automatically correct reviewer/model label is produced.

**10. Automated/local verification.** All commands below passed. Tests use mocked/synthetic responses and do not load live model credentials.

| Verification | Result |
| --- | --- |
| `npm test` | 311 existing runtime + 17 unchanged Phase 7A + 20 new shadow tests passed |
| Existing weekly posts, UX and sequence tests | 19 passed; original test files unchanged |
| Type check | Passed, including compile-time rejection of raw/shadow policy inputs |
| Lint | 0 errors; 6 existing warnings outside changed files |
| Next.js production build | Passed |
| `npm run semantic:shadow:fixtures` | 10 Phase 7A source texts; 12 eligible supplied anchors + 1 ineligible control |

The controlled runner produced 12 synthetic transport responses and 71 independent decisions: 36 family, 24 polarity and 11 service/branch candidate decisions. All 12 observations passed the existing contract; opening hours had no observation or call. Fifteen unresolved field paths remained, including the protected ellipsis case and missing time/binding information. Temporal-state and amount confirmation, invalid responses, request/budget caps, hanging storage, provider exceptions/timeouts and ambiguous bindings are exercised separately by the runtime tests. The fixture suite also verifies application identities, literal arguments, exact code-point spans, registry ownership, independent target identities, raw-only/dead-zone distinctions, no credential leakage, original reviewer prompts/results and identical repair application.

The final local fixture trace and summary are at `.local/semantic-shadow/local-fixtures-a7a0bbfb-d130-4054-b5cb-25246d7c4d39.jsonl` and its `.summary.json` companion. Synthetic adapter/validation latency was mean 3.09 ms, p50 0.85 ms, p95 26.00 ms. These are local fixture timings, not Jev network latency. Actual live calls and spend in Phase 7C: zero. Fixture usage is synthetic zero; no tariff was inferred.

**11. Manual provider integration.** Not run in Phase 7C. The native HTTP adapter and validator were exercised with synthetic responses. Phase 7B's pinned provider evidence is a design reference, not a live verification of this modified integration question bundle.

Default local run: `npm run semantic:shadow:fixtures`. Explicit manual provider run, after deliberately supplying complete isolated shadow configuration in the invoking process: `node --import tsx scripts/semantic-middleware-shadow.mts --live`. Without that explicit argument the runner always uses synthetic responses, even if provider environment variables exist. Live mode fails before a call when enabled configuration is incomplete. The manual runner uses fixture anchors and writes evaluation files; it does not modify workflow or environment configuration. Its summary also labels results as unreviewed, not model-quality gold.

**12. Production flag/default state.** Template flag is `false`, absent flag disables, and `.env.local` was confirmed disabled. No production environment, deployment setting or running workflow was changed. No production threshold was chosen. No real workflow shadow run was invoked.

**13. Existing behavior and artifact integrity.** Writer/reviewer/editorial prompts, original Safety result, repair policy, approval/blocking, scheduling, publishing and user-visible warnings remain unchanged. The only existing reviewer change is a detached non-authoritative observer. Review/repair equivalence is verified with failing and mutating observers; raw provider results and even structurally valid shadow observations fail the policy/consumer type boundaries. Shadow data has no reader in those paths.

The [integrity receipt](semantic-middleware-phase-7c-verification.json) compares the original UNDA file hashes, permitting only the four existing files listed above. It also checks the frozen benchmark areas against Phase 7B's protected snapshot and verifies all files listed in its artifact manifest. Existing Phase 7A contract/profile/projections, fixtures, tests, prompts, policies, unrelated workspace edits and `.env.local` are preserved. UNDA's Git HEAD was not changed. The benchmark adapter, v1 data/reviews, frozen v2 candidate, 834-item review state and Ontology v2 activation state were untouched by this phase.

**14. Phase 7D recommendation.** Evaluate a small consented real-content sample in an isolated worker environment using pinned Jev, raw probabilities and recorded application anchors/candidates. Start with the smallest established role: anchored family + polarity, explicit service binding and bounded linguistic time where needed; branch and amount confirmation only on caller-established tasks. Keep ellipsis/competing antecedents unresolved unless trusted application context supplies the binding.

Review each family, polarity, binding, presentation and temporal error independently alongside the original Safety outcome. Measure eligible/ineligible coverage as well as correctness, technical/trace loss, latency and cost. Include complex/ineligible examples so the grammar's missed coverage is visible. Classify errors by likely downstream action difference without changing actual action. Freeze question/config versions for each comparison and retain unresolved/technical/dead-zone distinctions. The first real-content experiment should verify this exact integration bundle; Phase 7B's curated anchors cannot establish its unrestricted coverage. Unsupported discovery/extraction, unclear scope, ambiguous antecedents and low anchor coverage identify application-owned work or cases for a stronger interpreter. No admission or production threshold follows from Phase 7C.
