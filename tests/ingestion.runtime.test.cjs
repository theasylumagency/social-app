const assert = require("node:assert/strict")
const test = require("node:test")

const { createIsoDateTime } = require("../dist/core/domain/index.js")
const {
  SOCIAL_KNOWLEDGE_PATHS,
  ingestSocialManualBrandProfile,
} = require("../dist/blueprints/social/index.js")

function validInput(overrides = {}) {
  return {
    brandId: "brand-1",
    sourceId: "source-1",
    snapshotId: "snapshot-1",
    capturedAt: createIsoDateTime("2026-09-04T12:00:00+04:00"),
    contentHash: "sha256:manual-profile-1",
    sourceLabel: "Founder onboarding",
    knowledge: {
      identityName: "Example Brand",
      identityLanguages: ["ka"],
      offerPrimaryServices: ["Dental consultation", "Implant dentistry"],
      voicePrimaryTone: ["calm", "professional"],
    },
    createEvidenceId: (localRef) => `evidence:${localRef}`,
    ...overrides,
  }
}

test("manual Brand Profile runs through the complete ingestion pipeline", () => {
  const result = ingestSocialManualBrandProfile(validInput())

  assert.equal(result.source.kind, "social.manualInput")
  assert.equal(result.source.reference.kind, "manual")
  assert.equal(result.snapshot.content.kind, "structured")
  assert.equal(result.extractedEvidence.length, 6)
  assert.equal(result.evidence.length, result.extractedEvidence.length)
  assert.equal(result.routings.length, result.evidence.length)
  assert.equal(result.knowledgeProposals.length, result.evidence.length)
  assert.deepEqual(result.minimumViableBrand, {
    usableOffer: true,
    contentLanguage: true,
    usableVoice: true,
    satisfied: true,
  })

  for (const evidence of result.evidence) {
    assert.equal("semanticHints" in evidence, false)
    assert.equal("pathCandidates" in evidence, false)
    assert.equal("normalizedValue" in evidence, false)
  }
  for (const routing of result.routings) {
    assert.equal(routing.routingVersion, "social.manual-routing.v1")
    assert.equal(routing.targets[0].target.kind, "knowledgePath")
    assert.equal(routing.targets[0].support, "direct")
  }
})

test("manual cardinality determines set versus add mutation proposals", () => {
  const result = ingestSocialManualBrandProfile(validInput())

  const nameProposal = result.knowledgeProposals.find(
    (proposal) => proposal.path === SOCIAL_KNOWLEDGE_PATHS.identityName,
  )
  assert.equal(nameProposal.kind, "proposeSet")
  assert.equal(nameProposal.proposed.epistemicStatus, "observed")
  assert.equal(nameProposal.proposed.provenance[0].kind, "evidence")

  const serviceProposals = result.knowledgeProposals.filter(
    (proposal) => proposal.path === SOCIAL_KNOWLEDGE_PATHS.offerPrimaryServices,
  )
  assert.equal(serviceProposals.length, 2)
  assert.equal(serviceProposals.every((proposal) => proposal.kind === "proposeAdd"), true)
})

test("manual ingestion rejects unknown, empty, or incorrectly shaped knowledge", () => {
  assert.throws(
    () =>
      ingestSocialManualBrandProfile(
        validInput({ knowledge: { unknownField: "value" } }),
      ),
    /Unknown Social knowledge field/,
  )
  assert.throws(
    () =>
      ingestSocialManualBrandProfile(
        validInput({ knowledge: { offerPrimaryServices: [] } }),
      ),
    /must be a non-empty array/,
  )
  assert.throws(
    () =>
      ingestSocialManualBrandProfile(
        validInput({ knowledge: { identityName: ["Not", "One"] } }),
      ),
    /accepts one value/,
  )
  assert.throws(
    () => ingestSocialManualBrandProfile(validInput({ knowledge: {} })),
    /at least one knowledge value/,
  )
})

test("application-owned Evidence IDs must be unique", () => {
  assert.throws(
    () =>
      ingestSocialManualBrandProfile(
        validInput({ createEvidenceId: () => "evidence:duplicate" }),
      ),
    /duplicate ID/,
  )
})
