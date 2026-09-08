# UNDA Social Operator

UNDA Social Operator is an AI operator that learns how a business communicates,
plans its social content, prepares publishable posts, routes them through review,
publishes approved work, and improves the next cycle from feedback and results.

## Product loop

```text
Subscription (1 / 3 / 10 brands, custom >10; simulated payment)
→ Business
→ Brand Brain
→ Public Social Reconnaissance
→ Founder-approved Social Strategic Objective + Strategic Plan
→ Current Weekly Plan
→ Content
→ Review
→ Schedule
→ Publish
→ Learn
→ Next Weekly Cycle
```

The first sellable milestone is complete when a business can connect its social
account, let the Operator understand the brand, approve a weekly plan and its
content, and have the Operator publish that content automatically.

## Architecture boundaries

- `src/core/` contains operator-agnostic domain rules and mechanisms.
- `src/blueprints/social/` will contain Social Operator knowledge, policies, and
  channel-specific behavior.
- `src/app/` contains the Next.js UI and request surfaces.
- `src/infrastructure/` contains request-time storage, website, and model
  adapters used by synchronous flows such as onboarding.
- `worker/` executes queued brand discovery, weekly planning and post generation through the persistent `npm run worker:operator` process. The discovery and weekly API routes only validate and persist state; they do not launch heavy model calls.

The core rule is that language models handle ambiguous semantic reasoning while
deterministic application code owns IDs, validation, authority, state changes,
permissions, scheduling, and orchestration.

## Current milestone

The first version of the Brand Knowledge domain contracts is implemented in
`src/core/domain`. `src/blueprints/social` defines the initial Social Operator
registries, policies, defaults, capability requirements, quality configuration,
and Georgian claim signals. A deterministic structured-source slice covers
`Source → Snapshot → Evidence → Routing → Knowledge mutation proposals`.

PostgreSQL persistence now stores that complete ingestion graph atomically. It
keeps immutable Evidence separate from versioned routing, records the Minimum
Viable Brand result, and rejects a repeated snapshot with the same source and
content hash. The Georgian onboarding is now source-first: `POST
/api/onboarding/discover` safely reads public website metadata and JSON-LD,
prefills editable brand candidates, and falls back to manual entry when a
website is unavailable. Discovery crawls up to five same-origin priority pages,
then uses a fast Structured Outputs extraction model when `OPENAI_API_KEY` is
configured. Every AI-extracted value is accepted only when its URL and exact
excerpt can be verified against the fetched page; a stronger fallback model is
used only for incomplete or ambiguous results. Confirmed details go through `POST /api/onboarding`,
run the same ingestion pipeline, persist to PostgreSQL, and display the Brand
Brain readiness state. The final submission captures a separate immutable
website snapshot, routes its evidence independently, links unchanged confirmed
fields through Evidence lineage, and stores a verified raster logo as a local
source artifact when one is available. Connected-social adapters can reuse this
pipeline.

The current architecture correction map is in
`docs/Brand Knowledge Architecture — Amendments & Supersession Map v1.md` and
takes precedence over older prompt contracts where they conflict.

The current operating and subscription decisions, migration, verification and
remaining integration boundaries are in [Strategic Operating Flow v1 — implementation](docs/strategic-operating-flow-v1.md).
This supersedes the older trial and weekly novelty requirements. There is no trial.
Authentication, private workspace ownership, and protected onboarding are now
implemented. See [Authentication](docs/Authentication.md) for local setup,
Google and SMTP configuration, and verification. Subscription purchase, renewal,
upgrade, brand limits and expiry access checks are implemented with simulated payments.

The first authenticated screen without an active subscription is `/subscription`.
The active workspace opens at `/workspace`, with Strategy, Week, Content,
Results, Brand, Connections, and Settings. The root route resumes the last
accessible brand; users without a ready brand go to `/onboarding`. Completing
onboarding selects the new brand and opens its social strategy for approval.
Brand switching uses a server-validated, HttpOnly preference cookie. Every
dashboard query and weekly-goal write checks workspace ownership.

Week now turns confirmed brand knowledge into a founder-facing list of proposed
posts: count and channel rationale, full Facebook/Instagram text, format, visual
briefs and private image uploads. Strategic explanations remain expandable.
Independent review, durable parallel writing, targeted repair and explicit
approval preserve earlier versions. Image generation is deliberately disabled
during testing. See [Weekly Planning and Posts](docs/Weekly%20Planning%20and%20Posts.md)
for deployment, model choices, validation and current limits.

Facebook and Instagram account connection is available when configured. Real
publishing, automatic analytics ingestion and real payment processing remain future work. Weekly observations can already be recorded with their sources and used by the next plan. Recommended channels and days are not presented
as connected accounts or scheduled publication.

The Phase 1 social provider foundation is available in
`src/application/social-connections`, `src/infrastructure/postgres/social-connections-store.ts`
and `src/infrastructure/zernio`. Migration `0011_social_connections.sql` separates
stable UNDA publishing accounts from historical provider bindings. Composite
foreign keys enforce brand and channel agreement; replacing a binding preserves
the canonical account ID and requires verified native identity. Replacement is
blocked while any existing attempt has no result or an `unknownOutcome` result.
Phase 3 will account for durable reconciliations and acquire the same brand lock
when capturing a binding for a new attempt.

