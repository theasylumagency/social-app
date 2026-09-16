CREATE TABLE brand_operating_rules (
  id uuid PRIMARY KEY,
  owner_user_id text NOT NULL REFERENCES auth_user(id) ON DELETE CASCADE,
  brand_id text NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  revision integer NOT NULL CHECK (revision > 0),
  status text NOT NULL CHECK (status IN ('active','superseded','reverted')),
  kind text NOT NULL CHECK (kind IN ('emoji','price','address_form','term')),
  effect text NOT NULL CHECK (effect IN ('forbid','require','allow')),
  parameter text,
  directive text NOT NULL,
  scope jsonb NOT NULL,
  source_note_id uuid NOT NULL REFERENCES contextual_notes(id) ON DELETE RESTRICT,
  superseded_by uuid REFERENCES brand_operating_rules(id) ON DELETE RESTRICT,
  activated_at timestamptz NOT NULL DEFAULT now(),
  deactivated_at timestamptz,
  UNIQUE(brand_id,revision)
);
CREATE INDEX brand_operating_rules_active ON brand_operating_rules(owner_user_id,brand_id,status,kind);

CREATE TABLE brand_channel_operating_policies (
  owner_user_id text NOT NULL REFERENCES auth_user(id) ON DELETE CASCADE,
  brand_id text NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  channel text NOT NULL CHECK (channel IN ('facebook','instagram')),
  active boolean NOT NULL,
  revision integer NOT NULL CHECK (revision > 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(brand_id,channel)
);
CREATE TABLE brand_channel_operating_policy_events (
  id uuid PRIMARY KEY,
  owner_user_id text NOT NULL REFERENCES auth_user(id) ON DELETE CASCADE,
  brand_id text NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  channel text NOT NULL CHECK (channel IN ('facebook','instagram')),
  revision integer NOT NULL CHECK (revision > 0),
  previous_active boolean NOT NULL,
  active boolean NOT NULL,
  source_note_id uuid NOT NULL REFERENCES contextual_notes(id) ON DELETE RESTRICT,
  reverted_event_id uuid REFERENCES brand_channel_operating_policy_events(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(brand_id,channel,revision)
);
CREATE INDEX brand_channel_policy_history ON brand_channel_operating_policy_events(owner_user_id,brand_id,channel,revision DESC);
