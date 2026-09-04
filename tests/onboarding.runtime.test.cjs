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

test("onboarding accepts complete service catalogs up to fifty items", () => {
  const parsed = parseBrandOnboardingInput({
    businessName: "სრული კატალოგი",
    language: "ka",
    services: Array.from({ length: 16 }, (_, index) => `სერვისი ${index + 1}`),
  })
  assert.equal(parsed.success, true)
  assert.equal(parsed.data.services.length, 16)

  const tooMany = parseBrandOnboardingInput({
    businessName: "ზედმეტი კატალოგი",
    language: "ka",
    services: Array.from({ length: 51 }, (_, index) => `სერვისი ${index + 1}`),
  })
  assert.equal(tooMany.success, false)
  assert.match(tooMany.errors.services, /50/)
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

test("onboarding preserves website evidence, confirmation lineage, and a logo artifact", async () => {
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
  const png = Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10, 1, 2, 3])

  const result = await createBrandOnboarding(
    {
      businessName: "სტუდიო მზე",
      language: "ka",
      services: ["მომხმარებლის მიერ შესწორებული სერვისი"],
      website: "https://example.ge/",
    },
    store,
    {
      now: () => new Date("2026-09-04T08:00:00.000Z"),
      createOperationId: () => "source-operation-1",
      websiteCapture: {
        requestedUrl: "https://example.ge/",
        finalUrl: "https://example.ge/",
        pageTitle: "სტუდიო მზე",
        knowledge: {
          identityName: "სტუდიო მზე",
          identityLanguages: ["ka"],
          identityWebsite: "https://example.ge/",
          offerPrimaryServices: ["ვებგვერდიდან ნაპოვნი სერვისი"],
        },
        citations: {
          identityName: [{
            value: "სტუდიო მზე",
            sourceUrl: "https://example.ge/about",
            exactExcerpt: "სტუდიო მზე — ინტერიერის დიზაინის სტუდია",
            confidence: "high",
          }],
        },
        logo: {
          finalUrl: "https://example.ge/logo.png",
          mediaType: "image/png",
          contentHash: "sha256:test-logo",
          content: png,
        },
      },
    },
  )

  assert.equal(result.sourceCount, 2)
  assert.equal(result.websiteEvidenceCount, 4)
  assert.equal(result.logoAssetCount, 1)
  assert.equal(persistedBatch.supportingSources.length, 1)
  assert.equal(persistedBatch.supportingSources[0].source.kind, "social.website")
  assert.equal(persistedBatch.supportingSources[0].evidence[0].evidenceStrength, "strong")
  assert.equal(
    persistedBatch.supportingSources[0].evidence[0].excerpt,
    "სტუდიო მზე — ინტერიერის დიზაინის სტუდია",
  )
  assert.deepEqual(
    persistedBatch.supportingSources[0].evidence[0].locator.path,
    ["citations", "identityName", 0],
  )
  assert.equal(persistedBatch.sourceArtifacts[0].byteSize, png.byteLength)

  const nameEvidence = persistedBatch.evidence.find(
    (item) => item.value === "სტუდიო მზე",
  )
  const serviceEvidence = persistedBatch.evidence.find(
    (item) => item.value === "მომხმარებლის მიერ შესწორებული სერვისი",
  )
  assert.equal(nameEvidence.lineage.parentEvidenceIds.length, 1)
  assert.equal(serviceEvidence.lineage, undefined)
})
