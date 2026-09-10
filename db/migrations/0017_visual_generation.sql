CREATE TABLE visual_generations (
  id uuid PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE RESTRICT,
  brand_id text REFERENCES brands(id) ON DELETE SET NULL,
  request_id uuid NOT NULL,
  request_fingerprint text NOT NULL,
  prompt text NOT NULL CHECK(length(prompt) BETWEEN 1 AND 4000),
  model text NOT NULL,
  quality text NOT NULL CHECK(quality IN ('low','medium','high')),
  aspect_ratio text NOT NULL CHECK(aspect_ratio IN ('1:1','4:5','9:16')),
  request_kind text NOT NULL CHECK(request_kind IN ('generate','regenerate')),
  target jsonb,
  status text NOT NULL CHECK(status IN ('pending','succeeded','failed')),
  lease_token uuid,
  lease_until timestamptz,
  started_at timestamptz,
  provider_request_id text,
  provider_asset_id text,
  provider_cost_usd numeric CHECK(provider_cost_usd >= 0),
  metadata jsonb NOT NULL DEFAULT '{}',
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  UNIQUE(workspace_id,request_id),
  UNIQUE(workspace_id,id),
  CHECK((status='pending') = (completed_at IS NULL))
);
CREATE INDEX visual_generations_history ON visual_generations(workspace_id,created_at DESC);
CREATE INDEX visual_generations_queue ON visual_generations(created_at) WHERE status='pending';

-- Same durable bytea storage pattern as weekly_post_assets. Kept independently
-- so replacing/removing a post attachment cannot destroy generation history.
CREATE TABLE visual_assets (
  generation_id uuid PRIMARY KEY REFERENCES visual_generations(id) ON DELETE RESTRICT,
  content bytea NOT NULL CHECK(octet_length(content) BETWEEN 1 AND 8388608),
  width integer NOT NULL CHECK(width>0),
  height integer NOT NULL CHECK(height>0)
);
CREATE TABLE visual_credit_ledger (
  id uuid PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE RESTRICT,
  delta integer NOT NULL CHECK(delta<>0),
  reason text NOT NULL CHECK(reason IN ('demo_seed','subscription_allowance','credit_purchase','manual_adjustment','generation_success')),
  generation_id uuid,
  grant_key text,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY(workspace_id,generation_id) REFERENCES visual_generations(workspace_id,id) ON DELETE RESTRICT,
  CHECK((reason='generation_success' AND delta=-1 AND generation_id IS NOT NULL AND grant_key IS NULL)
    OR (reason<>'generation_success' AND generation_id IS NULL AND grant_key IS NOT NULL AND (reason='manual_adjustment' OR delta>0))),
  UNIQUE(workspace_id,grant_key)
);
CREATE UNIQUE INDEX visual_credit_demo_once ON visual_credit_ledger(workspace_id) WHERE reason='demo_seed';
CREATE UNIQUE INDEX visual_credit_charge_once ON visual_credit_ledger(generation_id) WHERE reason='generation_success';
CREATE INDEX visual_credit_balance ON visual_credit_ledger(workspace_id);
