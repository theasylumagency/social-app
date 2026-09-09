CREATE TABLE social_analytics_cursors (
  provider text NOT NULL,
  provider_profile_ref text NOT NULL,
  cursor text,
  bootstrapped_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (provider,provider_profile_ref),
  FOREIGN KEY (provider,provider_profile_ref) REFERENCES social_provider_profiles(provider,provider_profile_ref) ON DELETE CASCADE,
  CHECK (cursor IS NULL OR char_length(cursor) BETWEEN 1 AND 8000)
);

CREATE TABLE social_post_analytics (
  id text PRIMARY KEY,
  publishing_account_id text NOT NULL REFERENCES social_publishing_accounts(id) ON DELETE RESTRICT,
  provider_binding_id text NOT NULL REFERENCES social_provider_account_bindings(id) ON DELETE RESTRICT,
  provider text NOT NULL,
  provider_publication_ref text NOT NULL CHECK (btrim(provider_publication_ref)<>''),
  native_publication_ref text,
  publication_url text,
  provider_updated_at timestamptz NOT NULL,
  observed_at timestamptz NOT NULL,
  impressions bigint CHECK (impressions IS NULL OR impressions>=0),
  reach bigint CHECK (reach IS NULL OR reach>=0),
  likes bigint CHECK (likes IS NULL OR likes>=0),
  comments bigint CHECK (comments IS NULL OR comments>=0),
  shares bigint CHECK (shares IS NULL OR shares>=0),
  saves bigint CHECK (saves IS NULL OR saves>=0),
  clicks bigint CHECK (clicks IS NULL OR clicks>=0),
  views bigint CHECK (views IS NULL OR views>=0),
  follows bigint CHECK (follows IS NULL OR follows>=0),
  engagement_rate numeric CHECK (engagement_rate IS NULL OR engagement_rate>=0),
  metric_availability jsonb NOT NULL CHECK (jsonb_typeof(metric_availability)='object'),
  raw_metrics jsonb NOT NULL CHECK (jsonb_typeof(raw_metrics)='object'),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider_binding_id,provider_publication_ref,provider_updated_at)
);
CREATE INDEX social_post_analytics_account_idx ON social_post_analytics(publishing_account_id,provider_updated_at DESC);
