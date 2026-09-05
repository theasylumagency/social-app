import type { Pool, PoolClient } from "pg"
import { assertWorkspaceAccess, type WorkspaceAccess } from "./workspace-store"

import {
  createIsoDateTime,
  type BrandId,
  type Evidence,
  type EvidenceId,
  type EvidenceRouting,
  type IngestionRunId,
  type KnowledgeClaim,
  type KnowledgeClaimId,
  type KnowledgeMutationProposal,
  type Source,
  type SourceArtifact,
  type SourceArtifactId,
  type SourceId,
  type SourceSnapshot,
  type SourceSnapshotId,
} from "../../core/domain"
import type {
  CompletedIngestionRun,
  IngestionPersistenceBatch,
  IngestionStore,
  PersistedBrand,
  PersistedIngestionGraph,
  PersistedSourceGraph,
  PersistIngestionResult,
} from "../../core/persistence"

type SnapshotGraphRow = {
  brand_id: string
  brand_created_at: Date
  source_id: string
  source_kind: string
  source_reference: unknown
  source_created_at: Date
  snapshot_id: string
  captured_at: Date
  content_hash: string
  content: unknown
  source_metadata: unknown | null
  run_id: string
  run_status: "completed"
  started_at: Date
  completed_at: Date
  minimum_viable_brand: unknown
}

type EvidenceRow = {
  id: string
  brand_id: string
  snapshot_id: string
  type: Evidence["type"]
  source_claim_mode: Evidence["sourceClaimMode"]
  value: unknown
  evidence_strength: Evidence["evidenceStrength"]
  excerpt: string | null
  locator: unknown | null
  temporal_metadata: unknown | null
  independence_group_id: string | null
  lineage: unknown | null
}

type EvidenceRoutingRow = {
  evidence_id: string
  routing_version: string
  targets: unknown
}

type KnowledgeProposalRow = {
  proposal: unknown
}

type KnowledgeClaimRow = {
  id: string
  brand_id: string
  path: string
  value: unknown
  context: unknown | null
  epistemic_status: KnowledgeClaim["epistemicStatus"]
  lifecycle: KnowledgeClaim["lifecycle"]
  provenance: unknown
  created_at: Date
}

type SupportingSourceRow = {
  source_id: string
  source_kind: string
  source_reference: unknown
  source_created_at: Date
  snapshot_id: string
  captured_at: Date
  content_hash: string
  content: unknown
  source_metadata: unknown | null
}

type SourceArtifactRow = {
  id: string
  brand_id: string
  source_id: string
  snapshot_id: string
  kind: SourceArtifact["kind"]
  role: SourceArtifact["role"]
  media_type: SourceArtifact["mediaType"]
  content_hash: string
  byte_size: number
  content: Buffer
  source_url: string
  created_at: Date
}

function jsonValue(value: unknown, field: string): string {
  const serialized = JSON.stringify(value)
  if (serialized === undefined) {
    throw new TypeError(`${field} must be JSON-serializable`)
  }
  return serialized
}

