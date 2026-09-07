CREATE TABLE weekly_post_batches (
  run_id uuid PRIMARY KEY REFERENCES weekly_planning_runs(id) ON DELETE CASCADE,
  status text NOT NULL CHECK(status IN ('queued','running','ready','failed')),
  step text NOT NULL CHECK(step IN ('outline','writing','review','ready')),
  payload jsonb NOT NULL,
  error text,
  lease_token uuid,
  lease_until timestamptz,
  approved_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE weekly_post_assets (
  id uuid PRIMARY KEY,
  run_id uuid NOT NULL REFERENCES weekly_post_batches(run_id) ON DELETE CASCADE,
  post_key text NOT NULL CHECK(post_key ~ '^p[1-5]$'),
  slot integer NOT NULL CHECK(slot BETWEEN 0 AND 5),
  name text NOT NULL,
  width integer NOT NULL CHECK(width>0),
  height integer NOT NULL CHECK(height>0),
  content bytea NOT NULL CHECK(octet_length(content)<=8388608),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(run_id,post_key,slot)
);
CREATE INDEX weekly_post_batches_pending_idx ON weekly_post_batches(status,lease_until) WHERE status IN ('queued','running');
