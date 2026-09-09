import assert from "node:assert/strict"
import test from "node:test"
import { runSocialPublishQueue } from "../src/application/publishing/run-publish-queue"
import { approvedPublicationFixture } from "./publication-bundle-fixture"

test("unknown persisted versions fail before provider selection", async () => {
  let providers = 0
  const result = await runSocialPublishQueue({ publications: { claimDue: async () => { throw new Error("publicationBundleUnsupportedVersion") } } as never,
    attempts: {} as never, publisherFor: () => { providers++; return async () => ({ status: "published" } as never) },
    now: () => "2026-09-09T12:00:00.000Z" as never, maxAttempts: 3, unresolvedAttemptGraceMs: 120_000 })
    .then(() => null, (error) => error as Error)
  assert.match(result?.message ?? "", /publicationBundleUnsupportedVersion/)
  assert.equal(providers, 0)
  assert.ok(approvedPublicationFixture().bundle)
})