function assertBatchIntegrity(batch: IngestionPersistenceBatch): void {
  const { brand, run, source, snapshot } = batch

  if (source.brandId !== brand.id) {
    throw new RangeError("Source brand does not match the persisted brand")
  }
  if (snapshot.brandId !== brand.id || snapshot.sourceId !== source.id) {
    throw new RangeError("Snapshot does not belong to the supplied brand and source")
  }
  if (
    run.brandId !== brand.id ||
    run.sourceId !== source.id ||
    run.snapshotId !== snapshot.id
  ) {
    throw new RangeError("Ingestion run does not match the supplied graph")
  }
  if (
    run.minimumViableBrand.satisfied !==
    (run.minimumViableBrand.usableOffer &&
      run.minimumViableBrand.contentLanguage &&
      run.minimumViableBrand.usableVoice)
  ) {
    throw new RangeError("Minimum Viable Brand status is internally inconsistent")
  }

  const evidenceIds = new Set<EvidenceId>()
  const routingKeys = new Set<string>()
  const sourceIds = new Set<SourceId>([source.id])
  const snapshotIds = new Set<SourceSnapshotId>([snapshot.id])
  const graphs = [
    { source, snapshot, evidence: batch.evidence, routings: batch.routings },
    ...(batch.supportingSources ?? []),
  ]
  for (const graph of graphs) {
    if (
      graph.source.brandId !== brand.id ||
      graph.snapshot.brandId !== brand.id ||
      graph.snapshot.sourceId !== graph.source.id
    ) {
      throw new RangeError("Source graph does not belong to the supplied brand")
    }
    if (graph !== graphs[0]) {
      if (sourceIds.has(graph.source.id) || snapshotIds.has(graph.snapshot.id)) {
        throw new RangeError("Source graph IDs must be unique")
      }
      sourceIds.add(graph.source.id)
      snapshotIds.add(graph.snapshot.id)
    }
    const graphEvidenceIds = new Set<EvidenceId>()
    for (const item of graph.evidence) {
      if (item.brandId !== brand.id || item.snapshotId !== graph.snapshot.id) {
        throw new RangeError("Evidence does not belong to the supplied graph")
      }
      if (evidenceIds.has(item.id)) {
        throw new RangeError(`Duplicate Evidence ID: ${item.id}`)
      }
      evidenceIds.add(item.id)
      graphEvidenceIds.add(item.id)
    }
    for (const routing of graph.routings) {
      if (!graphEvidenceIds.has(routing.evidenceId)) {
        throw new RangeError(
          `Routing references unknown Evidence: ${routing.evidenceId}`,
        )
      }
      const key = `${routing.evidenceId}\u0000${routing.routingVersion}`
      if (routingKeys.has(key)) {
        throw new RangeError(`Duplicate Evidence routing: ${routing.evidenceId}`)
      }
      routingKeys.add(key)
    }
  }

  const artifactIds = new Set<SourceArtifactId>()
  for (const artifact of batch.sourceArtifacts ?? []) {
    if (
      artifact.brandId !== brand.id ||
      !sourceIds.has(artifact.sourceId) ||
      !snapshotIds.has(artifact.snapshotId) ||
      artifact.byteSize !== artifact.content.byteLength
    ) {
      throw new RangeError("Source artifact does not belong to the supplied graph")
    }
    if (artifactIds.has(artifact.id)) {
      throw new RangeError(`Duplicate SourceArtifact ID: ${artifact.id}`)
    }
    artifactIds.add(artifact.id)
  }
}

async function persistBrand(
  client: PoolClient,
  brand: PersistedBrand,
  access?: WorkspaceAccess,
): Promise<void> {
  const result = await client.query(
    `
      INSERT INTO brands(id, created_at, workspace_id)
      VALUES ($1, $2, $3)
      ON CONFLICT (id) DO UPDATE SET id = EXCLUDED.id
      WHERE brands.created_at = EXCLUDED.created_at
        AND brands.workspace_id IS NOT DISTINCT FROM EXCLUDED.workspace_id
      RETURNING id
    `,
    [brand.id, brand.createdAt, access?.workspaceId ?? null],
  )
  if (result.rowCount !== 1) {
    throw new Error(`Brand ID ${brand.id} already exists with different data`)
  }
}

async function persistSource(client: PoolClient, source: Source): Promise<void> {
  const result = await client.query(
    `
      INSERT INTO sources(id, brand_id, kind, reference, created_at)
      VALUES ($1, $2, $3, $4::jsonb, $5)
      ON CONFLICT (id) DO UPDATE SET id = EXCLUDED.id
      WHERE sources.brand_id = EXCLUDED.brand_id
        AND sources.kind = EXCLUDED.kind
        AND sources.reference = EXCLUDED.reference
        AND sources.created_at = EXCLUDED.created_at
      RETURNING id
    `,
    [
      source.id,
      source.brandId,
      source.kind,
      jsonValue(source.reference, "Source reference"),
      source.createdAt,
    ],
  )
  if (result.rowCount !== 1) {
    throw new Error(`Source ID ${source.id} already exists with different data`)
  }
}

