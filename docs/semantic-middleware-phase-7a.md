# Phase 7A — Semantic Middleware Contract Scaffold

Canonical design: [UNDA Semantic Middleware Contract v1](semantic-middleware-contract-v1.md). Contract version: `unda-semantic-observation-v1`. This implementation creates an unused application-owned data boundary and pure structural checks/projections. It does not classify text or change production behavior.

## Placement and files

- `src/core/domain/semantic-observation.ts`: operator-agnostic value-state, span, binding, quantity, time, attribution, qualifier, interpretation/provenance types and a generic observation envelope. The type parameters allow later operator families without putting Social-specific vocabulary in core.
- `src/blueprints/social/semantic-middleware/contract.ts`: only price, discount and availability payloads, their observation type, trusted caller context and structural-check result/brand.
- `src/blueprints/social/semantic-middleware/profile.ts`: immutable `PHASE_7A_PROFILE` requests those three families, polarity, attribution/presentation, relevant service/branch/subject/audience bindings, time, condition/eligibility/scope/exception qualifiers and conditional `unclearScope` reasons. Modality, confidence, other families and unrequested fields are rejected. This profile has no publication rule.
- `src/blueprints/social/semantic-middleware/check-contract.ts`: pure `checkSemanticObservationContract(unknown, trustedContext, profile)`.
- `src/blueprints/social/semantic-middleware/projections.ts`: detached Safety-review and per-family Fact-match DTOs; no runtime/prompt integration.
- `tests/fixtures/semantic-middleware.ts`, `tests/semantic-middleware.test.mts`, `tests/semantic-middleware.test-d.ts`: supplied Georgian interpretations, runtime contract tests and type-level projection/subset checks. Fixtures are never production facts or Proof.
- `package.json`: `test:semantic` runs the new unit tests and is included in the existing `npm test` verification sequence.

No application, provider, worker, reviewer, writer, repair, approval or scheduling module imports this scaffold. No unrelated files move and no barrel exports activate it.

## Structural boundary

The caller supplies immutable current source revisions, separately authored proposition anchors, observation/proposition/local binding identities and actual interpretation method/reference metadata. The observation cannot redefine these identities. Code-point offsets use `Array.from(text)`; stale revisions, mismatching excerpts, invalid bounds and anchors are rejected. This includes Georgian and a non-BMP emoji fixture. No lexical scanner or linguistic normalization creates proposition boundaries or affirmative kernels.

All requested slots distinguish known, unknown, N/A and unresolved. Optional omission remains omission in projections, including the difference between absent qualifiers and an explicitly empty list. A successful interpretation can faithfully record an unstated unknown; unresolved/not-evaluated emitted slots require partial/abstained interpretation and field paths. Transport failures are outside this data check, not a default NO or safety pass.

Checks enforce closed field shapes, unique families, required service binding containers, existing availability binding references, plain nonnegative decimal strings, ISO date/time container syntax, and price ranges with an upper-bound slot. Unknown range bounds remain unknown. Decimal bound comparison uses string precision rather than floating-point rounding. Calendar validity, arithmetic, date resolution and timezone conversion are not implemented; no machine/draft/model time supplies relative references.

Registry IDs require an exact trusted structured/deterministic resolution (binding, mention, ID, method, reference). A self-declared field origin is insufficient: mixed origins must equal the caller's recorded origins. Model method variants exist as future data types, but require caller-recorded matching interpreter metadata and cannot claim registry ownership. No provider adapters/calls are implemented, and fixtures use only structured/deterministic/human provenance.

The result names are `structurallyValid` / `structurallyInvalid`; a TypeScript-only `StructurallyCheckedObservation` brand restricts projection inputs. This is **not** semantic correctness, support, authority, permission or publication validity. Atom boundaries, affirmative-kernel meaning, polarity scope, quotation interpretation, calendar correctness and fact/Proof assessment still require their separate owners. A structurally accepted invented/wrong interpretation remains wrong; the checker does not certify it.

## Projections and extension

Safety receives exact spans, identity/kernel/presentation, family payloads, polarity/attribution, relevant bindings/time/qualifiers/reasons and resolution status/unresolved fields. It receives no confidence, routing, interpreter provenance or publication verdict.

Fact-match receives one task per family with proposition identity, payload, polarity, relevant bindings/time/qualifiers and observation/source trace. Availability state is derived from known polarity on the supplied affirmative kernel; unresolved/unknown/N/A remains that state, without an invented zero. An empty task list is not evidence of safety. DTOs are detached copies; optional omission is preserved. These projections are not connected to prompts or existing consumers.

Later families add a typed blueprint union member, explicit profile/validator payload rules, consumer projection needs and reviewed tests. Generic core needs no Social family inventory. A later provider adapter must keep application identities and deterministic registry resolution outside model ownership. Broader modalities/reasons/roles remain explicit profile changes, not an “all semantics” mode.

## Coverage and deliberately absent work

Fixtures cover exact/starting prices, ended/current denied discounts, unavailable capacity, a supplied hours negative control, three independently anchored temporal discount clauses, separate branch prices and a non-BMP span. Tests validate structure, lineage, states, numeric ranges, profiles, provenance, qualifiers, relative-reference unknowns, pure projections and absence of inferred capacity; they do not claim to measure semantic-model accuracy. Use `npm run test:semantic`, `npm test`, `npm run lint` and `npm run build` for verification.

There is no proposition discovery, heuristic negation normalization, temporal reasoner, model execution, feed connection, fact/Proof population, user warning or production wiring. Writer/reviewer prompts, routing, the one-repair lifecycle, approval/publication and scheduling are unchanged. The semantic-benchmark is untouched and Ontology v2 is not activated. Current empty `publicFacts` and `eligibleProof` remain explicit limitations.

## Verification — 2026-10-03

- `npm test`: TypeScript check, domain build, 311 existing runtime tests and 17 new semantic contract tests passed.
- Existing weekly-post, post UX, sequence and mocked model-runtime suites: 25 tests passed; no live providers were called.
- `npm run lint`: passed with no errors; six existing unused-variable warnings in unchanged subscription/golden-test files.
- `npm run build`: Next.js production compilation, TypeScript and static-page generation passed.
- Import scan found no scaffold imports in application, infrastructure, app, worker scripts or the existing Social barrel. The new modules contain no provider execution or clock access. Existing unrelated tracked changes and the benchmark working-tree state were preserved.
