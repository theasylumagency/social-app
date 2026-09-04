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
- `worker/` will be the only layer that executes provider and model work.

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
website is unavailable. Confirmed details go through `POST /api/onboarding`,
run the same ingestion pipeline, persist to PostgreSQL, and display the Brand
Brain readiness state. Connected-social adapters can reuse this pipeline.

The current architecture correction map is in
`docs/Brand Knowledge Architecture — Amendments & Supersession Map v1.md` and
takes precedence over older prompt contracts where they conflict.

## Local commands

```bash
npm run dev          # Start the local Next.js app
npm run check        # Type-check the app and domain contracts
npm test             # Build and run the domain contract tests
npm run db:up        # Start the project PostgreSQL service
npm run db:migrate   # Apply pending database migrations
npm run test:integration # Verify the real PostgreSQL persistence flow
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
