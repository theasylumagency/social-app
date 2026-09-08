-- No trial or invented migration of legacy goals. Existing work stays readable.
CREATE TABLE workspace_subscriptions (
  workspace_id text PRIMARY KEY REFERENCES workspaces(id) ON DELETE CASCADE,
  plan text NOT NULL CHECK(plan IN ('solo','studio','agency','custom')),
  brand_limit integer NOT NULL CHECK(brand_limit > 0),
  paid_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL CHECK(expires_at > paid_at),
  payment_mode text NOT NULL CHECK(payment_mode = 'simulated'),
  CHECK((plan='solo' AND brand_limit=1) OR (plan='studio' AND brand_limit=3) OR (plan='agency' AND brand_limit=10) OR (plan='custom' AND brand_limit>10))
);
CREATE TABLE subscription_payments (
  id uuid PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  plan text NOT NULL,
  brand_limit integer NOT NULL,
  paid_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL,
  mode text NOT NULL CHECK(mode='simulated')
);
-- Custom terms are provisioned by the operator, never by a checkout request.
CREATE TABLE subscription_custom_terms (
  workspace_id text PRIMARY KEY REFERENCES workspaces(id) ON DELETE CASCADE,
  brand_limit integer NOT NULL CHECK(brand_limit > 10),
  terms text NOT NULL CHECK(btrim(terms) <> '')
);
CREATE TABLE social_strategies (
  id uuid PRIMARY KEY,
  brand_id text NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  owner_user_id text NOT NULL REFERENCES auth_user(id) ON DELETE CASCADE,
  revision integer NOT NULL,
  status text NOT NULL CHECK(status IN ('queued','running','proposed','approved','superseded','failed')),
  payload jsonb NOT NULL,
  lease_token uuid,
  lease_until timestamptz,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(brand_id,revision)
);
CREATE UNIQUE INDEX social_strategy_active ON social_strategies(brand_id) WHERE status='approved';
CREATE TABLE social_strategy_model_runs (
  id text PRIMARY KEY,
  strategy_id uuid NOT NULL REFERENCES social_strategies(id) ON DELETE CASCADE,
  payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE social_week_reviews (
  brand_id text NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  week_start date NOT NULL,
  payload jsonb NOT NULL,
  reviewed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(brand_id, week_start)
);
