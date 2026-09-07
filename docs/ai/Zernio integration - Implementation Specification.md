# Zernio Social Publishing Integration — Revised Implementation Specification

## Status

Specification only. No code changes are authorized by this document.

This revision uses the current repository as the source of truth and incorporates Zernio’s API behavior documented as of September 7, 2026.

## Goal

Add Facebook and Instagram connections, durable publication through Zernio, webhook reconciliation, and basic analytics while preserving UNDA’s provider-neutral social publishing domain.

The integration must:

- keep UNDA as the sole scheduling authority;
- implement Zernio behind the existing `SocialContentPublisher` boundary;
- retain the existing durable attempt/result flow;
- create one schedule and one provider publication request per platform/account;
- preserve a stable UNDA publishing-account identity across provider migrations;
- remain replaceable by a future direct Meta adapter;
- introduce no Zernio-specific types into `src/core`.

## Current architecture — preserve

### Repository boundaries

The existing layering remains:

- `src/core`: operator-neutral primitives and domain concepts. No Zernio types, IDs, errors, or API shapes.
- `src/blueprints/social`: provider-neutral social-content, scheduling, publication, retry, and reconciliation contracts.
- `src/application`: orchestration and persistence ports.
- `src/infrastructure`: PostgreSQL stores, provider clients, media transport, and provider adapters.
- `src/app`: authenticated Next.js routes and UI.
- `src/worker`: durable background processing through the existing operator worker.

### Existing publication boundary

[content-publish-run.ts](<D:/desk/unda project/unda-social-operator/src/blueprints/social/content-publish-run.ts:62>) defines:

```ts
type SocialContentPublisher = (
  input: SocialContentPublisherInput,
) => Promise<SocialContentPublishProviderOutcome>
```

This remains the only publishing-provider boundary. `ZernioPublisher` implements it; application and domain services must not import Zernio request or response types.

The existing contract already establishes:

- definitely not sent → `retryableFailure` or `permanentFailure`;
- possibly accepted → `unknownOutcome`;
- ambiguous post-send failures must never become `retryableFailure`.

### Existing durable publication flow

[run-durable-publish.ts](<D:/desk/unda project/unda-social-operator/src/application/publishing/run-durable-publish.ts:395>) remains the publication entry point:

1. Resolve eligibility.
2. Assemble the canonical attempt.
3. Claim `(idempotencyKey, attemptNumber)` before provider interaction.
4. Resume existing attempts/results without calling the provider again.
5. Call `SocialContentPublisher` exactly once when the claim is acquired.
6. Assemble the canonical result.
7. Persist the result idempotently.

An unresolved claimed attempt becomes `reconciliationRequired` after the grace interval. It must never be resent automatically.

The existing [0006_social_publish.sql](<D:/desk/unda project/unda-social-operator/db/migrations/0006_social_publish.sql>) remains authoritative:

- `social_publish_attempts` is the immutable attempt record.
- `social_publish_results` stores one canonical result per attempt.
- `(idempotency_key, attempt_number)` is the atomic claim.
- Result statuses remain `published`, `retryableFailure`, `permanentFailure`, and `unknownOutcome`.

### Existing scheduling semantics

The current domain represents one destination per execution specification and one channel per schedule:

- [content-execution-spec.ts](<D:/desk/unda project/unda-social-operator/src/blueprints/social/content-execution-spec.ts>)
- [content-schedule.ts](<D:/desk/unda project/unda-social-operator/src/blueprints/social/content-schedule.ts>)
- [content-publish-eligibility.ts](<D:/desk/unda project/unda-social-operator/src/blueprints/social/content-publish-eligibility.ts>)

A post targeting Facebook and Instagram therefore becomes two independent execution specifications, drafts, schedules, attempts, results, and provider requests.

### Current integration gaps

The repository currently has:

- no social connection persistence;
- no PostgreSQL `SocialContentPublishStore`;
- no durable schedule/input persistence;
- no publication worker integration;
- no provider adapter;
- no webhook endpoint or inbox;
- no analytics persistence;
- a static connections view and empty results view.

Weekly approval records only `approved_at`. The weekly outline contains a tentative `dayOffset`, explicitly not an exact publication time. Scheduling must collect an absolute `publishAt`; it must not reinterpret `dayOffset` as an approved schedule.

## Required implementation

The target flow is:

1. A founder approves the existing weekly post batch.
2. A stable provider-neutral UNDA publishing account is connected to an active provider binding.
3. For every desired channel/account, the founder chooses an exact publication time and confirms any missing provider-neutral execution fields.
4. A versioned materializer creates immutable canonical publication inputs.
5. One `SocialContentSchedule` is created per channel/account.
6. The existing operator worker discovers due schedules.
7. The worker resolves the account’s active provider binding and selects the corresponding `SocialContentPublisher`.
8. The durable flow claims the attempt before provider interaction.
9. `ZernioPublisher` uploads required media and sends one immediate publication request.
10. The canonical result is persisted.
11. Webhooks and polling reconcile ambiguous or asynchronous outcomes.
12. Analytics are ingested against the stable UNDA publishing-account identity.

