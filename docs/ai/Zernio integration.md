# Zernio Social Publishing Integration — Implementation Specification

## Goal

Add Facebook and Instagram account connections, durable publication through Zernio, webhook reconciliation, and basic analytics while preserving UNDA’s existing provider-neutral social publishing domain.

The integration must:

- keep UNDA as the sole scheduling authority;
- implement Zernio behind the existing `SocialContentPublisher` boundary;
- retain the existing durable attempt/result and retry/reconciliation semantics;
- create one schedule and one provider publication request for each platform/account;
- remain replaceable by a future direct Meta adapter;
- introduce no Zernio-specific types or concepts into `src/core`.

## Current architecture — preserve

### Repository boundaries

The current layering must remain:

- `src/core`: operator-neutral primitives and domain concepts. No Zernio types, identifiers, errors, or API shapes may be added here.
- `src/blueprints/social`: provider-neutral social-content, scheduling, publication, retry, and reconciliation contracts.
- `src/application`: orchestration and persistence ports.
- `src/infrastructure`: PostgreSQL stores, provider clients, media transport, and Zernio adapters.
- `src/app`: authenticated Next.js routes and user interface.
- `src/worker`: durable background processing launched by the existing operator worker.

### Existing publication boundary

[content-publish-run.ts](<D:/desk/unda project/unda-social-operator/src/blueprints/social/content-publish-run.ts:62>) already defines:

```ts
type SocialContentPublisher = (
  input: SocialContentPublisherInput,
) => Promise<SocialContentPublishProviderOutcome>
```

This remains the only publishing-provider boundary. `ZernioPublisher` implements it; application and domain services must not import Zernio request or response types.

The existing contract already establishes the required error invariant:

- definitely not sent → `retryableFailure` or `permanentFailure`;
- possibly accepted → `unknownOutcome`;
- an ambiguous post-send failure must never become `retryableFailure`.

### Existing durable flow

[run-durable-publish.ts](<D:/desk/unda project/unda-social-operator/src/application/publishing/run-durable-publish.ts:395>) must remain the publication entry point:

1. Resolve publication eligibility.
2. Assemble the canonical attempt.
3. Claim `(idempotencyKey, attemptNumber)` durably before calling the provider.
4. Resume an existing attempt/result without calling the provider again.
5. Call `SocialContentPublisher` once only when the claim is acquired.
6. Assemble the canonical result.
7. Persist that result idempotently.

An unresolved claimed attempt becomes `reconciliationRequired` after the configured grace interval. It must not be resent automatically.

The existing schema in [0006_social_publish.sql](<D:/desk/unda project/unda-social-operator/db/migrations/0006_social_publish.sql>) remains authoritative:

- `social_publish_attempts` represents immutable provider attempts.
- `social_publish_results` represents exactly one canonical result per attempt.
- `(idempotency_key, attempt_number)` remains the atomic worker claim.
- Result statuses remain `published`, `retryableFailure`, `permanentFailure`, and `unknownOutcome`.

### Existing schedule semantics

The existing domain represents one destination per execution specification and one channel per schedule:

- [content-execution-spec.ts](<D:/desk/unda project/unda-social-operator/src/blueprints/social/content-execution-spec.ts>)
- [content-schedule.ts](<D:/desk/unda project/unda-social-operator/src/blueprints/social/content-schedule.ts>)
- [content-publish-eligibility.ts](<D:/desk/unda project/unda-social-operator/src/blueprints/social/content-publish-eligibility.ts>)

A Facebook and Instagram post therefore becomes two independent execution specifications, drafts, schedules, attempts, results, and provider requests.

### Current integration gaps

The repository currently has:

- no provider-neutral connection persistence;
- no PostgreSQL implementation of `SocialContentPublishStore`;
- no durable schedule/input persistence;
- no publication worker wiring;
- no provider adapter;
- no webhook endpoint or inbox;
- no analytics persistence;
- a static connections view and empty results view.

Weekly post approval records only `approved_at`. The weekly outline contains a tentative `dayOffset`, explicitly not an exact publishing time. Scheduling must therefore collect an absolute `publishAt`; it must not reinterpret `dayOffset` as an approved schedule.

## Required implementation

The resulting flow is:

1. A founder approves the existing weekly post batch.
2. For each desired channel/account, the founder chooses an exact time and confirms any canonical execution field not present in the weekly artifact.
3. A provider-neutral materializer creates immutable canonical publication inputs.
4. The application creates one `SocialContentSchedule` per channel/account.
5. The existing operator worker finds due schedules.
6. The worker calls `runDurableSocialContentPublish`.
7. The durable store claims the attempt before provider interaction.
8. `ZernioPublisher` uploads required media and sends one immediate Zernio publication request.
9. The canonical result is recorded.
10. Webhooks and polling reconcile ambiguous or asynchronously completed outcomes.
11. Analytics are ingested into provider-neutral metrics.

