CREATE TABLE weekly_planning_runs (
  id uuid PRIMARY KEY,
  owner_user_id text NOT NULL REFERENCES auth_user(id) ON DELETE CASCADE,
  brand_id text NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  week_start date NOT NULL CHECK (extract(isodow FROM week_start)=1),
  version integer NOT NULL CHECK (version>0),
  status text NOT NULL CHECK (status IN ('queued','running','ready','failed','approved','changesRequested','superseded')),
  step text NOT NULL CHECK (step IN ('objective','focus','directions','adaptation','experiment','review','ready')),
  payload jsonb NOT NULL,
  error text,
  lease_token uuid,
  lease_until timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(brand_id,week_start,version)
);
CREATE UNIQUE INDEX weekly_planning_candidate_idx ON weekly_planning_runs(brand_id,week_start) WHERE status IN ('queued','running','ready');
CREATE UNIQUE INDEX weekly_planning_approved_idx ON weekly_planning_runs(brand_id,week_start) WHERE status='approved';
CREATE INDEX weekly_planning_pending_idx ON weekly_planning_runs(status,lease_until) WHERE status IN ('queued','running');
CREATE TABLE weekly_planning_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  run_id uuid NOT NULL REFERENCES weekly_planning_runs(id) ON DELETE CASCADE,
  kind text NOT NULL,
  payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE weekly_planning_model_runs (
  id uuid PRIMARY KEY,
  run_id uuid NOT NULL REFERENCES weekly_planning_runs(id) ON DELETE CASCADE,
  step text NOT NULL,
  prompt_version text NOT NULL,
  model text NOT NULL,
  input_hash text NOT NULL,
  duration_ms integer NOT NULL CHECK(duration_ms>=0),
  usage jsonb NOT NULL,
  validation_errors jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
