# Strategic Operating Flow v1 — implementation

Implemented 8 September 2026. The two supplied briefs informed this rebuild; the user's explicit subscription and simplification decisions take precedence. This document supersedes older trial, weekly goal replacement and sequence novelty requirements.

## 1. Removed assumptions

- A social manager no longer chooses a new business goal during every weekly cycle. A concrete social strategic objective is proposed after Brand Brain confirmation and persists until an explicit, approved revision.
- Brand onboarding no longer asks the founder to select AI-generated business goals. Existing goal data remains readable for historical work.
- Repetition of an idea, offer, audience, CTA or content role is not a reason to reject a week. The semantic sequence reviewer and its automatic repair loop are removed. Lexical duplicate hygiene remains.
- Missing profiles, inaccessible pages and login walls are unknowns, not evidence that a brand has no channel or no activity.
- There is no trial or implicit activation of an existing account.

## 2. Operating flow

1. Sign in and select a subscription. Development checkout records a simulated payment without a bank or payment provider.
2. Create or select a brand within the account's capacity; confirm its evidence-backed Brand Brain, voice and communication envelope.
3. Inspect known public social URLs and links discovered on the brand website. Store source availability and excerpts independently of the model proposal.
4. Recommend brand-specific channels, a social strategic objective with rationale, a provisional horizon, strategic plan and measurement criteria.
5. Founder approves or disagrees with a comment. Disagreement creates a revision. An existing approved strategy remains active while a replacement is being considered.
6. Generate only the current week, using the approved strategic snapshot, confirmed brand knowledge, recent editorial work and available sourced observations. The weekly objective serves the persistent strategic objective.
7. Prepare channel-specific copy and proposed cadence; retain factual/voice/editorial review, bounded targeted repair, saved versions and explicit approval.
8. Record actual execution and sourced public, connected-account or downstream observations. Unavailable results remain explicit. A subsequent current-week plan uses those records; a strategy revision requires an explicit founder, evidence or business reason.

Publishing contracts and provider connections are preserved. The workspace does not yet dispatch live publishing jobs or ingest provider analytics automatically; preparing or approving copy is never recorded as publication or performance.

## 3. Main contracts and files

| Responsibility | Location |
| --- | --- |
| Strategic objective, channel decisions, evidence and revision policy | `src/blueprints/social/strategy/` |
| Bounded public reconnaissance | `src/application/social-strategy/reconnaissance.ts`, `src/infrastructure/web/website-discovery.ts` |
| Persistent strategy revisions, approvals and weekly observations | `src/infrastructure/postgres/social-strategy-store.ts` |
| Durable strategic execution and model audit | `src/worker/social-strategy.ts`, `scripts/brand-discovery-worker.mts` |
| One-call current-week planning | `src/application/weekly-planning/advance.ts`, `src/blueprints/social/weekly-planning/compact-strategy.ts` |
| Weekly strategy snapshot and admission checks | `src/infrastructure/postgres/weekly-planning-store.ts`, `weekly-operation-access.ts` |
| Lexical copy hygiene | `src/blueprints/social/weekly-planning/duplicate-hygiene.ts` |
| Subscription policy and transactional storage | `src/application/subscriptions/policy.ts`, `src/infrastructure/postgres/subscription-store.ts` |
| Subscription, strategy and results screens | `src/app/subscription/`, `src/app/workspace/strategy-client.tsx`, `evidence-client.tsx` |
| Ownership, CSRF and subscription request checks | `src/app/_server/auth.ts`, `src/app/_server/social-connections.ts` |

Core domain contracts remain operator-agnostic. Models make semantic proposals; application code owns validation, access, IDs, transitions and transactions. A shared database connection pool now also persists across production requests.

## 4. Model calls and cost

- Removed the brand-goal proposal call from onboarding.
- Weekly planning now uses one compact semantic call, covering the weekly objective, audience, directions and experiment decision. The previous serial planning stages and separate planning review call are no longer executed.
- Removed the paid post-sequence review and its repair loop, including obsolete paid evaluation scripts.
- Added one strategic proposal call on initial setup or an explicit revision. It is not repeated merely because the week changes. Public reconnaissance uses bounded HTTP reads, not additional semantic review calls.
- Preserved parallel copy writing, factual/editorial review and the existing bounded targeted repair when actual quality issues need correction.
- Duplicate hygiene compares normalized lexical text against the current batch and bounded recent copy; repeated concepts alone pass.

Expected cost and delay are lower because the routine week has fewer serial calls and no novelty repair loop. No live cost benchmark or dollar savings claim is made; integration tests use mocked model responses and do not spend model credits.

## 5. Persistence, migration and subscriptions

