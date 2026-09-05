# UNDA Social Operator

UNDA Social Operator is an AI operator that learns how a business communicates,
plans its social content, prepares publishable posts, routes them through review,
publishes approved work, and improves the next cycle from feedback and results.

## Product loop

```text
Business
→ Brand Brain
→ Weekly Strategy
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
- `worker/` will execute background provider and model work.

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

The agreed account, workspace, Social plan, and 14-day trial requirements are in
[Access, Plans and Trial — Product Decisions v1](docs/Access%2C%20Plans%20and%20Trial%20%E2%80%94%20Product%20Decisions%20v1.md).
Authentication, private workspace ownership, and protected onboarding are now
implemented. See [Authentication](docs/Authentication.md) for local setup,
Google and SMTP configuration, and verification. Subscription limits, billing,
and the trial lifecycle remain to be implemented.

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