The Zernio transport client has bounded JSON requests/responses, a
whole-request timeout, no redirects/retries, and redacted errors. Configuration
uses the existing `BETTER_AUTH_URL` origin policy. The provider API defaults to
`https://zernio.com/api/v1`; only local test servers may override it outside
production. `readZernioEnvironment` defaults publishing off and validates all
required secrets when enabled. Phase 2 wires the connection adapter through a
server-only composition root. There are still no publishing, scheduling,
webhook, reconciliation, or analytics ingestion calls.

Phase 1 verification (requires the local test database):

```bash
npm run check
npm run lint
npm run test:social:foundation
npm run test:integration
```

The focused test creates and removes only a randomly named isolated PostgreSQL
schema. It fails, rather than skips persistence coverage, without `DATABASE_URL`.

### Phase 2: social connection flow

The Connections page reads canonical accounts and current binding health from
PostgreSQL. Facebook uses Zernio headless mode: UNDA lists display-only Page
choices and requires an explicit choice, even for a single Page. Instagram uses
`instagram_login` for professional accounts, not `facebook_login`.

Set `ZERNIO_API_KEY`, `SOCIAL_CONNECTION_CONTEXT_KEY` (32 random bytes encoded as
base64), and the existing `BETTER_AUTH_URL` canonical application origin. Keep
`SOCIAL_PUBLISHING_ENABLED=false`; connecting does not require the future
webhook secret or enable publishing. No provider credentials use `NEXT_PUBLIC_`.
Apply existing migrations through `0011` with `npm run db:migrate` before use;
Phase 2 adds no migration. Configure the provider callback at
`<BETTER_AUTH_URL>/api/social/connections/zernio/callback` and allow its server-issued
`flow` query parameter. Production requires HTTPS.

Server routes:

- `POST /api/social/connections/facebook` or `/instagram`: verified session,
  same-origin request and brand ownership required; returns the provider auth URL.
- `GET /api/social/connections/zernio/callback`: verifies the owner-bound state,
  profile and requested channel; redirects to a clean internal URL.
- `GET /api/social/connections/facebook/pages?intent=<id>`: owner-only display
  choices, without provider credentials.
- `POST /api/social/connections/facebook/select-page`: accepts only an offered
  Page for an unconsumed owner-bound intent; independently refetches the connected
  account, profile, health and selected native Page before binding it.

Intents expire after ten minutes and have SHA-256 state digests. Temporary
Facebook context is AES-256-GCM encrypted with a fresh IV and intent-bound AAD.
Success and terminal failure erase context; expired context is erased on the
owner's next connection request (there is no background cleanup worker yet).
Cancellation leaves the encrypted intent to expire. Changing the context key
invalidates pending connections, so restart them after key rotation.

The server serializes connection changes under the existing brand lock. Account,
binding and intent consumption commit atomically; no first-Page selection or
provider POST retry is automatic. Ten persisted initiations per brand/owner/hour
are allowed, including failed auth-URL requests. Profile creation uses a
deterministic brand-derived name and idempotency key, with lookup recovery for a
previous remote success. Callback responses use `private, no-store` and
`no-referrer`; configure hosting/proxy/APM access logs to **omit callback query
strings** because the provider's initial callback URL contains temporary tokens.

Reconnect reuses the canonical account ID. The documented account-list response
does not guarantee a native Instagram ID, so it remains null rather than being
invented from a provider ID or username. Same-binding reconnect is supported;
identity-changing reconnect/provider migration must wait for independently
verified native identity. A returned account from another profile/channel or a
different selected Facebook Page is rejected.

Phase 2 gate (isolated real PostgreSQL plus mocked Zernio transport; no live
provider accounts are changed):

```powershell
npm run check
npm run lint
npm run test:social:foundation
npm run test:social:connections
npm run build
```

The tests cover ownership/authentication/origin checks, expiry/replay,
concurrent callbacks and selection, encrypted context, explicit Page choice,
provider account/profile/channel refetch, reconnect identity, rollback safety
and initiation limits. Keep the gate green before Phase 3. Before production
rollout, also smoke-test both OAuth flows with a real configured test brand and
confirm that deployment access logs redact the callback query string.

Provider contracts: [connection URL](https://docs.zernio.com/connect/get-connect-url),
[headless Page list](https://docs.zernio.com/connect/list-facebook-pages),
[Page selection](https://docs.zernio.com/connect/select-facebook-page), and
[profile creation](https://docs.zernio.com/profiles/create-profile).

## Local commands

```bash
npm run dev          # Start the local Next.js app
npm run check        # Type-check the app and domain contracts
npm test             # Build and run the domain contract tests
npm run db:up        # Start the project PostgreSQL service
npm run db:migrate   # Apply pending database migrations
npm run test:integration # Verify the real PostgreSQL persistence flow
npm run auth:init-local # Add local auth settings without overwriting existing values
npm run test:auth    # Verify auth and ownership in an isolated PostgreSQL schema
npm run test:dashboard # Verify dashboard data and weekly goals in an isolated schema
npm run lint         # Run the project linter
npm run build        # Create the production Next.js build
npm run verify       # Run the full local verification pipeline
```

Generated domain output is written to `dist/` for runtime contract tests and is
not committed.

For first-time database setup, copy `.env.example` to `.env.local` and replace
the placeholder local password. Docker stores PostgreSQL data in the dedicated
`unda-social-operator_unda_social_postgres_data` volume. The service listens only
on `127.0.0.1:5433`, so it does not collide with a PostgreSQL service on the
default `5432` port.