Direct publishing without founder approval remains disabled.

## Provider-neutral account identity

### Canonical account

`SocialPublishingAccountId` identifies the social destination inside UNDA, not a Zernio connection.

The canonical account must survive:

- Zernio reconnection;
- a changed Zernio account identifier;
- migration from Zernio to direct Meta;
- temporary provider disconnection;
- provider credential rotation.

Schedules, attempts, results, reconciliations, and analytics continue referencing the same canonical account ID.

### Provider binding

Provider-specific connection identity lives only in `social_provider_account_bindings`.

When hydrating the existing `SocialPublishingAccount`:

```text
id                 = social_publishing_accounts.id
channel            = social_publishing_accounts.channel
providerAccountRef = active binding.provider_account_ref
connected          = active binding is connected and can_publish is true
```

Before hydration, the application resolves the active binding and selects the matching publisher from a provider registry. The domain object does not need a `provider` field.

### Provider migration

Replacing Zernio with direct Meta must:

1. Verify the new binding belongs to the same channel and native platform account.
2. Refuse migration while an earlier binding has an unresolved dispatched attempt.
3. Insert the new binding.
4. Retire the old binding and activate the new binding atomically.
5. Preserve the canonical publishing-account ID.
6. Leave schedules, attempts, results, and analytics attached to that canonical ID.

Every provider request journal records the exact binding used, preserving provider-specific historical provenance without changing canonical lineage.

## Exact persistence additions

Use four ordered migrations after `0010`.

## `0011_social_connections.sql`

### `social_provider_profiles`

Provider tenancy/profile bindings for an UNDA brand.

| Column | Type | Rules |
|---|---|---|
| `id` | text | Internal primary key |
| `brand_id` | text | FK `brands(id)` |
| `provider` | text | Nonblank; initially `zernio` |
| `provider_profile_ref` | text | External provider profile ID |
| `status` | text | `active`, `disabled`, or `error` |
| `last_error_code` | text nullable | Sanitized canonical code |
| `created_at` | timestamptz | Required |
| `updated_at` | timestamptz | Required |

Constraints:

- unique `(brand_id, provider)`;
- unique `(provider, provider_profile_ref)`;
- unique `(id, brand_id, provider)`.

