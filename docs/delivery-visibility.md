# Delivery visibility

September 15, 2026

The executive briefing now projects actual saved publishing evidence. The overview
includes schedules across all weeks; Content filters by the source planning week,
including retained plan versions. Opening or refreshing these views only reads
records. It does not dispatch, retry, reconcile with providers, or change authority.

## What the reader sees

- Confirmed publication, scheduled/current work, and items requiring inspection.
- Sent or accepted requests with no terminal result remain awaiting confirmation.
  After the configured attempt grace period, they require inspection. Repeated
  inconclusive observations do not restart that clock.
- Known final failures, exhausted attempts, disconnected publishing accounts,
  disabled publishing and overdue work remain distinguishable.
- Rescheduling changes the displayed scheduled time. Cancellation never hides
  recorded publication or unresolved dispatch evidence. Confirmed publication
  alongside another unresolved attempt still requires duplicate inspection.
- Provider reconnection does not erase results from a previous binding.
- Failed reads produce an explicit unavailable panel, never a successful empty
  queue. Invalid publishing configuration is also shown as unavailable.
- Each item retains the plan week/version, account/channel, attempt count and
  observation timestamps. Historical detail expands on demand. Credentials,
  provider response messages and publication payloads are excluded.

## Scope and limits

The projection uses existing schedules, lifecycle events, attempts, provider
request states, results and reconciliation records. Terminal reconciliation takes
precedence over inconclusive observations. Every database query checks workspace
ownership. Existing workspace authentication and subscription handling remain.

Pending/delayed status uses the configured publishing grace period as an observation
threshold, not a delivery SLA or evidence that a worker is alive or dead. A planned
future retry is not overdue. The view refreshes on a page request; overview has a
manual refresh button. It is not continuous provider or worker health monitoring.

The first projection reads the brand's full saved schedule history so older
unresolved deliveries cannot silently disappear. Paginated history and database
aggregate counts are a future scaling step. External publications, worker heartbeat,
analytics ingestion freshness and autonomous authority policy remain separate work.

## Verification

- TypeScript, ESLint and production build.
- Focused delivery projection and UI tests cover timing, ambiguous dispatch,
  cancellation, final results, retry limits, read failure and week filtering.
- PostgreSQL integration tests apply all migrations to disposable isolated schemas,
  verify owner/brand scoping, reschedule/cancellation precedence, reconciliation,
  retired bindings and unchanged attempt/result/event counts after reads.
- Existing executive, Results and post-review UI regressions remain covered.
- Browser layout inspection uses actual components and built CSS with synthetic
  records on desktop and at 390px. The live application loads its login page;
  authenticated production-data and actual provider delivery are not claimed.

Run the focused tests with Docker/PostgreSQL available:

```text
npm run test:social:delivery-view
```