Migration `0012_strategic_operation.sql` adds subscriptions, payment history, individually provisioned custom terms, strategy revisions/model audits and weekly observations. Migration `0013_retire_legacy_planning_jobs.sql` retires unfinished jobs lacking the new strategic basis, preserving their payloads and copy. No invented conversion of old business goals occurs.

Local audit before disposable QA data: 3 brands; 0 confirmed dossiers, weekly plans, pending legacy planning/copy jobs, subscriptions or strategies. Existing brands were preserved. The read-only `scripts/inspect-strategic-migration.mts` can repeat this audit.

Subscription rules:

- Solo: 1 brand; Studio: 3; Agency: 10. Custom capacity must be greater than 10 and come from server-provisioned `subscription_custom_terms` associated with the workspace. Checkout cannot grant arbitrary capacity. An administrator records the agreed limit and nonempty terms in that table before custom checkout is enabled; there is no public administrative form yet.
- Billing period is one calendar month. Month-end dates clamp to the last valid day.
- Renewal adds a month from the later of now or the existing expiry. Upgrade increases capacity immediately and preserves the current expiry; it is not a free extension. Active downgrades are disabled.
- Every payment records timestamp, expiry, plan, capacity and simulated mode. Payment UUIDs make retries idempotent. Workspace row locks prevent concurrent checkout or brand creation from bypassing limits.
- Expiry blocks workspace and onboarding pages, work APIs, asset access and admission of model jobs. Account and subscription pages remain reachable for recovery. Brands and previous work remain stored. An already-open workspace checks expiry periodically and on focus; each work request checks it independently.
- Development checkout is simulated. A production build requires explicit `BILLING_MODE=simulated` to enable it. Real prices and a real payment provider are intentionally absent.

## 6. UX changes

The subscription screen precedes brand work and clearly identifies test payments. It shows capacity, last payment, expiry, history, upgrades and renewal. Strategy has its own navigation item with objective, rationale, approval status, provisional horizon, channel recommendations, plan and measurement criteria. Current-week work displays its strategic objective separately from its weekly objective and shows the evidence available at planning time. Results supports manual sourced observations and explicit unknowns. Progress reflects the simplified planning process rather than showing obsolete sequential stages.

## 7. Verification

Behavior tests cover strategic persistence across weeks, explicit revisions and founder disagreement, public reconnaissance classifications and source grounding, supported channel admission, current-week-only generation, available/missing results, lexical duplicates, safe legacy reads, concurrent brand limits, payment replay, custom terms, upgrades, expiry and recovery.

Commands for repeatable verification:

```sh
npm run check
npm run lint
npm test
npm run test:strategy
npm run test:planning
npm run test:discovery
npm run test:dashboard
npm run test:auth
npm run build
```

The domain suite passed 227 tests; final strategy/subscription tests passed 7, planning/copy/UX tests passed 33, and authentication/discovery/dashboard/voice tests passed 22. TypeScript and the final production build passed. Lint has zero errors and five existing unused-variable warnings in golden evaluators. Integration tests create isolated temporary databases and mock model/provider responses.

Browser verification covered first-login subscription selection, simulated purchase, strategy approval, current-week planning and saving explicitly unavailable results. This caught and fixed a billing-date hydration mismatch. Final running-app HTTP checks passed upgrade capacity with preserved expiry, expired workspace redirection, work API rejection with 402, accessible billing and renewal restoring the saved plan. The disposable QA account was removed; the original three brands remain. No bank or model calls were used for these checks.

## 8. Deliberate limits and remaining decisions

- Reconnaissance inspects known links and links found on the brand website. It does not perform broad social/web search. Missing URLs and inaccessible pages are explicitly unknown.
- Public evidence cannot establish private reach, conversions or commercial outcomes. Connected/downstream observations entered in Results are labeled as user-provided, not automatically verified analytics.
- Facebook and Instagram have content generation support. Recommendations for other channels can be stored, but do not imply a publishing integration.
- Live publishing dispatch, automatic analytics ingestion and generated images remain outside the current implemented workspace loop. Existing publishing/provider abstractions and uploaded-image support remain intact.
- Real prices, bank integration and an administrative interface for bespoke agreements remain future work. Testing is intentionally free and uses the normal subscription lifecycle.
- The strategic horizon is a reasoned estimate, not an automatic replacement date or promised result. Future detailed weeks are not generated.

## Running locally

Start PostgreSQL with Docker Compose, apply migrations with `npm run db:migrate`, then run `npm run dev` and `npm run worker:operator` in separate processes. The worker must remain running for queued discovery, strategy and content generation. Local `BETTER_AUTH_URL` must match `http://localhost:3000`; deployment uses its own HTTPS origin. Development uses simulated checkout without contacting a bank.