Direct publishing without founder approval remains disabled.

## Exact persistence additions

Use four ordered migrations after the current `0010` migration.

### `0011_social_connections.sql`

#### `social_provider_profiles`

One provider-owned tenant/profile per UNDA brand.

| Column | Type | Rules |
|---|---|---|
| `id` | text | Primary key; internal ID |
| `brand_id` | text | FK `brands(id)`, cascade on brand deletion |
| `provider` | text | Nonblank; initially `zernio` |
| `provider_profile_ref` | text | Nonblank provider ID |
| `status` | text | `active`, `disabled`, or `error` |
| `last_error_code` | text nullable | Sanitized canonical code |
| `created_at` | timestamptz | Required |
| `updated_at` | timestamptz | Required |

Constraints:

- unique `(brand_id, provider)`;
- unique `(provider, provider_profile_ref)`;
- unique `(id, brand_id, provider)` to support composite tenant-safe foreign keys.

Zernio recommends one profile per customer or brand, with social accounts assigned to that profile. UNDA must store and enforce that association because the API key may see accounts outside the current brand. [Zernio multi-tenant guide](https://docs.zernio.com/multi-tenant)

#### `social_publishing_accounts`

Provider-neutral representation corresponding to the existing `SocialPublishingAccount`.

| Column | Type | Rules |
|---|---|---|
| `id` | text | Primary key; used by publishing domain |
| `brand_id` | text | Required |
| `provider_profile_id` | text | Required |
| `provider` | text | Required |
| `channel` | text | `facebook` or `instagram` |
| `provider_account_ref` | text | Provider account ID |
| `username` | text nullable | Display metadata only |
| `display_name` | text nullable | Display metadata only |
| `profile_url` | text nullable | Display metadata only |
| `connection_status` | text | `connected`, `disconnected`, or `error` |
| `can_publish` | boolean | Default false |
| `can_fetch_analytics` | boolean | Default false |
| `capabilities` | jsonb | Sanitized provider capability snapshot |
| `connected_at` | timestamptz nullable | |
| `disconnected_at` | timestamptz nullable | |
| `health_checked_at` | timestamptz nullable | |
| `updated_at` | timestamptz | Required |

Constraints:

- composite FK `(provider_profile_id, brand_id, provider)` to `social_provider_profiles`;
- unique `(provider, provider_account_ref)`;
- unique `(id, channel)` for attempt lineage constraints.

The domain’s `connected` value is derived as:

```text
connection_status = connected AND can_publish = true
```

No Meta or Zernio access tokens are stored.

#### `social_connection_intents`

Short-lived binding between an authenticated UNDA action and the provider callback.

Columns:

- `id` UUID primary key;
- `brand_id`;
- `provider_profile_id`;
- `provider`;
- `requested_channel`;
- `initiated_by_user_id` FK `auth_user(id)`;
- `state_digest` bytea, unique;
- `return_path`, restricted to an internal workspace path;
- `expires_at`;
- `consumed_at` nullable;
- `created_at`.

Only a hash of the opaque callback token is stored.

### `0012_social_scheduling.sql`

#### Existing approval addition

Add `approved_by_user_id text NULL REFERENCES auth_user(id)` to `weekly_post_batches`.

New approvals must populate both `approved_at` and `approved_by_user_id` atomically. Legacy approved batches without an actor require an explicit scheduling confirmation; they must not be silently treated as canonical human approvals.

#### `social_publication_inputs`

An immutable provider-neutral bundle used to hydrate existing domain objects.

Columns:

- `id` text primary key;
- `brand_id`;
- `source_weekly_run_id` UUID FK `weekly_post_batches(run_id)`;
- `post_key`;
- `channel`;
- `content_id`;
- `content_brief_id`;
- `content_execution_spec_id`;
- `draft_id`;
- `draft_version`;
- `bundle` JSONB;
- `created_at`.

Unique `(source_weekly_run_id, post_key, channel)`.

`bundle` contains the canonical, validated snapshots required by the current domain:

- `ContentBrief`;
- `ContentExecutionSpec`;
- `SocialContentDraft`;
- `SocialContentDraftEvaluationAudit`;
- `SocialContentReviewRequest`;
- `SocialContentReviewDecision`.

It must not contain Zernio data.

The materialization mapping is:

- `text` and `image` → `staticPost`;
- `carousel` → `carousel`;
- `story` → `story`;
- `reel` → `reel`;
- channel copy comes only from the matching `PostVariant`;
- IDs are stable functions of approved run, post key, channel, and draft version;
- `contentMode`, currently absent from the weekly payload, is selected explicitly during scheduling and validated by the existing execution-spec assembler;
- missing or invalid canonical information blocks scheduling rather than being guessed.

#### `social_publication_input_assets`

Ordered asset manifest separate from the copy-only draft.

Columns:

- `publication_input_id`;
- `ordinal`;
- `weekly_post_asset_id` UUID FK `weekly_post_assets(id)`;
- `media_type`;
- `alt_text` nullable.

Primary key `(publication_input_id, ordinal)` and unique `(publication_input_id, weekly_post_asset_id)`.

#### `social_content_schedules`

Persistence for the existing canonical schedule.

Columns:

- `id` text primary key;
- `brand_id`;
- `publication_input_id`;
- `publishing_account_id`;
- `content_id`;
- `draft_id`;
- `draft_version`;
- `content_execution_spec_id`;
- `channel`;
- `authorization` JSONB;
- `publish_at`;
- `scheduled_at`.

Constraints:

- unique `(publication_input_id, publishing_account_id)`;
- composite channel-safe FK to the selected account;
- `publish_at > scheduled_at`;
- unique `(id, channel)`.

#### `social_content_schedule_events`

Immutable reschedule/cancel events.

Columns:

- `id` text primary key;
- `schedule_id`;
- `revision`;
- `event_type`: `rescheduled` or `cancelled`;
- `publish_at` nullable;
- `actor_user_id`;
- `occurred_at`;
- `reason` nullable.

Unique `(schedule_id, revision)`. Current state is derived using the existing schedule-lifecycle functions.

#### Foreign keys for existing attempts

Add tenant-safe foreign keys from `social_publish_attempts` to:

- `(schedule_id, channel)` in `social_content_schedules`;
- `(publishing_account_id, channel)` in `social_publishing_accounts`.

The migration must fail with a clear preflight error if legacy orphan rows exist. It must not delete or rewrite them silently.

### `0013_social_provider_delivery.sql`

#### `social_provider_publish_requests`

Provider request journal; one row per canonical attempt.

Columns:

- `attempt_id` text primary key FK `social_publish_attempts`;
- `provider`;
- `request_id` UUID unique;
- `request_fingerprint`;
- `state`: `prepared`, `preparingMedia`, `readyToDispatch`, `dispatchStarted`, or `responseReceived`;
- `provider_publication_ref` nullable;
- `duplicate_publication_ref` nullable;
- `http_status` nullable;
- `last_error_code` nullable;
- `dispatch_started_at` nullable;
- `response_received_at` nullable;
- `created_at`;
- `updated_at`.

This journal distinguishes “definitely not dispatched” from “dispatch may have reached the provider” after a worker crash.

#### `social_provider_media_uploads`

Columns:

- `attempt_id`;
- `ordinal`;
- `source_asset_id`;
- `media_type`;
- `content_sha256`;
- `provider_public_url`;
- `expires_at`;
- `created_at`.

Primary key `(attempt_id, ordinal)`. Never persist a presigned upload URL or authorization header.

#### `social_publish_reconciliations`

Persistence for canonical reconciliation records.

Columns include:

- reconciliation ID;
- `unknown_result_id`;
- attempt and complete publication lineage;
- status;
- provider publication reference/published time where applicable;
- failure classification and reason fields;
- `checked_at`.

Multiple inconclusive observations may exist. Terminal observations must be idempotent.

The provider-neutral reconciliation domain should be extended additively with:

```ts
{
  status: "publicationFailed"
  failureType: "retryable" | "permanent"
  reasonCode: string
  message?: string
}
```

This is required because an initially accepted/pending Zernio post may later fail. Treating a confirmed permanent failure as merely `confirmedAbsent` would cause an unsafe or pointless retry. This additive change belongs in `src/blueprints/social`, not `src/core`, and does not alter the durable attempt/result model.

#### `social_provider_webhook_events`

Durable webhook inbox.

Columns:

- `provider`;
- `event_id`;
- `event_type`;
- `payload_hash`;
- `payload` JSONB;
- `status`: `pending`, `processing`, `processed`, `ignored`, or `failed`;
- `processing_attempts`;
- `next_attempt_at`;
- `lease_token`;
- `lease_until`;
- `received_at`;
- `processed_at` nullable;
- `last_error_code` nullable.

Primary key `(provider, event_id)` and a partial pending-work index.

### `0014_social_analytics.sql`

#### `social_analytics_cursors`

Cursor per provider profile:

- `provider`;
- `provider_profile_id`;
- `cursor`;
- `bootstrapped_at`;
- `updated_at`.

Primary key `(provider, provider_profile_id)`.

#### `social_post_analytics`

Normalized snapshots:

- internal ID;
- provider;
- publishing account ID;
- provider publication reference;
- platform publication reference and URL;
- provider update time;
- observed time;
- nullable `impressions`, `reach`, `likes`, `comments`, `shares`, `saves`, `clicks`, `views`, and `follows`;
- nullable `engagement_rate`;
- `metric_availability` JSONB;
- sanitized `raw_metrics` JSONB.

Unique `(provider, publishing_account_id, provider_publication_ref, provider_updated_at)`.

Unavailable metrics remain `NULL`; they must not be converted to zero.

## Zernio adapter responsibilities

Implement a small native-`fetch` client rather than introducing Zernio types outside infrastructure.

`ZernioPublisher` must:

1. Implement the existing `SocialContentPublisher` type exactly.
2. Accept only canonical attempt, draft, execution-spec, and publishing-account objects.
3. Reload and verify the account’s brand/profile/channel binding before dispatch.
4. Resolve the provider-neutral asset manifest by draft/publication-input ID.
5. Validate required media before the publication request.
6. Upload media just in time through Zernio’s presigned-media flow.
7. Write the provider request journal before and around network dispatch.
8. Send exactly one target in `platforms`.
9. Set `publishNow: true`.
10. Omit `scheduledFor`, `queuedFromProfile`, `queueId`, `isDraft`, and recycling.
11. Include non-secret metadata such as `undaAttemptId` and `undaScheduleId`.
12. Return only canonical provider outcomes.

Zernio supports `publishNow`, provider-side scheduling, queue scheduling, and two duplicate-protection layers. This implementation must use only `publishNow`. Its approximately five-minute `x-request-id` protection supplements—but does not replace—UNDA’s durable idempotency. [Zernio create-post API](https://docs.zernio.com/posts/create-post)

### Request identity

- Generate one UUID `x-request-id` per canonical attempt.
- Persist it before dispatch.
- Reuse it only for the same attempt.
- A new confirmed-safe attempt number receives a new request ID.
- Never share a request ID between Facebook and Instagram or between accounts.
- Keep the existing stable UNDA idempotency key unchanged.

### Media behavior

Media upload calls happen within the adapter before the single publication request.

- Upload failure before `dispatchStarted` is definitely not sent.
- A worker crash before `dispatchStarted` may be recovered as `retryableFailure`.
- A crash or transport error after `dispatchStarted` becomes `unknownOutcome`.
- Incomplete asset sets block before provider publication.
- Current image assets support static-image, carousel, and image-story publishing.
- Reels remain unschedulable from the current UI until a durable video upload/storage path exists.

## Connection flow

Use Zernio’s hosted, non-headless connection flow. Zernio returns an `authUrl`; standard mode handles provider-specific account selection before returning to UNDA. Facebook requires Page selection, while Instagram’s default `instagram_login` connects a professional Instagram account directly. [Zernio OAuth connect API](https://docs.zernio.com/connect/get-connect-url)

### Initiation

`POST /api/social/connections/[platform]`:

1. Authenticate using the existing work-request helper.
2. Enforce same-origin mutation protection.
3. Verify ownership of the active brand.
4. Allow only `facebook` or `instagram`.
5. Create or retrieve the brand’s Zernio profile.
6. Create a short-lived connection intent and opaque callback token.
7. Construct the callback from server-owned `BETTER_AUTH_URL`; never accept an arbitrary callback URL from the client.
8. Request `GET /v1/connect/{platform}` with the profile ID and callback URL.
9. Return the `authUrl` for browser navigation.

Instagram uses `loginMethod=instagram_login` initially. The Facebook-linked Instagram variant is a later opt-in, not an automatic fallback.

### Callback

`GET /api/social/connections/zernio/callback`:

1. Require a valid authenticated session.
2. Validate the opaque intent token, expiry, requested channel, brand ownership, and single-use state.
3. Treat callback fields as hints only.
4. On a reported success, fetch the account from Zernio.
5. Verify its account ID, profile ID, platform, active status, and health/capabilities.
6. Upsert the provider-neutral account in the same transaction that consumes the intent.
7. Redirect to the connections page with an internal success/failure code.

Unknown callback error codes are displayed as generic failures. Raw provider strings are not reflected into HTML.

### Account events

`account.connected` and `account.disconnected` webhooks refresh the account from Zernio and update connection state only when the provider profile is already bound to a UNDA brand.

## Publishing integration

### Scheduling

The approved-post UI must collect:

- one connected account for each selected channel;
- an exact absolute publication time;
- a provider-neutral content mode when the approved weekly artifact does not contain one.

The application then:

1. Verifies the batch is approved and has no unresolved blocking review issue.
2. Materializes immutable canonical inputs without invoking a model or rewriting copy.
3. Runs the existing scheduling eligibility and assembly functions.
4. Creates one schedule per `(publication input, account)`.
5. Records reschedules/cancellations as lifecycle events.

For a post targeting Facebook and Instagram, two schedules are created even if their times and copy are identical.

### Worker

Add publishing, webhook, reconciliation, and analytics ticks to the persistent process behind `npm run worker:operator`.

The worker must:

- query due schedules from PostgreSQL;
- derive current lifecycle state;
- hydrate canonical input and account objects;
- call `runDurableSocialContentPublish`;
- use the existing store claim as concurrency control;
- use a maximum of three attempts unless configuration says otherwise;
- never retry `unknownOutcome`;
- isolate failures between worker subsystems so a webhook error does not stop planning or publishing.

Zernio must receive no future scheduling timestamp. Restarting UNDA must not lose due work.

## Canonical error mapping

| Condition | Canonical outcome |
|---|---|
| Local validation or missing media | `permanentFailure` |
| Disconnected/wrong-profile/wrong-channel account | `permanentFailure` |
| Media upload throttling or temporary failure, before post dispatch | `retryableFailure` |
| Zernio 429 before acceptance | `retryableFailure`, honoring `Retry-After` |
| Provider authentication/billing/permission failure known to precede creation | `permanentFailure` |
| Immediate response confirms one platform published | `published` |
| Immediate response confirms terminal platform failure | `permanentFailure` |
| Zernio returns accepted/pending/scheduled because it is retrying | `unknownOutcome` |
| Duplicate-content 409 with `existingPostId` | `unknownOutcome`; reconcile that ID |
| Timeout/reset after request-body dispatch may have begun | `unknownOutcome` |
| Successful HTTP status with invalid/truncated response | `unknownOutcome` |
| 5xx where acceptance cannot be excluded | `unknownOutcome` |
| DNS/TLS/connect failure proven to occur before dispatch | `retryableFailure` |
| Unexpected multi-platform response | `unknownOutcome` plus protocol alert |

Error codes stored in canonical results use stable UNDA names such as:

- `providerRateLimited`;
- `providerUnavailableBeforeDispatch`;
- `providerAuthenticationFailed`;
- `publishingAccountDisconnected`;
- `providerRejectedContent`;
- `providerDuplicatePossible`;
- `providerAcceptedPending`;
- `providerResponseMissing`;
- `providerProtocolError`;
- `mediaUploadFailed`;
- `mediaManifestIncomplete`.

Raw provider messages may be stored only after sanitization and must not be used for application control flow.

## Webhook verification, deduplication, and reconciliation

### HTTP receipt

Create `POST /api/webhooks/zernio` using the Next.js Node runtime.

The handler must:

1. Read a bounded raw body with `request.text()`.
2. Require `X-Zernio-Signature`.
3. Compute lowercase hex HMAC-SHA256 with `ZERNIO_WEBHOOK_SECRET`.
4. Compare fixed-length byte buffers with `timingSafeEqual`.
5. Parse JSON only after signature verification.
6. Require `payload.id`.
7. If present, require `X-Zernio-Event-Id` to equal `payload.id`.
8. Insert into the webhook inbox with `(provider, event_id)` uniqueness.
9. Return `204` immediately for both new and duplicate valid events.

Zernio documents at-least-once delivery, stable event IDs, raw-body HMAC verification, and a five-second acknowledgement requirement. [Zernio webhook guide](https://docs.zernio.com/webhooks)

No session or same-origin check applies to this public webhook route; the signature is its authentication.

### Async processing

The worker handles:

- `account.connected`;
- `account.disconnected`;
- `post.platform.published`;
- `post.platform.failed`;
- relevant post rollups as fallback;
- `analytics.synced`.

Per-platform events are authoritative. Because every UNDA request has exactly one target, a post webhook must resolve to one schedule/account.

Correlation order:

1. provider post reference stored in the request journal;
2. `existingPostId` from duplicate protection;
3. `undaAttemptId` metadata returned by post reads/webhooks;
4. recent provider posts matched by profile, account, channel, and metadata.

An event that arrives before its attempt/result is persisted remains pending and is retried asynchronously.

### Orphaned attempts

For an attempt with no result after the grace period:

- no `dispatch_started_at` → record canonical `retryableFailure(providerRequestNotDispatched)`;
- `dispatch_started_at` present → record canonical `unknownOutcome(providerResponseMissing)`;
- then use the normal retry or reconciliation decision path.

This closes the current gap between a durable claimed attempt and the reconciliation contract, which requires an `unknownOutcome` result.

### Reconciliation outcomes

- Confirmed published → `publicationFound`.
- Provider positively establishes no post exists → `confirmedAbsent`.
- Provider reports terminal failed → `publicationFailed`.
- Pending, temporarily unreadable, or unmatched → `inconclusive`.

A single “not found” lookup is not enough for `confirmedAbsent`. The worker must observe the configured consistency interval and use account/profile/metadata checks.

Webhook and polling reconciliation write canonical reconciliation records; they never overwrite the immutable original result.

## Analytics

Zernio’s `analytics.synced` webhook is a trigger rather than a metrics payload. The current API requires consumers to call the delta endpoint using their last stored cursor. The initial delta call without a cursor starts “from now,” so existing published posts must first be bootstrapped through the regular analytics endpoint. [Zernio September 2026 changelog](https://docs.zernio.com/changelog), [analytics API](https://docs.zernio.com/analytics/get-analytics)

### Ingestion

For every active provider profile:

1. Bootstrap published UNDA posts through `GET /v1/analytics`, filtered to the profile/account and Zernio-originated posts.
2. Persist the returned snapshots.
3. Initialize and store the profile delta cursor.
4. On `analytics.synced` or periodic fallback polling, call `/v1/analytics/delta`.
5. Process pages oldest-first while `hasMore=true`.
6. Commit snapshot rows and `nextCursor` in the same database transaction.
7. Never advance a cursor past an uncommitted snapshot.

### Normalization

Normalize only factual provider metrics:

- impressions;
- reach;
- likes;
- comments;
- shares;
- saves;
- clicks;
- views;
- follows;
- engagement rate when explicitly supplied.

Store unsupported/unavailable values as `NULL`, preserving metric availability separately. Do not infer performance, audience preference, causality, or optimal posting time.

The Results view may show latest factual metrics and publication status. It must not feed them automatically into planning in this scope.

## Security and environment variables

Add to `.env.example`:

```dotenv
SOCIAL_PUBLISHING_ENABLED=false
SOCIAL_PUBLISH_MAX_ATTEMPTS=3
SOCIAL_PUBLISH_ATTEMPT_GRACE_SECONDS=120

ZERNIO_API_BASE_URL=https://zernio.com/api/v1
ZERNIO_API_KEY=
ZERNIO_WEBHOOK_SECRET=

SOCIAL_ANALYTICS_ENABLED=false
SOCIAL_ANALYTICS_POLL_SECONDS=900
```

Continue using `BETTER_AUTH_URL` as the canonical application origin.

Requirements:

- All Zernio variables are server-only; none use a `NEXT_PUBLIC_` prefix.
- Production startup fails if social publishing is enabled without the API key, webhook secret, or HTTPS application origin.
- The API base override is accepted only as a valid HTTPS origin in production.
- Never log API keys, bearer headers, webhook secrets, presigned upload URLs, OAuth callback payloads, or full provider responses.
- Apply explicit request timeouts and bounded response-body reads.
- OAuth initiation and scheduling routes use existing authentication, ownership, and origin protections.
- Reverify account-to-profile-to-brand ownership immediately before publishing.
- Rate-limit connection initiation per user/brand.
- Retain webhook payloads only as long as operationally required and remove unneeded provider fields during ingestion.
- Do not store Meta credentials; Zernio owns upstream OAuth tokens.

## Files/modules to create or modify

### Create

Migrations:

- `db/migrations/0011_social_connections.sql`
- `db/migrations/0012_social_scheduling.sql`
- `db/migrations/0013_social_provider_delivery.sql`
- `db/migrations/0014_social_analytics.sql`

Application:

- `src/application/social-connections/service.ts`
- `src/application/publishing/materialize-approved-post.ts`
- `src/application/publishing/run-publish-queue.ts`
- `src/application/publishing/run-publish-reconciliation.ts`
- `src/application/analytics/ingest-social-analytics.ts`

Zernio infrastructure:

- `src/infrastructure/zernio/environment.ts`
- `src/infrastructure/zernio/client.ts`
- `src/infrastructure/zernio/profiles.ts`
- `src/infrastructure/zernio/accounts.ts`
- `src/infrastructure/zernio/media.ts`
- `src/infrastructure/zernio/publisher.ts`
- `src/infrastructure/zernio/reconciliation.ts`
- `src/infrastructure/zernio/analytics.ts`
- `src/infrastructure/zernio/webhooks.ts`

PostgreSQL:

- `src/infrastructure/postgres/social-connections-store.ts`
- `src/infrastructure/postgres/social-publication-store.ts`
- `src/infrastructure/postgres/social-publish-store.ts`
- `src/infrastructure/postgres/social-webhook-store.ts`
- `src/infrastructure/postgres/social-analytics-store.ts`

Worker:

- `src/worker/social-publishing.ts`
- `src/worker/social-webhooks.ts`
- `src/worker/social-analytics.ts`

Routes/UI:

- `src/app/api/social/connections/[platform]/route.ts`
- `src/app/api/social/connections/zernio/callback/route.ts`
- `src/app/api/social/schedules/route.ts`
- `src/app/api/webhooks/zernio/route.ts`
- `src/app/workspace/connections-client.tsx`
- `src/app/workspace/social-schedule-controls.tsx`
- `src/app/workspace/results-client.tsx`

Tests:

- `tests/zernio-client.test.mts`
- `tests/zernio-publisher.test.mts`
- `tests/social-connections.integration.test.mts`
- `tests/social-publish-store.integration.test.mts`
- `tests/social-scheduling.integration.test.mts`
- `tests/zernio-webhook.integration.test.mts`
- `tests/social-reconciliation.integration.test.mts`
- `tests/social-analytics.integration.test.mts`

### Modify

- [publish-store.ts](<D:/desk/unda project/unda-social-operator/src/application/publishing/publish-store.ts>)
- [publishing/index.ts](<D:/desk/unda project/unda-social-operator/src/application/publishing/index.ts>)
- [content-publish-reconciliation.ts](<D:/desk/unda project/unda-social-operator/src/blueprints/social/content-publish-reconciliation.ts>)
- [content-publish-reconciliation-decision.ts](<D:/desk/unda project/unda-social-operator/src/blueprints/social/content-publish-reconciliation-decision.ts>)
- [social/index.ts](<D:/desk/unda project/unda-social-operator/src/blueprints/social/index.ts>)
- [weekly-posts-store.ts](<D:/desk/unda project/unda-social-operator/src/infrastructure/postgres/weekly-posts-store.ts>)
- [postgres/index.ts](<D:/desk/unda project/unda-social-operator/src/infrastructure/postgres/index.ts>)
- [brand-discovery-worker.mts](<D:/desk/unda project/unda-social-operator/scripts/brand-discovery-worker.mts>)
- [workspace page](<D:/desk/unda project/unda-social-operator/src/app/workspace/[[...section]]/page.tsx>)
- [workspace views](<D:/desk/unda project/unda-social-operator/src/app/workspace/views.tsx>)
- [weekly-posts-client.tsx](<D:/desk/unda project/unda-social-operator/src/app/workspace/weekly-posts-client.tsx>)
- `.env.example`
- `README.md`
- `package.json`

`src/core` receives no changes.

## Tests required

### Domain and application tests

- Existing durable publication tests continue passing unchanged.
- One provider invocation occurs after an acquired claim.
- Duplicate workers produce one attempt and one provider invocation.
- Stored attempt/result resume without provider access.
- Unknown outcomes never retry automatically.
- Orphaned pre-dispatch and post-dispatch attempts produce different canonical results.
- Reconciliation validates complete lineage.
- `publicationFailed` produces stop/retry behavior based on its failure type.
- Facebook and Instagram fan-out creates separate schedules and attempts.
- Rescheduling preserves the existing stable publication-intent idempotency key.
- Cancellation prevents provider access.

### Adapter tests

Using a scripted fake HTTP server:

- exact bearer authentication and bounded timeouts;
- `publishNow: true`;
- scheduling/queue fields absent;
- exactly one `platforms` entry;
- correct account/channel mapping;
- distinct request IDs per attempt;
- request ID reuse for the same attempt only;
- media ordering and upload behavior;
- published, pending, failed, 409, 429, 4xx, 5xx, malformed response, timeout, and connection-failure mapping;
- no post request after media-validation failure;
- no secrets in errors or logs.

### Connection tests

- authenticated owner can initiate a connection;
- unauthenticated, cross-owner, bad-origin, unsupported-platform, expired-state, reused-state, and profile-mismatch cases fail;
- callback account ID is refetched and verified;
- Facebook and Instagram remain distinct accounts;
- disconnected or `can_publish=false` accounts fail publication eligibility.

### PostgreSQL tests

- concurrent `claimAttempt` is atomic;
- `recordResult` is idempotent and rejects conflicting results;
- composite tenant/channel constraints prevent cross-brand publication;
- schedule event revisions are ordered and immutable;
- webhook event insertion deduplicates;
- analytics cursor and page commit are atomic.

### Webhook/reconciliation tests

- valid signature accepted;
- missing, malformed, or mismatched signature rejected;
- raw body—not reserialized JSON—is signed;
- duplicate event returns success without duplicate processing;
- out-of-order events converge;
- published/failed/account events update only their bound brand/account;
- unknown event types are safely ignored;
- webhook-before-result is retried;
- no-match reconciliation remains inconclusive;
- one lookup miss does not become confirmed absent.

### Analytics tests

- bootstrap precedes cursor mode;
- `hasMore` drains all pages;
- cursor does not advance after write failure;
- duplicate snapshots are idempotent;
- unavailable metrics remain null;
- profile/account isolation is enforced.

No default automated test may publish to a real social account. Optional sandbox smoke tests require a separate explicit environment flag and disposable accounts.

## Explicit non-goals

- Replacing or bypassing `SocialContentPublisher`.
- Replacing the durable attempt/result tables with a Zernio job table.
- Using Zernio schedules, queues, recurring posts, or recycling.
- Combining Facebook and Instagram in one Zernio request.
- Letting webhooks directly publish or retry content.
- Storing Meta OAuth tokens in UNDA.
- Automatic direct publishing without founder approval.
- AI-generated conclusions from analytics.
- Automatically changing future plans based on analytics.
- Inbox, comments, DMs, ads, engagement automation, or contact synchronization.
- Backfilling external posts not created by this integration.
- Video generation, transcoding, or a new large-video storage system; current reels remain blocked until a complete video asset exists.
- Refactoring planning, drafting, scheduling, or publishing domain logic specifically for Zernio.
- Adding Zernio types to `src/core`.

## Acceptance criteria

The implementation is accepted when:

1. A brand can connect and persist a verified Facebook Page and professional Instagram account.
2. Accounts cannot be attached to a different UNDA brand/profile.
3. A founder-approved post can be scheduled at an exact absolute time.
4. Each platform/account produces a distinct canonical schedule.
5. Due schedules are published by the existing persistent worker.
6. Every Zernio request uses `publishNow: true` and contains exactly one target.
7. The attempt is durably claimed before media upload or publication.
8. Concurrent workers cannot issue duplicate publication requests.
9. Existing attempts/results resume without reissuing the request.
10. Ambiguous dispatches become `unknownOutcome`, never retryable failures.
11. Unknown outcomes require webhook or polling reconciliation.
12. Webhooks are raw-body verified, deduplicated, persisted quickly, and processed asynchronously.
13. Published and terminal-failed provider outcomes converge into canonical decisions without overwriting history.
14. Basic provider metrics appear in the Results view with unavailable metrics shown as unavailable, not zero.
15. Disabling `SOCIAL_PUBLISHING_ENABLED` prevents all provider publication calls while leaving planning and drafting operational.
16. Removing `ZernioPublisher` and supplying a future Meta implementation requires no changes to planning, drafting, scheduling, or publishing-domain contracts.
17. No Zernio-specific symbol appears under `src/core`.
18. Existing domain, planning, discovery, dashboard, and auth tests remain passing.

## Build/test commands

Add a focused script:

```json
"test:social": "node --env-file=.env.local --import tsx --test tests/zernio-client.test.mts tests/zernio-publisher.test.mts tests/social-connections.integration.test.mts tests/social-publish-store.integration.test.mts tests/social-scheduling.integration.test.mts tests/zernio-webhook.integration.test.mts tests/social-reconciliation.integration.test.mts tests/social-analytics.integration.test.mts"
```

Required verification sequence:

```powershell
npm run db:up
npm run db:migrate
npm run db:status
npm run check
npm run lint
npm run build:domain
npm test
npm run test:social
npm run test:integration
npm run test:planning
npm run test:dashboard
npm run test:auth
npm run build
npm run verify
```

Before relying on `npm test`, repair its current references to the nonexistent `content-draft-repair-contract.runtime.test.cjs`, `content-draft-repair-llm-contract.runtime.test.cjs`, and `content-publish-run.e2e.test.cjs`, and include the existing durable publication and reconciliation suites. This is test-runner maintenance only; it must not remove coverage.