async function persistSnapshot(
  client: PoolClient,
  snapshot: SourceSnapshot,
): Promise<PersistIngestionResult | undefined> {
  const result = await client.query<{ id: string }>(
    `
      INSERT INTO source_snapshots(
        id, source_id, brand_id, captured_at, content_hash, content, source_metadata
      )
      VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb)
      ON CONFLICT (source_id, content_hash) DO NOTHING
      RETURNING id
    `,
    [
      snapshot.id,
      snapshot.sourceId,
      snapshot.brandId,
      snapshot.capturedAt,
      snapshot.contentHash,
      jsonValue(snapshot.content, "Snapshot content"),
      snapshot.sourceMetadata === undefined
        ? null
        : jsonValue(snapshot.sourceMetadata, "Snapshot metadata"),
    ],
  )
  if (result.rowCount === 1) {
    return undefined
  }

  const duplicate = await client.query<{ id: string }>(
    `
      SELECT id
      FROM source_snapshots
      WHERE source_id = $1 AND content_hash = $2
    `,
    [snapshot.sourceId, snapshot.contentHash],
  )
  const existing = duplicate.rows[0]
  if (existing === undefined) {
    throw new Error("Snapshot conflict was detected but could not be resolved")
  }
  return {
    status: "duplicate",
    existingSnapshotId: existing.id as SourceSnapshotId,
  }
}

async function persistEvidence(
  client: PoolClient,
  evidence: readonly Evidence[],
): Promise<void> {
  for (const item of evidence) {
    await client.query(
      `
        INSERT INTO evidence(
          id, brand_id, snapshot_id, type, source_claim_mode, value,
          evidence_strength, excerpt, locator, temporal_metadata,
          independence_group_id, lineage
        )
        VALUES (
          $1, $2, $3, $4, $5, $6::jsonb,
          $7, $8, $9::jsonb, $10::jsonb, $11, $12::jsonb
        )
      `,
      [
        item.id,
        item.brandId,
        item.snapshotId,
        item.type,
        item.sourceClaimMode,
        jsonValue(item.value, "Evidence value"),
        item.evidenceStrength,
        item.excerpt ?? null,
        item.locator === undefined
          ? null
          : jsonValue(item.locator, "Evidence locator"),
        item.temporalMetadata === undefined
          ? null
          : jsonValue(item.temporalMetadata, "Evidence temporal metadata"),
        item.independenceGroupId ?? null,
        item.lineage === undefined
          ? null
          : jsonValue(item.lineage, "Evidence lineage"),
      ],
    )
  }
}

async function persistRoutings(
  client: PoolClient,
  routings: readonly EvidenceRouting[],
): Promise<void> {
  for (const routing of routings) {
    await client.query(
      `
        INSERT INTO evidence_routings(evidence_id, routing_version, targets)
        VALUES ($1, $2, $3::jsonb)
      `,
      [
        routing.evidenceId,
        routing.routingVersion,
        jsonValue(routing.targets, "Evidence routing targets"),
      ],
    )
  }
}

async function persistSourceArtifacts(
  client: PoolClient,
  artifacts: readonly SourceArtifact[],
): Promise<void> {
  for (const artifact of artifacts) {
    await client.query(
      `
        INSERT INTO source_artifacts(
          id, brand_id, source_id, snapshot_id, kind, role, media_type,
          content_hash, byte_size, content, source_url, created_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      `,
      [
        artifact.id,
        artifact.brandId,
        artifact.sourceId,
        artifact.snapshotId,
        artifact.kind,
        artifact.role,
        artifact.mediaType,
        artifact.contentHash,
        artifact.byteSize,
        Buffer.from(artifact.content),
        artifact.sourceUrl,
        artifact.createdAt,
      ],
    )
  }
}