Zernio recommends one profile per customer or brand. UNDA must enforce this binding because a team-level API key may access accounts outside the current brand. [Zernio multi-tenant guide](https://docs.zernio.com/multi-tenant)

### `social_publishing_accounts`

Stable provider-neutral publishing destinations.

| Column | Type | Rules |
|---|---|---|
| `id` | text | Canonical `SocialPublishingAccountId` |
| `brand_id` | text | FK `brands(id)` |
| `channel` | text | `facebook` or `instagram` |
| `native_account_ref` | text nullable | Meta Page/account identity when verifiably available |
| `username` | text nullable | Provider-independent display metadata |
| `display_name` | text nullable | Provider-independent display metadata |
| `profile_url` | text nullable | Provider-independent display metadata |
| `created_at` | timestamptz | Required |
| `updated_at` | timestamptz | Required |

This table must not contain:

- `provider`;
- `provider_profile_id`;
- `provider_profile_ref`;
- `provider_account_ref`;
- connection status;
- provider capability state.

Constraints:

- unique `(id, channel)`;
- partial unique `(channel, native_account_ref)` where `native_account_ref IS NOT NULL`.

A native identifier must be stored only when it is verified as the actual Facebook Page or Instagram professional-account identity. A Zernio `SocialAccount` ID must never be placed in `native_account_ref`.

### `social_provider_account_bindings`

Historical provider bindings for a canonical account.

| Column | Type | Rules |
|---|---|---|
| `id` | text | Primary key |
| `publishing_account_id` | text | FK canonical account |
| `provider` | text | Initially `zernio` |
| `provider_profile_ref` | text | External provider profile |
| `provider_account_ref` | text | External provider account |
| `binding_status` | text | `active` or `retired` |
| `connection_status` | text | `connected`, `disconnected`, or `error` |
| `can_publish` | boolean | Default false |
| `can_fetch_analytics` | boolean | Default false |
| `capabilities` | jsonb | Sanitized capability snapshot |
| `connected_at` | timestamptz nullable | |
| `disconnected_at` | timestamptz nullable | |
| `health_checked_at` | timestamptz nullable | |
| `created_at` | timestamptz | Required |
| `updated_at` | timestamptz | Required |

Constraints:

- composite FK `(publishing_account_id, channel)` to the canonical account, with `channel` included in the binding;
- composite FK `(provider, provider_profile_ref)` to `social_provider_profiles`;
- unique `(provider, provider_account_ref)`;
- partial unique `(publishing_account_id)` where `binding_status='active'`;
- retired bindings remain immutable except for audit metadata.

A disconnected binding may remain active while waiting for reconnection. `retired` means it has been replaced as the provider route.

### `social_connection_intents`

Short-lived binding between an authenticated UNDA action and a provider callback.

Columns:

- `id` UUID primary key;
- `brand_id`;
- `provider`;
- `provider_profile_ref`;
- `requested_channel`;
- `initiated_by_user_id` FK `auth_user(id)`;
- `state_digest` bytea unique;
- `return_path`, restricted to an internal workspace path;
- `flow_step`;
- `selection_options` JSONB containing sanitized Page choices only;
- `provider_context_ciphertext` bytea nullable;
- `provider_context_iv` bytea nullable;
- `provider_context_tag` bytea nullable;
- `expires_at`;
- `consumed_at` nullable;
- `created_at`;
- `updated_at`.

Only a digest of the public flow token is stored. Facebook’s temporary token, decoded `userProfile`, and `connect_token` are encrypted server-side and never returned to client JavaScript.

## `0012_social_provider_delivery.sql`

### `social_provider_publish_requests`

Provider request journal; one row per canonical attempt.

Columns:

- `attempt_id` text primary key FK `social_publish_attempts`;
- `provider_binding_id` FK `social_provider_account_bindings`;
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

The binding is captured per attempt so provider history remains exact even after account migration.

### `social_provider_media_uploads`

Columns:

- `attempt_id`;
- `ordinal`;
- `source_asset_id`;
- `media_type`;
- `content_sha256`;
- `provider_public_url`;
- `expires_at`;
- `created_at`.

Primary key `(attempt_id, ordinal)`.

Never persist presigned upload URLs, authorization headers, or provider credentials.

### `social_publish_reconciliations`

Persistence for canonical reconciliation records.

Columns include:

- reconciliation ID;
- `unknown_result_id`;
- complete attempt/publication lineage;
- status;
- provider publication reference and publication time where applicable;
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

This is necessary because a request may initially be accepted or pending and later receive a terminal failure. The change belongs in `src/blueprints/social`, not `src/core`, and does not replace the attempt/result model.

### `social_provider_webhook_events`

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

Primary key `(provider, event_id)` with a partial pending-work index.

## `0013_social_scheduling.sql`

### Approval provenance

Add:

```sql
approved_by_user_id text NULL REFERENCES auth_user(id)
```

to `weekly_post_batches`.

New approvals populate `approved_at` and `approved_by_user_id` atomically. Historical approved batches without an actor require explicit scheduling confirmation.

### `social_publication_inputs`

Immutable, versioned, provider-neutral canonical publication bundles.

| Column | Type | Rules |
|---|---|---|
| `id` | text | Primary key |
| `brand_id` | text | Required |
| `source_weekly_run_id` | UUID | FK weekly post batch |
| `post_key` | text | Required |
| `channel` | text | Facebook or Instagram |
| `content_id` | text | Canonical lineage |
| `content_brief_id` | text | Canonical lineage |
| `content_execution_spec_id` | text | Canonical lineage |
| `draft_id` | text | Canonical lineage |
| `draft_version` | integer | Positive |
| `bundle_schema` | text | `unda.social-publication-input` |
| `bundle_version` | integer | Starts at `1` |
| `bundle` | jsonb | Serialized canonical snapshots |
| `created_at` | timestamptz | Required |

Unique `(source_weekly_run_id, post_key, channel)`.

The decoder must dispatch by `(bundle_schema, bundle_version)`. It must not deserialize a bundle as the current domain shape without checking both values.

Rules:

- version 1 is immutable after release;
- new domain shapes receive a new decoder/version;
- previously scheduled bundles remain readable;
- migration to a new version creates an explicit data migration;
- unknown versions fail safely before provider access;
- bundles are never rewritten opportunistically during reads.

`bundle` contains validated snapshots of:

- `ContentBrief`;
- `ContentExecutionSpec`;
- `SocialContentDraft`;
- `SocialContentDraftEvaluationAudit`;
- `SocialContentReviewRequest`;
- `SocialContentReviewDecision`.

It contains no provider or Zernio data.

Materialization rules:

- `text` and `image` → `staticPost`;
- `carousel` → `carousel`;
- `story` → `story`;
- `reel` → `reel`;
- copy comes only from the matching channel variant;
- IDs are stable functions of approved run, post key, channel, and draft version;
- `contentMode`, absent from the current weekly payload, is selected explicitly during scheduling and validated using the existing execution-spec assembler;
- missing canonical information blocks scheduling rather than being guessed.

### `social_publication_input_assets`

Ordered provider-neutral asset manifest:

- `publication_input_id`;
- `ordinal`;
- `weekly_post_asset_id` UUID FK `weekly_post_assets`;
- `media_type`;
- `alt_text` nullable.

Primary key `(publication_input_id, ordinal)`.

### `social_content_schedules`

Persistence for the existing canonical schedule:

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
- composite FK `(publishing_account_id, channel)` to the canonical account;
- `publish_at > scheduled_at`;
- unique `(id, channel)`.

Schedules reference the canonical account only, never a provider binding.

### `social_content_schedule_events`

Immutable reschedule/cancel events:

- `id`;
- `schedule_id`;
- `revision`;
- `event_type`: `rescheduled` or `cancelled`;
- `publish_at` nullable;
- `actor_user_id`;
- `occurred_at`;
- `reason` nullable.

Unique `(schedule_id, revision)`.

Current state is derived with the existing schedule-lifecycle functions.

### Existing-attempt foreign keys

Add channel-safe foreign keys from `social_publish_attempts` to:

- `(schedule_id, channel)` in `social_content_schedules`;
- `(publishing_account_id, channel)` in `social_publishing_accounts`.

The migration must fail with a clear preflight error if orphan rows exist. It must not remove or silently rewrite them.

## `0014_social_analytics.sql`

### `social_analytics_cursors`

Cursor per provider profile:

- `provider`;
- `provider_profile_ref`;
- `cursor`;
- `bootstrapped_at`;
- `updated_at`.

Primary key `(provider, provider_profile_ref)`.

### `social_post_analytics`

Normalized snapshots:

- internal ID;
- canonical `publishing_account_id`;
- `provider_binding_id`;
- provider;
- provider publication reference;
- native/platform publication reference and URL;
- provider update time;
- observed time;
- nullable `impressions`, `reach`, `likes`, `comments`, `shares`, `saves`, `clicks`, `views`, and `follows`;
- nullable `engagement_rate`;
- `metric_availability` JSONB;
- sanitized `raw_metrics` JSONB.

Unique `(provider_binding_id, provider_publication_ref, provider_updated_at)`.

Analytics lineage remains attached to the canonical publishing account even when its active provider binding changes.

Unavailable metrics remain `NULL`; they must not be converted to zero.

## Zernio adapter responsibilities

Use a small native-`fetch` client. Zernio transport types remain under `src/infrastructure/zernio`.

`ZernioPublisher` must:

1. Implement the existing `SocialContentPublisher`.
2. Receive only canonical attempt, draft, execution-spec, and hydrated publishing-account objects.
3. Operate only after the application selects an active Zernio binding.
4. Reverify the binding’s account, profile, brand, channel, connection, and publishing capability before dispatch.
5. Resolve the provider-neutral asset manifest by draft/publication-input ID.
6. Validate required media before publication.
7. Upload media just in time.
8. Journal request state before and around network dispatch.
9. Send exactly one target in `platforms`.
10. Set `publishNow: true`.
11. Omit `scheduledFor`, `queuedFromProfile`, `queueId`, `isDraft`, and recycling.
12. Include non-secret `undaAttemptId` and `undaScheduleId` metadata.
13. Return only canonical provider outcomes.

Zernio’s `x-request-id` protection is approximately five minutes and supplements—but does not replace—UNDA’s durable idempotency. [Zernio create-post API](https://docs.zernio.com/posts/create-post)

### Request identity

- Generate one UUID `x-request-id` per canonical attempt.
- Persist it before dispatch.
- Reuse it only for that attempt.
- A new confirmed-safe attempt receives a new request ID.
- Never share request IDs between accounts or platforms.
- Keep the existing UNDA idempotency key unchanged.

### Media behavior

- Upload failure before `dispatchStarted` is definitely not sent.
- A crash before `dispatchStarted` may become `retryableFailure`.
- A crash or transport failure after `dispatchStarted` becomes `unknownOutcome`.
- Incomplete asset sets block before provider publication.
- Current assets support static-image, carousel, and image-story publishing.
- Reels remain unschedulable until a durable video asset exists.

## Connection flow

## Shared initiation

`POST /api/social/connections/[platform]`:

1. Authenticate using the existing work-request helper.
2. Enforce same-origin mutation protection.
3. Verify active-brand ownership.
4. Allow only `facebook` or `instagram`.
5. Create or retrieve the brand’s Zernio profile.
6. Create a short-lived connection intent and opaque callback token.
7. Build the callback from server-owned `BETTER_AUTH_URL`.
8. Request Zernio’s connect URL.
9. Return the `authUrl`.

The callback URL contains the opaque UNDA flow token. Arbitrary client-supplied callback URLs are prohibited.

## Facebook: headless Page selection

Facebook must use:

```text
GET /v1/connect/facebook
headless=true
```

Zernio returns to UNDA with `profileId`, `tempToken`, encoded `userProfile`, `step=select_page`, and `connect_token`. UNDA then owns the Page-selection UI. The current endpoint requires the decoded `userProfile` when completing selection. [Zernio connection guide](https://docs.zernio.com/guides/connecting-accounts), [Facebook Page selection API](https://docs.zernio.com/connect/select-facebook-page)

### Facebook callback

`GET /api/social/connections/zernio/callback`:

1. Require an authenticated session.
2. Validate the intent token, expiry, owner, brand, provider, and requested channel.
3. Require `platform=facebook` and `step=select_page`.
4. Verify returned `profileId` equals the intent’s provider profile.
5. Parse and structurally validate `userProfile`.
6. Encrypt `tempToken`, `userProfile`, and `connect_token` into the intent.
7. Fetch the manageable Page list server-side using the temporary credentials.
8. Store only sanitized Page choices.
9. Redirect to UNDA’s connection page in Page-selection state.

No temporary provider credential is sent to the browser.

### Page-selection UI

The UI displays every returned Page with its name and available metadata.

Rules:

- the user must explicitly choose a Page;
- the first Page must never be selected automatically;
- a single available Page still requires confirmation;
- the posted choice contains only the intent ID and Page ID;
- the server verifies that the Page ID belongs to the sanitized candidate set.

### Complete selection

`POST /api/social/connections/facebook/select-page`:

1. Authenticate and enforce origin/brand ownership.
2. Lock the connection intent.
3. Verify it is unexpired and unconsumed.
4. Verify the chosen Page is an offered candidate.
5. Decrypt provider context.
6. Call `POST /v1/connect/facebook/select-page` with:
   - `profileId`;
   - selected `pageId`;
   - `tempToken`;
   - decoded `userProfile`;
   - server-owned final redirect URL;
   - `X-Connect-Token` where required.
7. Refetch and verify the resulting Zernio account and account health.
8. Resolve or create the canonical UNDA Facebook account.
9. Insert or reactivate its Zernio binding.
10. Consume and erase the encrypted temporary context transactionally.

If a verified native Facebook Page ID matches an existing canonical account, reuse that account ID.

## Instagram

Instagram uses the default `instagram_login` flow without `headless=true`.

After callback:

1. Validate the UNDA connection intent.
2. Treat callback fields as hints only.
3. Refetch the Zernio account.
4. Verify profile, platform, active state, and health.
5. Resolve or create the canonical Instagram account.
6. Insert or reactivate its Zernio binding.
7. Consume the intent.

Do not use `facebook_login` unless a concrete future requirement needs Page-linked Instagram authorization. Zernio documents that default Instagram Login connects the professional account directly. [Zernio connect API](https://docs.zernio.com/connect/get-connect-url)

## Reconnection and account events

`account.connected` and `account.disconnected` webhooks update only the matching provider binding.

They do not:

- delete the canonical publishing account;
- change schedule account IDs;
- replace display/native identity without verification;
- automatically migrate a binding to another canonical account.

## Publishing integration

### Scheduling

The approved-post UI collects:

- a canonical connected account for each channel;
- an exact absolute publication time;
- a provider-neutral content mode when absent from the weekly artifact.

The application:

1. Verifies approval and review state.
2. Materializes a versioned canonical bundle without invoking a model or rewriting copy.
3. Runs existing scheduling eligibility and assembly.
4. Creates one schedule per `(publication input, canonical account)`.
5. Records reschedules/cancellations as lifecycle events.

For Facebook and Instagram, two schedules are created even if time and content are identical.

### Binding resolution at execution

Immediately before calling the durable runner:

1. Load the schedule’s canonical account.
2. Load its single active binding.
3. Reject disconnected or incapable bindings.
4. Select the publisher by `binding.provider`.
5. Hydrate `SocialPublishingAccount.providerAccountRef` from the binding.
6. Pass the canonical account ID unchanged.
7. Have the provider request journal capture `provider_binding_id`.

No schedule stores a Zernio account ID.

### Worker

Add publishing, webhook, reconciliation, and analytics ticks to the persistent process behind `npm run worker:operator`.

The worker must:

- query due schedules;
- derive lifecycle state;
- hydrate versioned canonical bundles;
- resolve active bindings;
- call `runDurableSocialContentPublish`;
- use the existing attempt claim for concurrency control;
- use a maximum of three attempts unless configured otherwise;
- never retry `unknownOutcome`;
- isolate subsystem failures;
- never submit future scheduling timestamps to Zernio.

Restarting UNDA must not lose due work.

## Canonical error mapping

| Condition | Canonical outcome |
|---|---|
| Invalid bundle or missing media | `permanentFailure` |
| No active binding | Not eligible; no attempt/provider call |
| Binding disconnected or wrong channel/profile | `permanentFailure` |
| Media upload temporary failure before dispatch | `retryableFailure` |
| Zernio 429 before acceptance | `retryableFailure`, honoring `Retry-After` |
| Authentication, billing, or permission failure known to precede creation | `permanentFailure` |
| Immediate response confirms publication | `published` |
| Immediate response confirms terminal failure | `permanentFailure` |
| Accepted/pending provider post | `unknownOutcome` |
| Duplicate-content 409 with `existingPostId` | `unknownOutcome`; reconcile the existing ID |
| Timeout/reset after dispatch may have begun | `unknownOutcome` |
| Successful status with invalid/truncated body | `unknownOutcome` |
| 5xx where acceptance cannot be excluded | `unknownOutcome` |
| Proven pre-dispatch DNS/TLS/connect failure | `retryableFailure` |
| Unexpected multi-platform response | `unknownOutcome` plus protocol alert |

Stable UNDA error codes include:

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
- `mediaManifestIncomplete`;
- `publicationBundleUnsupportedVersion`.

## Webhook verification, deduplication, and reconciliation

### Receipt

`POST /api/webhooks/zernio` uses the Next.js Node runtime.

The handler must:

1. Read a bounded raw body with `request.text()`.
2. Require `X-Zernio-Signature`.
3. Compute lowercase hex HMAC-SHA256.
4. Compare fixed-length buffers with `timingSafeEqual`.
5. Parse JSON only after signature verification.
6. Require `payload.id`.
7. If present, require `X-Zernio-Event-Id` to equal `payload.id`.
8. Insert into the durable inbox.
9. Return `204` immediately for new and duplicate valid events.

Zernio documents at-least-once delivery, stable event IDs, raw-body HMAC verification, and a five-second acknowledgement requirement. [Zernio webhook guide](https://docs.zernio.com/webhooks)

### Async processing

Handle:

- `account.connected`;
- `account.disconnected`;
- `post.platform.published`;
- `post.platform.failed`;
- relevant post rollups as fallback;
- `analytics.synced`.

Correlation order:

1. provider post reference in the request journal;
2. `existingPostId`;
3. `undaAttemptId` metadata;
4. recent provider posts matched by binding, account, channel, and metadata.

An event arriving before attempt/result persistence stays pending.

### Orphaned attempts

After the grace period:

- no `dispatch_started_at` → record `retryableFailure(providerRequestNotDispatched)`;
- `dispatch_started_at` present → record `unknownOutcome(providerResponseMissing)`;
- then use the existing retry or reconciliation decision path.

### Reconciliation outcomes

- Confirmed published → `publicationFound`.
- Provider positively establishes no post exists → `confirmedAbsent`.
- Provider reports terminal failure → `publicationFailed`.
- Pending, temporarily unreadable, or unmatched → `inconclusive`.

A single “not found” lookup is insufficient for `confirmedAbsent`.

Webhook and polling reconciliation append canonical records; they never overwrite the original result.

## Analytics

`analytics.synced` is a trigger, not a metrics payload. Bootstrap through the normal analytics endpoint, then use the delta endpoint with the last committed cursor. [Zernio September 2026 changelog](https://docs.zernio.com/changelog), [analytics API](https://docs.zernio.com/analytics/get-analytics)

For every active Zernio profile:

1. Bootstrap published UNDA posts.
2. Associate observations with the canonical account and exact provider binding.
3. Persist normalized snapshots.
4. Initialize the profile cursor.
5. On webhook or fallback polling, request delta pages.
6. Process oldest-first while `hasMore=true`.
7. Commit data and `nextCursor` atomically.

Normalize only factual metrics:

- impressions;
- reach;
- likes;
- comments;
- shares;
- saves;
- clicks;
- views;
- follows;
- explicitly supplied engagement rate.

Unavailable values remain `NULL`. Analytics do not automatically alter planning.

## Security and environment variables

Add:

```dotenv
SOCIAL_PUBLISHING_ENABLED=false
SOCIAL_PUBLISH_MAX_ATTEMPTS=3
SOCIAL_PUBLISH_ATTEMPT_GRACE_SECONDS=120
SOCIAL_CONNECTION_CONTEXT_KEY=

ZERNIO_API_BASE_URL=https://zernio.com/api/v1
ZERNIO_API_KEY=
ZERNIO_WEBHOOK_SECRET=

SOCIAL_ANALYTICS_ENABLED=false
SOCIAL_ANALYTICS_POLL_SECONDS=900
```

`SOCIAL_CONNECTION_CONTEXT_KEY` is a 32-byte base64-encoded key used only for short-lived AES-GCM encryption of headless connection context.

Requirements:

- no `NEXT_PUBLIC_` provider variables;
- publishing-enabled production startup requires the API key, webhook secret, encryption key, and HTTPS application origin;
- arbitrary production API origins are rejected unless explicitly allowlisted;
- never log credentials, temporary OAuth data, bearer headers, presigned upload URLs, or full provider responses;
- use bounded request/response sizes and explicit timeouts;
- authenticate and origin-check OAuth initiation, selection, scheduling, cancellation, and reconnection mutations;
- reverify tenant/account/binding ownership before publishing;
- erase encrypted selection context after success or expiry;
- never store Meta access tokens as canonical connection data.

## Files/modules to create or modify

### Create

Migrations:

- `db/migrations/0011_social_connections.sql`
- `db/migrations/0012_social_provider_delivery.sql`
- `db/migrations/0013_social_scheduling.sql`
- `db/migrations/0014_social_analytics.sql`

Application:

- `src/application/social-connections/service.ts`
- `src/application/social-connections/provider-registry.ts`
- `src/application/publishing/publication-bundle-codec.ts`
- `src/application/publishing/materialize-approved-post.ts`
- `src/application/publishing/run-publish-queue.ts`
- `src/application/publishing/run-publish-reconciliation.ts`
- `src/application/analytics/ingest-social-analytics.ts`

Zernio infrastructure:

- `src/infrastructure/zernio/environment.ts`
- `src/infrastructure/zernio/client.ts`
- `src/infrastructure/zernio/profiles.ts`
- `src/infrastructure/zernio/accounts.ts`
- `src/infrastructure/zernio/connect.ts`
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
- `src/app/api/social/connections/facebook/pages/route.ts`
- `src/app/api/social/connections/facebook/select-page/route.ts`
- `src/app/api/social/schedules/route.ts`
- `src/app/api/webhooks/zernio/route.ts`
- `src/app/workspace/connections-client.tsx`
- `src/app/workspace/social-schedule-controls.tsx`
- `src/app/workspace/results-client.tsx`

Tests:

- `tests/social-persistence.integration.test.mts`
- `tests/zernio-client.test.mts`
- `tests/social-connections.integration.test.mts`
- `tests/zernio-facebook-headless.integration.test.mts`
- `tests/zernio-publisher.test.mts`
- `tests/social-publish-store.integration.test.mts`
- `tests/zernio-webhook.integration.test.mts`
- `tests/social-reconciliation.integration.test.mts`
- `tests/publication-bundle-codec.test.mts`
- `tests/social-scheduling.integration.test.mts`
- `tests/social-worker.integration.test.mts`
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

## Implementation phases and gates

## Phase 1 — Provider-neutral persistence and Zernio foundation

Deliver:

- migration `0011`;
- canonical accounts separated from provider bindings;
- provider migration invariants;
- Zernio environment parsing and HTTP client;
- PostgreSQL connection stores;
- provider registry abstraction;
- no OAuth UI or publishing calls.

Tests:

- canonical account survives binding replacement;
- one active binding per canonical account;
- native identity uniqueness;
- cross-brand/profile bindings rejected;
- disconnected and retired bindings hydrate correctly;
- Zernio client authentication, timeouts, bounds, and redaction;
- environment fail-closed behavior.

Gate:

```powershell
npm run check
npm run lint
npm run test:social:foundation
npm run test:integration
```

Do not begin Phase 2 until this gate passes.

## Phase 2 — Connection flow

Deliver:

- provider-profile creation;
- connection intents and encrypted temporary context;
- headless Facebook initiation;
- UNDA-owned Page list and explicit selection;
- default Instagram Login flow;
- callback verification;
- canonical-account resolution and provider-binding creation;
- dynamic Connections UI.

Tests:

- authentication/origin/ownership;
- callback state expiry and single use;
- encrypted Facebook context never reaches the client;
- `headless=true` for Facebook;
- no automatic first-Page selection;
- decoded `userProfile` sent during Page selection;
- invalid Page choice rejected;
- Instagram does not use `facebook_login`;
- reconnect reuses canonical identity;
- callback account/profile/channel refetch and verification.

Gate:

```powershell
npm run check
npm run lint
npm run test:social:foundation
npm run test:social:connections
npm run build
```

Do not begin Phase 3 until this gate passes.

## Phase 3 — Publishing, durable request journal, and reconciliation safety

Deliver:

- migration `0012`;
- PostgreSQL `SocialContentPublishStore`;
- `ZernioPublisher`;
- provider request/media journals;
- webhook receipt and inbox;
- asynchronous webhook processor;
- orphan-attempt recovery;
- polling reconciliation;
- additive `publicationFailed` reconciliation outcome.

Tests:

- atomic concurrent attempt claims;
- idempotent result recording;
- exactly one provider invocation;
- one request target;
- `publishNow=true` and no provider scheduling fields;
- request ID behavior;
- response/error mapping;
- ambiguous dispatch → `unknownOutcome`;
- webhook raw-body verification and deduplication;
- out-of-order events;
- orphaned pre/post-dispatch recovery;
- terminal reconciliation decisions;
- binding migration blocked by unresolved dispatched attempts.

Gate:

```powershell
npm run check
npm run lint
npm run build:domain
npm run test:social:delivery
npm test
```

Do not begin Phase 4 until this gate passes.

## Phase 4 — Scheduling, materialization, and worker wiring

Deliver:

- migration `0013`;
- approval actor persistence;
- versioned publication-bundle codec;
- provider-neutral weekly-post materializer;
- exact-time/account scheduling UI;
- schedule lifecycle persistence;
- due-work query;
- binding resolution at execution;
- publication/reconciliation ticks in the existing worker.

Tests:

- bundle version 1 round-trip;
- unknown versions fail before provider access;
- historical-version decoder fixture remains readable;
- Facebook/Instagram fan-out produces independent schedules;
- schedule references canonical account only;
- exact-time validation;
- missing content mode or media blocks scheduling;
- reschedule/cancel behavior;
- worker restart/resume;
- disconnected binding prevents dispatch;
- replacing a safe binding does not change schedule or account identity.

Gate:

```powershell
npm run check
npm run lint
npm run test:social:delivery
npm run test:social:scheduling
npm run test:planning
npm run test:dashboard
npm run build
```

Do not begin Phase 5 until this gate passes.

## Phase 5 — Analytics ingestion and Results UI

Deliver:

- migration `0014`;
- analytics bootstrap and cursor ingestion;
- `analytics.synced` processing;
- periodic fallback polling;
- canonical-account/provider-binding attribution;
- Results UI with factual normalized metrics.

Tests:

- bootstrap before delta;
- cursor/data atomicity;
- `hasMore` pagination;
- deduplicated observations;
- unavailable metrics remain null;
- old and new provider bindings retain one canonical account lineage;
- cross-brand/profile isolation;
- Results UI distinguishes zero from unavailable.

Gate:

```powershell
npm run check
npm run lint
npm run test:social:analytics
npm run test:dashboard
npm run build
npm run verify
```

## Test scripts

Add focused scripts:

```json
{
  "test:social:foundation": "node --env-file=.env.local --import tsx --test tests/social-persistence.integration.test.mts tests/zernio-client.test.mts",
  "test:social:connections": "node --env-file=.env.local --import tsx --test tests/social-connections.integration.test.mts tests/zernio-facebook-headless.integration.test.mts",
  "test:social:delivery": "node --env-file=.env.local --import tsx --test tests/zernio-publisher.test.mts tests/social-publish-store.integration.test.mts tests/zernio-webhook.integration.test.mts tests/social-reconciliation.integration.test.mts",
  "test:social:scheduling": "node --env-file=.env.local --import tsx --test tests/publication-bundle-codec.test.mts tests/social-scheduling.integration.test.mts tests/social-worker.integration.test.mts",
  "test:social:analytics": "node --env-file=.env.local --import tsx --test tests/social-analytics.integration.test.mts",
  "test:social": "npm run test:social:foundation && npm run test:social:connections && npm run test:social:delivery && npm run test:social:scheduling && npm run test:social:analytics"
}
```

No default automated test may publish to a real account. Optional sandbox smoke tests require an explicit flag and disposable accounts.

## Explicit non-goals

- Replacing or bypassing `SocialContentPublisher`.
- Replacing durable attempt/result records with provider jobs.
- Making a provider binding the canonical account identity.
- Recreating canonical accounts during provider migration.
- Using Zernio schedules, queues, recurring posts, or recycling.
- Combining Facebook and Instagram in one request.
- Silently selecting a Facebook Page.
- Sending headless OAuth temporary credentials to the browser.
- Letting webhooks directly publish or retry content.
- Storing Meta OAuth tokens as canonical connection data.
- Automatic direct publishing without founder approval.
- AI-generated analytics conclusions.
- Automatically changing future plans from analytics.
- Inbox, comments, DMs, ads, or engagement automation.
- Backfilling unrelated external posts.
- Video generation, transcoding, or a new large-video storage system.
- Zernio-specific planning, drafting, scheduling, or domain behavior.
- Any Zernio-specific addition to `src/core`.

## Acceptance criteria

The target architecture is accepted when:

1. `social_publishing_accounts` contains no provider identity or connection state.
2. Provider account identifiers exist only in binding/infrastructure records.
3. A canonical account survives Zernio reconnection and replacement by another provider binding.
4. Provider migration changes no schedule, attempt, result, or analytics canonical account ID.
5. Facebook uses headless OAuth and an explicit UNDA-owned Page picker.
6. No Facebook Page is selected without a user action.
7. Instagram uses default `instagram_login`.
8. Connected accounts are refetched and verified before binding.
9. Canonical bundles carry an explicit schema name and version.
10. Previously scheduled bundle versions remain readable.
11. Every channel/account produces a distinct canonical schedule.
12. Every Zernio publication uses `publishNow=true` and one target.
13. Attempts are claimed before media upload or publication.
14. Concurrent workers cannot issue duplicate publication requests.
15. Existing attempt/result records resume without resending.
16. Ambiguous dispatches become `unknownOutcome`.
17. Unknown outcomes require reconciliation.
18. Webhooks are verified, deduplicated, persisted quickly, and processed asynchronously.
19. Provider history records the exact binding used for every attempt and analytics observation.
20. Analytics remain attached to the stable canonical account across provider changes.
21. Disabling social publishing prevents provider publication while planning and drafting continue.
22. A future direct Meta publisher requires no change to planning, drafting, schedule, attempt, result, or analytics lineage.
23. No Zernio-specific symbol appears under `src/core`.
24. Every implementation phase passes its focused gate before the next phase begins.
25. Existing domain, planning, discovery, dashboard, and auth tests remain passing.

## Final build/test commands

After all phases:

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

Before relying on `npm test`, repair its current references to nonexistent test files and include the existing durable publication and reconciliation suites. This is test-runner maintenance only and must not remove coverage.