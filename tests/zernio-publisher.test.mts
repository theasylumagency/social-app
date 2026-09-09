import assert from "node:assert/strict"
import test from "node:test"
import type { SocialContentPublisherInput } from "../src/blueprints/social"
import type { ProviderDeliveryRequest, ProviderDeliveryStore, ProviderRequestState } from "../src/application/publishing/delivery-store"
import { createIsoDateTime } from "../src/core/domain/primitives"
import { ZernioClientError, type createZernioClient } from "../src/infrastructure/zernio/client"
import { createZernioPublisher } from "../src/infrastructure/zernio/publisher"
import type { createZernioMediaUploader } from "../src/infrastructure/zernio/media"

const input = { attempt: { id: "attempt", idempotencyKey: "intent", attemptNumber: 1, contentId: "content", draftId: "draft",
  draftVersion: 1, scheduleId: "schedule", scheduleRevision: 0, publishingAccountId: "account", channel: "facebook",
  publishAt: "2026-09-09T11:00:00.000Z", attemptedAt: "2026-09-09T12:00:00.000Z" },
draft: { format: "staticPost", text: "Hello from UNDA" }, contentExecutionSpec: { visualDependency: "supportive" },
publishingAccount: { id: "account", channel: "facebook", providerAccountRef: "provider-account", connected: true } } as unknown as SocialContentPublisherInput

function setup(response: { status: number; data: unknown; retryAfter?: string } | Error) {
  let request: ProviderDeliveryRequest = { attemptId: input.attempt.id, providerBindingId: "binding", provider: "zernio",
    requestId: "c04d6a5e-f8ae-4d4f-94d7-c945641d3c30", requestFingerprint: "a".repeat(64), state: "prepared",
    dispatchStartedAt: null, providerPublicationRef: null, duplicatePublicationRef: null, providerProfileRef: "profile",
    providerAccountRef: "provider-account", publishingAccountId: "account", channel: "facebook", bindingStatus: "active",
    connectionStatus: "connected", canPublish: true, profileStatus: "active" }
  const transitions: ProviderRequestState[] = []
  const journal: ProviderDeliveryStore = { async loadRequest() { return request }, async transition(_id, _expected, state, details) {
    transitions.push(state)
    request = { ...request, state, dispatchStartedAt: state === "dispatchStarted" ? "2026-09-09T12:00:00.000Z" : request.dispatchStartedAt,
      providerPublicationRef: details?.providerPublicationRef ?? request.providerPublicationRef,
      duplicatePublicationRef: details?.duplicatePublicationRef ?? request.duplicatePublicationRef }; return request
  }, async recordMedia() {}, async listMedia() { return [] } }
  const calls: Parameters<ReturnType<typeof createZernioClient>["request"]>[0][] = []
  const client = { async request(request: Parameters<ReturnType<typeof createZernioClient>["request"]>[0]) {
    calls.push(request); if (response instanceof Error) throw response; return response
  } } as ReturnType<typeof createZernioClient>
  const media = { async upload() { throw new Error("unexpected media upload") } } as ReturnType<typeof createZernioMediaUploader>
  const publisher = createZernioPublisher({ client, journal, assets: { async load() { return [] } }, media,
    now: () => createIsoDateTime("2026-09-09T12:00:30.000Z") })
  return { publisher, calls, transitions }
}

test("Zernio publisher sends one immediate target with its durable request ID", async () => {
  const fixture = setup({ status: 201, data: { post: { _id: "post-1", status: "published", publishedAt: "2026-09-09T12:00:01Z",
    platforms: [{ platform: "facebook", accountId: { _id: "provider-account" }, status: "published" }] } } })
  assert.deepEqual(await fixture.publisher(input), { status: "published", providerPublicationRef: "post-1", publishedAt: "2026-09-09T12:00:30.000Z" })
  assert.equal(fixture.calls.length, 1)
  assert.equal(fixture.calls[0]?.requestId, "c04d6a5e-f8ae-4d4f-94d7-c945641d3c30")
  assert.deepEqual(fixture.calls[0]?.body, { content: "Hello from UNDA", platforms: [{ platform: "facebook", accountId: "provider-account" }],
    publishNow: true, metadata: { undaAttemptId: "attempt", undaScheduleId: "schedule" } })
  assert.equal("scheduledFor" in (fixture.calls[0]?.body as object), false)
  assert.deepEqual(fixture.transitions, ["preparingMedia", "readyToDispatch", "dispatchStarted", "responseReceived"])
})

test("Zernio publisher maps accepted, duplicate, throttled, and ambiguous outcomes safely", async (t) => {
  const cases = [
    [{ status: 201, data: { post: { _id: "post-1", status: "scheduled", platforms: [{ platform: "facebook", accountId: "provider-account", status: "pending" }] } } },
      { status: "unknownOutcome", errorCode: "providerAcceptedPending" }],
    [{ status: 409, data: { details: { existingPostId: "post-old" } } }, { status: "unknownOutcome", errorCode: "providerDuplicatePossible" }],
    [{ status: 429, data: {}, retryAfter: "60" }, { status: "retryableFailure", errorCode: "providerRateLimited" }],
    [new ZernioClientError("timeout"), { status: "unknownOutcome", errorCode: "providerResponseMissing" }],
    [{ status: 207, data: { post: { _id: "post-1" } } }, { status: "unknownOutcome", errorCode: "providerProtocolError" }],
  ] as const
  for (const [response, expected] of cases) await t.test(expected.errorCode, async () => {
    const outcome = await setup(response).publisher(input)
    assert.equal(outcome.status, expected.status); assert.equal("errorCode" in outcome ? outcome.errorCode : null, expected.errorCode)
    if (expected.errorCode === "providerRateLimited") assert.ok("retryAfter" in outcome)
  })
})

test("binding mismatch and pre-dispatch asset failure never call Zernio", async () => {
  const fixture = setup({ status: 201, data: {} })
  const wrong = { ...input, publishingAccount: { ...input.publishingAccount, providerAccountRef: "other" } }
  assert.deepEqual(await fixture.publisher(wrong), { status: "permanentFailure", errorCode: "providerProtocolError" })
  assert.equal(fixture.calls.length, 0)
})