async function persistRunAndProposals(
  client: PoolClient,
  batch: IngestionPersistenceBatch,
): Promise<void> {
  const { run, evidence, routings, knowledgeProposals } = batch
  await client.query(
    `
      INSERT INTO ingestion_runs(
        id, brand_id, source_id, snapshot_id, status, started_at, completed_at,
        evidence_count, routing_count, proposal_count, minimum_viable_brand
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb)
    `,
    [
      run.id,
      run.brandId,
      run.sourceId,
      run.snapshotId,
      run.status,
      run.startedAt,
      run.completedAt,
      evidence.length,
      routings.length,
      knowledgeProposals.length,
      jsonValue(run.minimumViableBrand, "Minimum Viable Brand status"),
    ],
  )

  for (const [sequence, proposal] of knowledgeProposals.entries()) {
    const path = "path" in proposal ? proposal.path : null
    await client.query(
      `
        INSERT INTO knowledge_mutation_proposals(
          ingestion_run_id, sequence, kind, path, proposal
        )
        VALUES ($1, $2, $3, $4, $5::jsonb)
      `,
      [
        run.id,
        sequence,
        proposal.kind,
        path,
        jsonValue(proposal, "Knowledge mutation proposal"),
      ],
    )
  }
}

function hydrateEvidence(row: EvidenceRow): Evidence {
  return {
    id: row.id as EvidenceId,
    brandId: row.brand_id as BrandId,
    snapshotId: row.snapshot_id as SourceSnapshotId,
    type: row.type,
    sourceClaimMode: row.source_claim_mode,
    value: row.value,
    evidenceStrength: row.evidence_strength,
    ...(row.excerpt === null ? {} : { excerpt: row.excerpt }),
    ...(row.locator === null
      ? {}
      : { locator: row.locator as NonNullable<Evidence["locator"]> }),
    ...(row.temporal_metadata === null
      ? {}
      : {
          temporalMetadata:
            row.temporal_metadata as NonNullable<Evidence["temporalMetadata"]>,
        }),
    ...(row.independence_group_id === null
      ? {}
      : { independenceGroupId: row.independence_group_id }),
    ...(row.lineage === null
      ? {}
      : { lineage: row.lineage as NonNullable<Evidence["lineage"]> }),
  }
}

function hydrateKnowledgeClaim(row: KnowledgeClaimRow): KnowledgeClaim {
  return {
    id: row.id as KnowledgeClaimId,
    brandId: row.brand_id as BrandId,
    path: row.path as KnowledgeClaim["path"],
    value: row.value,
    ...(row.context === null
      ? {}
      : { context: row.context as NonNullable<KnowledgeClaim["context"]> }),
    epistemicStatus: row.epistemic_status,
    lifecycle: row.lifecycle,
    provenance: row.provenance as KnowledgeClaim["provenance"],
    createdAt: createIsoDateTime(row.created_at.toISOString()),
  }
}

export class PostgresIngestionStore implements IngestionStore {
  readonly #pool: Pool
  readonly #access: WorkspaceAccess | undefined

  // Unscoped instances are reserved for internal maintenance/domain tests.
  // Every application request must supply server-resolved workspace access.
  constructor(pool: Pool, access?: WorkspaceAccess) {
    this.#pool = pool
    this.#access = access
  }

