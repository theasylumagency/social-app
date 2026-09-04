CREATE TABLE IF NOT EXISTS brands (
  id text PRIMARY KEY,
  created_at timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS sources (
  id text PRIMARY KEY,
  brand_id text NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  kind text NOT NULL,
  reference jsonb NOT NULL,
  created_at timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS sources_brand_id_idx ON sources(brand_id);

CREATE TABLE IF NOT EXISTS source_snapshots (
  id text PRIMARY KEY,
  source_id text NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
  brand_id text NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  captured_at timestamptz NOT NULL,
  content_hash text NOT NULL,
  content jsonb NOT NULL,
  source_metadata jsonb,
  UNIQUE (source_id, content_hash)
);

CREATE INDEX IF NOT EXISTS source_snapshots_brand_id_idx
  ON source_snapshots(brand_id);

CREATE TABLE IF NOT EXISTS evidence (
  id text PRIMARY KEY,
  brand_id text NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  snapshot_id text NOT NULL REFERENCES source_snapshots(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('fact', 'claim', 'observation', 'inference')),
  source_claim_mode text NOT NULL
    CHECK (source_claim_mode IN ('explicit', 'implicit', 'derived')),
  value jsonb NOT NULL,
  evidence_strength text NOT NULL
    CHECK (evidence_strength IN ('weak', 'medium', 'strong')),
  excerpt text,
  locator jsonb,
  temporal_metadata jsonb,
  independence_group_id text,
  lineage jsonb
);

CREATE INDEX IF NOT EXISTS evidence_snapshot_id_idx ON evidence(snapshot_id);
CREATE INDEX IF NOT EXISTS evidence_brand_id_idx ON evidence(brand_id);

CREATE TABLE IF NOT EXISTS evidence_routings (
  evidence_id text NOT NULL REFERENCES evidence(id) ON DELETE CASCADE,
  routing_version text NOT NULL,
  targets jsonb NOT NULL,
  PRIMARY KEY (evidence_id, routing_version)
);

CREATE TABLE IF NOT EXISTS knowledge_claims (
  id text PRIMARY KEY,
  brand_id text NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  path text NOT NULL,
  value jsonb NOT NULL,
  context jsonb,
  epistemic_status text NOT NULL
    CHECK (epistemic_status IN ('observed', 'inferred', 'hypothesis', 'confirmed')),
  lifecycle text NOT NULL CHECK (lifecycle IN ('active', 'inactive')),
  provenance jsonb NOT NULL,
  created_at timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS knowledge_claims_brand_path_idx
  ON knowledge_claims(brand_id, path);

CREATE TABLE IF NOT EXISTS ingestion_runs (
  id text PRIMARY KEY,
  brand_id text NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  source_id text NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
  snapshot_id text NOT NULL UNIQUE REFERENCES source_snapshots(id) ON DELETE CASCADE,
  status text NOT NULL CHECK (status IN ('completed')),
  started_at timestamptz NOT NULL,
  completed_at timestamptz NOT NULL,
  evidence_count integer NOT NULL CHECK (evidence_count >= 0),
  routing_count integer NOT NULL CHECK (routing_count >= 0),
  proposal_count integer NOT NULL CHECK (proposal_count >= 0),
  minimum_viable_brand jsonb NOT NULL
);

CREATE INDEX IF NOT EXISTS ingestion_runs_brand_id_idx ON ingestion_runs(brand_id);
CREATE INDEX IF NOT EXISTS ingestion_runs_source_id_idx ON ingestion_runs(source_id);

CREATE TABLE IF NOT EXISTS knowledge_mutation_proposals (
  ingestion_run_id text NOT NULL REFERENCES ingestion_runs(id) ON DELETE CASCADE,
  sequence integer NOT NULL CHECK (sequence >= 0),
  kind text NOT NULL,
  path text,
  proposal jsonb NOT NULL,
  PRIMARY KEY (ingestion_run_id, sequence)
);
