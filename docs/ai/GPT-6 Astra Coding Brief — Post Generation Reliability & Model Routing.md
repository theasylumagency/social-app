Update the UNDA Social Operator post-generation runtime with minimal architectural change.

## Goal

Fix repeated `TimeoutError` failures during weekly post generation and route models by responsibility instead of using one model for outline, writing, and review.

Preserve the existing architecture and contracts. Do not redesign unrelated components.

## Required changes

### 1. Split post-generation model routing

Add support for:

```env
OPENAI_POST_PLANNER_MODEL=gpt-5.6-terra
OPENAI_POST_WRITER_MODEL=gpt-5.6-sol
OPENAI_POST_REVIEW_MODEL=gpt-5.6-terra

OPENAI_PLANNING_MODEL=gpt-5.6-terra
OPENAI_BRAND_MODEL=gpt-5.6-terra

OPENAI_EXTRACTION_MODEL=gpt-5.4-nano
OPENAI_EXTRACTION_FALLBACK_MODEL=gpt-5.6-terra
```

Use:

- `post_schedule` / outline → `OPENAI_POST_PLANNER_MODEL`
- `post_writer_*` → `OPENAI_POST_WRITER_MODEL`
- `post_review` → `OPENAI_POST_REVIEW_MODEL`

Fallbacks should remain sensible if an env var is absent.

Do not force all post stages through `OPENAI_POST_WRITER_MODEL`.

### 2. Improve transient model failure handling

Current model calls fail immediately on transport/provider errors.

Add one automatic retry for transient failures only:

- timeout / `TimeoutError`
- HTTP 429
- HTTP 500
- HTTP 502
- HTTP 503
- HTTP 504
- comparable temporary network errors

Use a short bounded backoff.

Do not retry obvious permanent 4xx errors.

Do not change the existing contract-validation repair behavior except as necessary to keep retry semantics clear.

### 3. Increase request timeout safely

Current model timeout is 90 seconds.

Increase the heavy reasoning/generation timeout to approximately:

```ts
150_000
```

Do not blindly increase it without also checking worker lease and execution budget.

### 4. Align lease and worker budget

Current weekly-post lease is 4 minutes and the worker budget is roughly 5 minutes.

Adjust lease/budget so that:

- a 150-second model call is safe;
- one transient retry cannot cause accidental lease expiry;
- another worker cannot claim the same job while the first worker is still legitimately executing it.

Prefer a simple conservative adjustment rather than introducing lease-heartbeat complexity unless truly necessary.

### 5. Worker owns heavy execution

Canonical architecture:

```text
app/
= UI + API

worker/
= the only place work executes
```

The API route should validate, queue/state-transition, and return.

Do not rely on `after(() => runWeeklyPosts(...))` as a primary execution path for heavy generation when the persistent `worker:operator` already exists.

Remove or narrow duplicate heavy execution from the API path so there is one clear production execution owner.

### 6. Improve error observability

Current logs often show only:

```text
Weekly posts failed { step: 'outline', error: 'TimeoutError' }
```

Improve logging enough to distinguish:

- timeout
- HTTP status
- model incomplete
- contract validation failure
- lost lease

Do not log secrets, API keys, raw sensitive source content, or unnecessarily large prompts.

Preserve user-facing Georgian error messages.

## Constraints

Do not:

- redesign weekly planning;
- change post schemas;
- change prompts unless required for this fix;
- introduce a queue provider;
- add Redis;
- introduce a new service;
- change persistence architecture;
- weaken validation;
- change the Writer/Reviewer responsibilities;
- touch unrelated Brand Brain architecture.

Keep the implementation small.

## Expected architecture after change

```text
User requests generation
→ API validates and queues
→ persistent operator worker claims job

outline
→ gpt-5.6-terra

writing
→ gpt-5.6-sol

review
→ gpt-5.6-terra

transient provider failure
→ bounded automatic retry

persistent failure
→ save resumable failed state
```

## Validation

Before finishing:

1. run TypeScript check/build;
2. run weekly planning/post tests;
3. verify existing partial-copy persistence still works;
4. verify retry does not duplicate already saved post copies;
5. verify a failed job remains resumable;
6. verify a lease cannot be stolen during a legitimate long model call;
7. verify API no longer duplicates worker-owned heavy execution.

Return:

- files changed;
- concise explanation of model routing;
- timeout/retry policy;
- lease/budget values chosen and why;
- tests run and results.

Avoid broad refactors.