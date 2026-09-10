# Visual generation

Open **Posts → Recommended visual → Image generation**. The prompt starts with
the post's visual brief and can be edited. Select a frame for carousel/story
posts. Generate, preview and choose **Add to post** (replaces that slot's image).
Each new version costs one credit. Attaching or downloading a saved result is
free. Previous generations remain available even after replacing a post image.

## Configuration and deployment

Apply `npm run db:migrate` before starting the updated app or worker. Start the
app with `npm run dev` and run `npm run worker:operator` under a process manager
for durable fallback processing. The app also starts queued generation with
Next.js `after()`, so a normal local demo works without a separate worker.
The hosting platform must allow the route's 300-second duration; the provider
timeout is 240 seconds. A separately running operator processes queued work if
the web process is interrupted before claiming it.

Server environment:

| Variable | Default | Behavior |
| --- | --- | --- |
| `VISUAL_MODE` | `NODE_ENV` when development/test, otherwise production | development/demo/test: one grant of 20 per workspace; production: no automatic grant; disabled: block new generations |
| `OPENAI_API_KEY` | required | Real OpenAI Image API access, also in demo/test |
| `OPENAI_IMAGE_MODEL` | `gpt-image-2.5-sunburst` | Server-selected model; requests retain the chosen model |
| `OPENAI_IMAGE_QUALITY` | medium | low, medium or high |

A production-built demo deployment must explicitly set `VISUAL_MODE=demo`.
For a live production workspace, leave production mode in place and provision
credits through `addVisualCredits`. Switching modes never reseeds a workspace
that already received its demo grant. There is no automatic refill or mock
image fallback. The existing verified-user and active-subscription requirements
apply to generation, history, downloads and attachment.

The default model and output parameters follow the official
[Sunburst model documentation](https://developers.openai.com/api/docs/models/gpt-image-2.5-sunburst)
and [Image API guide](https://developers.openai.com/api/docs/guides/image-generation).
Requests use one WebP output at 1024×1024, 1024×1280 or 864×1536 for the selected
1:1, 4:5 or 9:16 frame. A configured replacement model must support these Image
API parameters. Provider usage and request IDs are recorded; actual dollar cost
is nullable because the API does not provide an authoritative per-call bill.

## Accounting and persistence

Migration `0017_visual_generation.sql` adds generation history, independent
private image storage and the credit ledger. The ledger is the balance source
of truth. Pending requests reserve one available credit without debiting it.
Workspace row locks serialize admission and credit adjustments, preventing
concurrent requests from overspending the last credit.

Image bytes, success status and the single `-1` ledger entry commit in one
transaction. Provider errors, missing/invalid image data and storage failures
do not debit a credit. File decoding validates usable image data only: there
is no aesthetic review, content scoring or automatic image regeneration.

A stable client request UUID plus a payload fingerprint prevents duplicate
dispatch and charging when a submission is retried. Reusing the UUID with a
different payload returns 409. A fresh version uses a fresh request UUID.
Workers claim each pending request once. Expired in-flight claims fail after
10 minutes; unclaimed requests expire after 30 minutes. Status reads and the
operator clean them up. An interrupted provider request is never automatically
sent again: its outcome may be unknown and OpenAI might have billed the call,
but the workspace is not charged without a committed, accessible result.

Images use the existing PostgreSQL `bytea` storage approach, in a separate
`visual_assets` table, up to 8 MB per result. Asset retrieval is owner scoped;
base64 data and credentials never enter history responses. Attaching a result
uses the existing validated post-media pipeline, including its ownership,
revision, frame and storage checks. The independent asset read/write boundary
can later use object storage. Production operators should budget database
storage and backups for retained history; automatic retention is not in v1.

`addVisualCredits` is an internal billing/admin service (no public grant route).
It supports idempotent purchase, subscription allowance and manual adjustment
entries using a stable `grantKey`. A negative adjustment cannot consume reserved
credits. Single/Manager/Agency metadata remains 20/60/200 credits per month;
monthly/annual refill and checkout credit-pack logic are separate future work.
Agent-triggered callers can reuse the same service and accounting boundary.
Image editing with an input image is not exposed in v1; a new textual prompt
creates a new version and is charged independently.

## API

- `POST /api/visuals/generate`: `{ requestId, prompt, brandId?, aspectRatio?, requestKind?, target?: { runId, postKey, slot } }`. Returns 202 with `generation`, `remainingCredits`, `reservedCredits`, `availableCredits`; an idempotent terminal replay returns 200.
- `GET /api/visuals?runId=...` or `?id=...`: latest 50 owned generations, balance and service availability. The UI polls while the visual panel is in use.
- `GET /api/visuals/assets?id=...`: private generated WebP.
- `POST /api/visuals/attach`: `{ generationId, runId, postKey, slot }`; returns the existing post-asset list.
- The original `/api/weekly-planning/generate-image` endpoint delegates to the same generation handler.

`requestId` is a UUID, `prompt` is 1–4000 characters, `aspectRatio` is 1:1 (default),
4:5 or 9:16, and `requestKind` is generate (default) or regenerate. Missing
credits return 402; invalid input 400; conflicting IDs/targets 409; disabled or
unconfigured service 503. Provider failures become readable history entries.

## Verification

`npm run test:visuals` runs policy, input, provider and UI tests without paid
provider calls. `npm run test:visuals:integration` uses `DATABASE_URL` and an
isolated PostgreSQL schema, testing admission races, duplicate grants/requests,
failure rollback, lease expiry, ownership and post attachment.

An optional live smoke test is explicitly gated by `VISUAL_LIVE_TEST=1` and
requires `OPENAI_API_KEY`. Run with `--test-name-pattern='live OpenAI'` to make
one real low-quality Sunburst request in an isolated schema; it verifies image
storage and a balance of 19 from a starting grant of 20. It incurs provider
usage and is excluded from ordinary tests.
