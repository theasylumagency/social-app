CREATE TABLE brand_discovery_sessions (
  id uuid PRIMARY KEY,
  owner_user_id text NOT NULL REFERENCES auth_user(id) ON DELETE CASCADE,
  brand_id text REFERENCES brands(id) ON DELETE RESTRICT,
  revision integer NOT NULL DEFAULT 1 CHECK (revision > 0),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','queued','running','ready','failed','confirmed')),
  step text NOT NULL DEFAULT 'sources' CHECK (step IN ('sources','understanding','audiences','profiles','envelope','goals','ready')),
  payload jsonb NOT NULL,
  error text,
  lease_token uuid,
  lease_until timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX brand_discovery_owner_updated_idx ON brand_discovery_sessions(owner_user_id, updated_at DESC);
CREATE INDEX brand_discovery_pending_idx ON brand_discovery_sessions(status, lease_until) WHERE status IN ('queued','running');

-- Immutable snapshots preserve both operator proposals and founder reactions.
CREATE TABLE brand_discovery_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  session_id uuid NOT NULL REFERENCES brand_discovery_sessions(id) ON DELETE CASCADE,
  revision integer NOT NULL,
  kind text NOT NULL,
  payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE brand_discovery_model_runs (
  id uuid PRIMARY KEY,
  session_id uuid NOT NULL REFERENCES brand_discovery_sessions(id) ON DELETE CASCADE,
  revision integer NOT NULL,
  step text NOT NULL,
  prompt_version text NOT NULL,
  model text NOT NULL,
  input_hash text NOT NULL,
  duration_ms integer NOT NULL CHECK (duration_ms >= 0),
  usage jsonb NOT NULL,
  validation_errors jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE brand_dossiers (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  brand_id text NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  session_id uuid NOT NULL UNIQUE REFERENCES brand_discovery_sessions(id) ON DELETE RESTRICT,
  revision integer NOT NULL,
  payload jsonb NOT NULL,
  confirmed_by text NOT NULL REFERENCES auth_user(id),
  confirmed_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX brand_dossiers_brand_latest_idx ON brand_dossiers(brand_id, id DESC);
