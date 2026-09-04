const assert = require("node:assert/strict")
const test = require("node:test")

const {
  createBrandOnboarding,
} = require("../dist/application/onboarding/create-brand.js")
const {
  parseBrandOnboardingInput,
} = require("../dist/application/onboarding/schema.js")

test("onboarding validation trims, normalizes, and deduplicates input", () => {
  const parsed = parseBrandOnboardingInput({
    businessName: "  სტუდიო მზე  ",
    language: "ka",
    services: ["სტრატეგია", " სტრატეგია ", "კონტენტი"],
    website: "https://example.ge",
    tones: [],
  })

  assert.equal(parsed.success, true)
  assert.deepEqual(parsed.data, {
    businessName: "სტუდიო მზე",
    language: "ka",
    services: ["სტრატეგია", "კონტენტი"],
    website: "https://example.ge/",
  })
})

test("onboarding rejects a missing offer and unsafe website protocol", () => {
  const parsed = parseBrandOnboardingInput({
    businessName: "სტუდიო მზე",
    language: "ka",
    services: [],
    website: "javascript:alert(1)",
  })

  assert.equal(parsed.success, false)
  assert.match(parsed.errors.services, /ერთი მნიშვნელობა/)
  assert.match(parsed.errors.website, /სრული მისამართი/)
})

test("onboarding builds the complete ingestion batch before persistence", async () => {
  let persistedBatch
  const store = {
    async persist(batch) {
      persistedBatch = batch
      return {
        status: "persisted",
        runId: batch.run.id,
        snapshotId: batch.snapshot.id,
      }
    },
  }

  const result = await createBrandOnboarding(
    {
      businessName: "სტუდიო მზე",
      language: "ka",
      services: ["სტრატეგია", "კონტენტი"],
      audiences: ["მცირე ბიზნესი"],
    },
    store,
    {
      now: () => new Date("2026-09-04T08:00:00.000Z"),
      createOperationId: () => "operation-1",
    },
  )

  assert.equal(result.brandId, "brand:operation-1")
  assert.equal(result.persistence, "persisted")
  assert.deepEqual(result.minimumViableBrand, {
    usableOffer: true,
    contentLanguage: true,
    usableVoice: true,
    satisfied: true,
  })
  assert.equal(persistedBatch.evidence.length, 5)
  assert.equal(persistedBatch.routings.length, 5)
  assert.equal(persistedBatch.knowledgeProposals.length, 5)
  assert.match(persistedBatch.snapshot.contentHash, /^sha256:[a-f0-9]{64}$/u)
})