  async persist(batch: IngestionPersistenceBatch): Promise<PersistIngestionResult> {
    assertBatchIntegrity(batch)
    const client = await this.#pool.connect()

    try {
      await client.query("BEGIN")
      if (this.#access) await assertWorkspaceAccess(client, this.#access)
      await persistBrand(client, batch.brand, this.#access)
      for (const supporting of batch.supportingSources ?? []) {
        await persistSource(client, supporting.source)
        const duplicateSupportingSnapshot = await persistSnapshot(
          client,
          supporting.snapshot,
        )
        if (duplicateSupportingSnapshot !== undefined) {
          throw new Error(
            `Supporting snapshot ${supporting.snapshot.id} duplicates ${
              duplicateSupportingSnapshot.status === "duplicate"
                ? duplicateSupportingSnapshot.existingSnapshotId
                : duplicateSupportingSnapshot.snapshotId
            }`,
          )
        }
        await persistEvidence(client, supporting.evidence)
        await persistRoutings(client, supporting.routings)
      }
      await persistSource(client, batch.source)
      const duplicate = await persistSnapshot(client, batch.snapshot)
      if (duplicate !== undefined) {
        await client.query("ROLLBACK")
        return duplicate
      }

      await persistEvidence(client, batch.evidence)
      await persistRoutings(client, batch.routings)
      await persistSourceArtifacts(client, batch.sourceArtifacts ?? [])
      await persistRunAndProposals(client, batch)
      await client.query("COMMIT")
      return {
        status: "persisted",
        runId: batch.run.id,
        snapshotId: batch.snapshot.id,
      }
    } catch (error) {
      await client.query("ROLLBACK")
      throw error
    } finally {
      client.release()
    }
  }

  async loadBySnapshotId(
    snapshotId: SourceSnapshotId,
  ): Promise<PersistedIngestionGraph | undefined> {
    const client = await this.#pool.connect()
    try {
      await client.query("BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY")
      if (this.#access) await assertWorkspaceAccess(client, this.#access)
      const graphResult = await client.query<SnapshotGraphRow>(
        `
          SELECT
            b.id AS brand_id,
            b.created_at AS brand_created_at,
            s.id AS source_id,
            s.kind AS source_kind,
            s.reference AS source_reference,
            s.created_at AS source_created_at,
            ss.id AS snapshot_id,
            ss.captured_at,
            ss.content_hash,
            ss.content,
            ss.source_metadata,
            ir.id AS run_id,
            ir.status AS run_status,
            ir.started_at,
            ir.completed_at,
            ir.minimum_viable_brand
          FROM source_snapshots ss
          JOIN brands b ON b.id = ss.brand_id
          JOIN sources s ON s.id = ss.source_id
          JOIN ingestion_runs ir ON ir.snapshot_id = ss.id
          WHERE ss.id = $1
            ${this.#access ? "AND b.workspace_id = $2" : ""}
        `,
        this.#access ? [snapshotId, this.#access.workspaceId] : [snapshotId],
      )
      const graph = graphResult.rows[0]
      if (graph === undefined) {
        await client.query("COMMIT")
        return undefined
      }

      const evidenceResult = await client.query<EvidenceRow>(
        "SELECT * FROM evidence WHERE snapshot_id = $1 ORDER BY id",
        [snapshotId],
      )
      const routingResult = await client.query<EvidenceRoutingRow>(
        `
          SELECT er.evidence_id, er.routing_version, er.targets
          FROM evidence_routings er
          JOIN evidence e ON e.id = er.evidence_id
          WHERE e.snapshot_id = $1
          ORDER BY er.evidence_id, er.routing_version
        `,
        [snapshotId],
      )
      const proposalResult = await client.query<KnowledgeProposalRow>(
        `
          SELECT proposal
          FROM knowledge_mutation_proposals
          WHERE ingestion_run_id = $1
          ORDER BY sequence
        `,
        [graph.run_id],
      )
      const claimResult = await client.query<KnowledgeClaimRow>(
        `
          SELECT *
          FROM knowledge_claims
          WHERE brand_id = $1
          ORDER BY created_at, id
        `,
        [graph.brand_id],
      )
      const supportingResult = await client.query<SupportingSourceRow>(
        `
          SELECT
            s.id AS source_id,
            s.kind AS source_kind,
            s.reference AS source_reference,
            s.created_at AS source_created_at,
            ss.id AS snapshot_id,
            ss.captured_at,
            ss.content_hash,
            ss.content,
            ss.source_metadata
          FROM source_snapshots ss
          JOIN sources s ON s.id = ss.source_id
          WHERE ss.brand_id = $1 AND ss.id <> $2
          ORDER BY ss.captured_at, ss.id
        `,
        [graph.brand_id, graph.snapshot_id],
      )
      const supportingSources: PersistedSourceGraph[] = []
      for (const row of supportingResult.rows) {
        const supportingEvidence = await client.query<EvidenceRow>(
          "SELECT * FROM evidence WHERE snapshot_id = $1 ORDER BY id",
          [row.snapshot_id],
        )
        const supportingRoutings = await client.query<EvidenceRoutingRow>(
          `
            SELECT er.evidence_id, er.routing_version, er.targets
            FROM evidence_routings er
            JOIN evidence e ON e.id = er.evidence_id
            WHERE e.snapshot_id = $1
            ORDER BY er.evidence_id, er.routing_version
          `,
          [row.snapshot_id],
        )
        const supportingSourceId = row.source_id as SourceId
        const supportingSnapshotId = row.snapshot_id as SourceSnapshotId
        supportingSources.push({
          source: {
            id: supportingSourceId,
            brandId: graph.brand_id as BrandId,
            kind: row.source_kind as Source["kind"],
            reference: row.source_reference as Source["reference"],
            createdAt: createIsoDateTime(row.source_created_at.toISOString()),
          },
          snapshot: {
            id: supportingSnapshotId,
            sourceId: supportingSourceId,
            brandId: graph.brand_id as BrandId,
            capturedAt: createIsoDateTime(row.captured_at.toISOString()),
            contentHash: row.content_hash as SourceSnapshot["contentHash"],
            content: row.content as SourceSnapshot["content"],
            ...(row.source_metadata === null
              ? {}
              : {
                  sourceMetadata:
                    row.source_metadata as NonNullable<
                      SourceSnapshot["sourceMetadata"]
                    >,
                }),
          },
          evidence: supportingEvidence.rows.map(hydrateEvidence),
          routings: supportingRoutings.rows.map((routing) => ({
            evidenceId: routing.evidence_id as EvidenceId,
            routingVersion: routing.routing_version,
            targets: routing.targets as EvidenceRouting["targets"],
          })),
        })
      }
      const artifactResult = await client.query<SourceArtifactRow>(
        `
          SELECT *
          FROM source_artifacts
          WHERE brand_id = $1
          ORDER BY created_at, id
        `,
        [graph.brand_id],
      )

      await client.query("COMMIT")

      const brandId = graph.brand_id as BrandId
      const sourceId = graph.source_id as SourceId
      const hydratedSnapshotId = graph.snapshot_id as SourceSnapshotId
      return {
        brand: {
          id: brandId,
          createdAt: createIsoDateTime(graph.brand_created_at.toISOString()),
        },
        source: {
          id: sourceId,
          brandId,
          kind: graph.source_kind as Source["kind"],
          reference: graph.source_reference as Source["reference"],
          createdAt: createIsoDateTime(graph.source_created_at.toISOString()),
        },
        snapshot: {
          id: hydratedSnapshotId,
          sourceId,
          brandId,
          capturedAt: createIsoDateTime(graph.captured_at.toISOString()),
          contentHash: graph.content_hash as SourceSnapshot["contentHash"],
          content: graph.content as SourceSnapshot["content"],
          ...(graph.source_metadata === null
            ? {}
            : {
                sourceMetadata:
                  graph.source_metadata as NonNullable<
                    SourceSnapshot["sourceMetadata"]
                  >,
              }),
        },
        run: {
          id: graph.run_id as IngestionRunId,
          brandId,
          sourceId,
          snapshotId: hydratedSnapshotId,
          status: graph.run_status,
          startedAt: createIsoDateTime(graph.started_at.toISOString()),
          completedAt: createIsoDateTime(graph.completed_at.toISOString()),
          minimumViableBrand:
            graph.minimum_viable_brand as CompletedIngestionRun["minimumViableBrand"],
        },
        evidence: evidenceResult.rows.map(hydrateEvidence),
        routings: routingResult.rows.map((row) => ({
          evidenceId: row.evidence_id as EvidenceId,
          routingVersion: row.routing_version,
          targets: row.targets as EvidenceRouting["targets"],
        })),
        knowledgeProposals: proposalResult.rows.map(
          (row) => row.proposal as KnowledgeMutationProposal,
        ),
        knowledgeClaims: claimResult.rows.map(hydrateKnowledgeClaim),
        supportingSources,
        sourceArtifacts: artifactResult.rows.map((row) => ({
          id: row.id as SourceArtifactId,
          brandId: row.brand_id as BrandId,
          sourceId: row.source_id as SourceId,
          snapshotId: row.snapshot_id as SourceSnapshotId,
          kind: row.kind,
          role: row.role,
          mediaType: row.media_type,
          contentHash: row.content_hash as SourceArtifact["contentHash"],
          byteSize: row.byte_size,
          content: row.content,
          sourceUrl: row.source_url,
          createdAt: createIsoDateTime(row.created_at.toISOString()),
        })),
      }
    } catch (error) {
      await client.query("ROLLBACK")
      throw error
    } finally {
      client.release()
    }
  }
}
