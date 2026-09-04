CREATE TABLE IF NOT EXISTS source_artifacts (
  id text PRIMARY KEY,
  brand_id text NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  source_id text NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
  snapshot_id text NOT NULL REFERENCES source_snapshots(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('image')),
  role text NOT NULL CHECK (role IN ('logoCandidate')),
  media_type text NOT NULL,
  content_hash text NOT NULL,
  byte_size integer NOT NULL CHECK (byte_size >= 0),
  content bytea NOT NULL,
  source_url text NOT NULL,
  created_at timestamptz NOT NULL,
  CHECK (octet_length(content) = byte_size),
  UNIQUE (brand_id, role, content_hash)
);

CREATE INDEX IF NOT EXISTS source_artifacts_brand_id_idx
  ON source_artifacts(brand_id);

CREATE INDEX IF NOT EXISTS source_artifacts_snapshot_id_idx
  ON source_artifacts(snapshot_id);
