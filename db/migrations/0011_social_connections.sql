-- Stable UNDA destinations are independent of the provider used to reach them.
CREATE TABLE social_provider_profiles (
  id text PRIMARY KEY CHECK (btrim(id) <> ''),
  brand_id text NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  provider text NOT NULL CHECK (btrim(provider) <> ''),
  provider_profile_ref text NOT NULL CHECK (btrim(provider_profile_ref) <> ''),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','disabled','error')),
  last_error_code text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (brand_id, provider),
  UNIQUE (provider, provider_profile_ref),
  UNIQUE (id, brand_id, provider),
  UNIQUE (brand_id, provider, provider_profile_ref)
);

CREATE TABLE social_publishing_accounts (
  id text PRIMARY KEY CHECK (btrim(id) <> ''),
  brand_id text NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  channel text NOT NULL CHECK (channel IN ('facebook','instagram')),
  native_account_ref text CHECK (native_account_ref IS NULL OR btrim(native_account_ref) <> ''),
  username text,
  display_name text,
  profile_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, channel),
  UNIQUE (id, brand_id, channel)
);
CREATE UNIQUE INDEX social_publishing_accounts_native_idx
  ON social_publishing_accounts(channel, native_account_ref) WHERE native_account_ref IS NOT NULL;
CREATE INDEX social_publishing_accounts_brand_idx ON social_publishing_accounts(brand_id);

CREATE TABLE social_provider_account_bindings (
  id text PRIMARY KEY CHECK (btrim(id) <> ''),
  publishing_account_id text NOT NULL,
  -- Redundant brand/channel columns enforce tenant and destination agreement.
  brand_id text NOT NULL,
  channel text NOT NULL CHECK (channel IN ('facebook','instagram')),
  provider text NOT NULL CHECK (btrim(provider) <> ''),
  provider_profile_ref text NOT NULL CHECK (btrim(provider_profile_ref) <> ''),
  provider_account_ref text NOT NULL CHECK (btrim(provider_account_ref) <> ''),
  binding_status text NOT NULL DEFAULT 'active' CHECK (binding_status IN ('active','retired')),
  connection_status text NOT NULL CHECK (connection_status IN ('connected','disconnected','error')),
  can_publish boolean NOT NULL DEFAULT false,
  can_fetch_analytics boolean NOT NULL DEFAULT false,
  capabilities jsonb NOT NULL DEFAULT '{}' CHECK (jsonb_typeof(capabilities) = 'object'),
  connected_at timestamptz,
  disconnected_at timestamptz,
  health_checked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (publishing_account_id, channel)
    REFERENCES social_publishing_accounts(id, channel) ON DELETE CASCADE,
  FOREIGN KEY (publishing_account_id, brand_id, channel)
    REFERENCES social_publishing_accounts(id, brand_id, channel) ON DELETE CASCADE,
  FOREIGN KEY (brand_id, provider, provider_profile_ref)
    REFERENCES social_provider_profiles(brand_id, provider, provider_profile_ref) ON DELETE CASCADE,
  UNIQUE (provider, provider_account_ref)
);
CREATE UNIQUE INDEX social_provider_account_bindings_active_idx
  ON social_provider_account_bindings(publishing_account_id) WHERE binding_status = 'active';

-- Historical routing identity cannot be repointed or reactivated in place.
CREATE FUNCTION protect_social_provider_binding() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.binding_status = 'retired' OR
     (NEW.id, NEW.publishing_account_id, NEW.brand_id, NEW.channel, NEW.provider,
      NEW.provider_profile_ref, NEW.provider_account_ref, NEW.created_at)
     IS DISTINCT FROM
     (OLD.id, OLD.publishing_account_id, OLD.brand_id, OLD.channel, OLD.provider,
      OLD.provider_profile_ref, OLD.provider_account_ref, OLD.created_at) THEN
    RAISE EXCEPTION 'Provider binding identity and retired history are immutable' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER social_provider_binding_immutable BEFORE UPDATE ON social_provider_account_bindings
  FOR EACH ROW EXECUTE FUNCTION protect_social_provider_binding();

-- Schema foundation only: the headless OAuth workflow is implemented in Phase 2.
CREATE TABLE social_connection_intents (
  id uuid PRIMARY KEY,
  brand_id text NOT NULL,
  provider text NOT NULL,
  provider_profile_ref text NOT NULL,
  requested_channel text NOT NULL CHECK (requested_channel IN ('facebook','instagram')),
  initiated_by_user_id text NOT NULL REFERENCES auth_user(id) ON DELETE CASCADE,
  state_digest bytea NOT NULL UNIQUE CHECK (octet_length(state_digest) = 32),
  return_path text NOT NULL CHECK (return_path IN ('/workspace/connections')),
  flow_step text NOT NULL DEFAULT 'initiated' CHECK (flow_step IN ('initiated','select_page','completed','failed')),
  selection_options jsonb NOT NULL DEFAULT '[]' CHECK (jsonb_typeof(selection_options) = 'array'),
  provider_context_ciphertext bytea,
  provider_context_iv bytea,
  provider_context_tag bytea,
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (brand_id, provider, provider_profile_ref)
    REFERENCES social_provider_profiles(brand_id, provider, provider_profile_ref) ON DELETE CASCADE,
  CHECK (expires_at > created_at),
  CHECK ((provider_context_ciphertext IS NULL AND provider_context_iv IS NULL AND provider_context_tag IS NULL)
    OR (provider_context_ciphertext IS NOT NULL AND provider_context_iv IS NOT NULL AND provider_context_tag IS NOT NULL
      AND octet_length(provider_context_iv) = 12 AND octet_length(provider_context_tag) = 16))
);
CREATE INDEX social_connection_intents_expiry_idx ON social_connection_intents(expires_at);
