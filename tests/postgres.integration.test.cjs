const assert = require("node:assert/strict")
const { randomUUID } = require("node:crypto")
const test = require("node:test")

const { createIsoDateTime } = require("../dist/core/domain/index.js")
const {
  ingestSocialManualBrandProfile,
  ingestSocialWebsiteProfile,
} = require("../dist/blueprints/social/index.js")
const {
  createPostgresPool,
  PostgresIngestionStore,
} = require("../dist/infrastructure/postgres/index.js")

const connectionString = process.env.DATABASE_URL

function createManualIngestion({ brandId, sourceId, snapshotId, evidencePrefix }) {
  return ingestSocialManualBrandProfile({
    brandId,
    sourceId,
    snapshotId,
    capturedAt: createIsoDateTime("2026-09-04T12:00:00+04:00"),
    contentHash: "sha256:postgres-integration-profile-v1",
    sourceLabel: "PostgreSQL integration test",
    knowledge: {
      identityName: "Integration Test Brand",
      identityLanguages: ["ka"],
      offerPrimaryServices: ["Strategy", "Content production"],
      voicePrimaryTone: ["clear", "human"],
    },
    createEvidenceId: (localRef) => `${evidencePrefix}:${localRef}`,
  })
}

function createBatch({ brandId, runId, ingestion }) {
  const occurredAt = createIsoDateTime("2026-09-04T12:00:01+04:00")
  return {
    brand: {
      id: brandId,
      createdAt: ingestion.source.createdAt,
    },
    run: {
      id: runId,
      brandId,
      sourceId: ingestion.source.id,
      snapshotId: ingestion.snapshot.id,
      status: "completed",
      startedAt: ingestion.source.createdAt,
      completedAt: occurredAt,
      minimumViableBrand: ingestion.minimumViableBrand,
    },
    source: ingestion.source,
    snapshot: ingestion.snapshot,
    evidence: ingestion.evidence,
    routings: ingestion.routings,
    knowledgeProposals: ingestion.knowledgeProposals,
  }
}

test(
  "PostgreSQL persists an ingestion graph across pool restarts and rejects duplicate content",
  { skip: connectionString === undefined ? "DATABASE_URL is required" : false },
  async (t) => {
    const suffix = randomUUID()
    const brandId = `brand:integration:${suffix}`
    const sourceId = `source:integration:${suffix}`
    const snapshotId = `snapshot:integration:${suffix}:1`
    let pool = createPostgresPool({ connectionString })

    t.after(async () => {
      await pool.query("DELETE FROM brands WHERE id = $1", [brandId])
      await pool.end()
    })

    const firstIngestion = createManualIngestion({
      brandId,
      sourceId,
      snapshotId,
      evidencePrefix: `evidence:integration:${suffix}:1`,
    })
    const websiteIngestion = ingestSocialWebsiteProfile({
      brandId,
      sourceId: `source:integration:${suffix}:website`,
      snapshotId: `snapshot:integration:${suffix}:website`,
      capturedAt: createIsoDateTime("2026-09-04T12:00:00+04:00"),
      contentHash: "sha256:postgres-integration-website-v1",
      requestedUrl: "https://example.ge/",
      finalUrl: "https://example.ge/",
      pageTitle: "Integration Test Brand",
      knowledge: {
        identityName: "Integration Test Brand",
        identityWebsite: "https://example.ge/",
      },
      createEvidenceId: (localRef) =>
        `evidence:integration:${suffix}:website:${localRef}`,
    })
    const logoBytes = Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10, 1])
    const firstBatch = {
      ...createBatch({
      brandId,
      runId: `run:integration:${suffix}:1`,
      ingestion: firstIngestion,
      }),
      supportingSources: [
        {
          source: websiteIngestion.source,
          snapshot: websiteIngestion.snapshot,
          evidence: websiteIngestion.evidence,
          routings: websiteIngestion.routings,
        },
      ],
      sourceArtifacts: [
        {
          id: `artifact:integration:${suffix}:logo`,
          brandId,
          sourceId: websiteIngestion.source.id,
          snapshotId: websiteIngestion.snapshot.id,
          kind: "image",
          role: "logoCandidate",
          mediaType: "image/png",
          contentHash: "sha256:postgres-integration-logo-v1",
          byteSize: logoBytes.byteLength,
          content: logoBytes,
          sourceUrl: "https://example.ge/logo.png",
          createdAt: websiteIngestion.source.createdAt,
        },
      ],
    }

    const firstStore = new PostgresIngestionStore(pool)
    assert.deepEqual(await firstStore.persist(firstBatch), {
      status: "persisted",
      runId: firstBatch.run.id,
      snapshotId,
    })

    await pool.end()
    pool = createPostgresPool({ connectionString })

    const restartedStore = new PostgresIngestionStore(pool)
    const loaded = await restartedStore.loadBySnapshotId(snapshotId)
    assert.notEqual(loaded, undefined)
    assert.equal(loaded.brand.id, brandId)
    assert.equal(loaded.source.id, sourceId)
    assert.equal(loaded.snapshot.contentHash, firstIngestion.snapshot.contentHash)
    assert.equal(loaded.run.id, firstBatch.run.id)
    assert.equal(loaded.evidence.length, firstIngestion.evidence.length)
    assert.equal(loaded.routings.length, firstIngestion.routings.length)
    assert.deepEqual(
      loaded.knowledgeProposals,
      firstIngestion.knowledgeProposals,
    )
    assert.deepEqual(loaded.run.minimumViableBrand, {
      usableOffer: true,
      contentLanguage: true,
      usableVoice: true,
      satisfied: true,
    })
    assert.equal(loaded.supportingSources.length, 1)
    assert.equal(loaded.supportingSources[0].source.kind, "social.website")
    assert.equal(
      loaded.supportingSources[0].evidence.length,
      websiteIngestion.evidence.length,
    )
    assert.equal(loaded.sourceArtifacts.length, 1)
    assert.equal(loaded.sourceArtifacts[0].role, "logoCandidate")
    assert.deepEqual(
      Buffer.from(loaded.sourceArtifacts[0].content),
      Buffer.from(logoBytes),
    )

    const duplicateIngestion = createManualIngestion({
      brandId,
      sourceId,
      snapshotId: `snapshot:integration:${suffix}:2`,
      evidencePrefix: `evidence:integration:${suffix}:2`,
    })
    const duplicate = await restartedStore.persist(
      createBatch({
        brandId,
        runId: `run:integration:${suffix}:2`,
        ingestion: duplicateIngestion,
      }),
    )
    assert.deepEqual(duplicate, {
      status: "duplicate",
      existingSnapshotId: snapshotId,
    })

    const counts = await pool.query(
      `
        SELECT
          (SELECT count(*)::integer FROM source_snapshots WHERE source_id = $1)
            AS snapshot_count,
          (SELECT count(*)::integer FROM ingestion_runs WHERE source_id = $1)
            AS run_count
      `,
      [sourceId],
    )
    assert.deepEqual(counts.rows[0], {
      snapshot_count: 1,
      run_count: 1,
    })
  },
)
