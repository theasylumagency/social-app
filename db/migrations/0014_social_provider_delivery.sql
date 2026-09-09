-- Durable provider delivery journal. The canonical attempt remains the claim authority.
CREATE TABLE social_provider_publish_requests (
  attempt_id text PRIMARY KEY REFERENCES social_publish_attempts(id) ON DELETE RESTRICT,
  provider_binding_id text NOT NULL REFERENCES social_provider_account_bindings(id) ON DELETE RESTRICT,
  provider text NOT NULL CHECK (char_length(btrim(provider)) > 0),
  request_id uuid NOT NULL UNIQUE,
  request_fingerprint text NOT NULL CHECK (request_fingerprint ~ '^[a-f0-9]{64}$'),
  state text NOT NULL DEFAULT 'prepared' CHECK (state IN ('prepared','preparingMedia','readyToDispatch','dispatchStarted','responseReceived')),
  provider_publication_ref text,
  duplicate_publication_ref text,
  http_status integer CHECK (http_status BETWEEN 100 AND 599),
  last_error_code text,
  dispatch_started_at timestamptz,
  response_received_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (provider_publication_ref IS NULL OR char_length(btrim(provider_publication_ref)) > 0),
  CHECK (duplicate_publication_ref IS NULL OR char_length(btrim(duplicate_publication_ref)) > 0),
  CHECK (last_error_code IS NULL OR char_length(btrim(last_error_code)) > 0),
  CHECK (dispatch_started_at IS NULL OR state IN ('dispatchStarted','responseReceived')),
  CHECK (response_received_at IS NULL OR state='responseReceived')
);
CREATE INDEX social_provider_publish_requests_binding_idx ON social_provider_publish_requests(provider_binding_id,created_at);
CREATE INDEX social_provider_publish_requests_provider_ref_idx ON social_provider_publish_requests(provider,provider_publication_ref) WHERE provider_publication_ref IS NOT NULL;

CREATE TABLE social_provider_media_uploads (
  attempt_id text NOT NULL REFERENCES social_publish_attempts(id) ON DELETE RESTRICT,
  ordinal integer NOT NULL CHECK (ordinal >= 0),
  source_asset_id text NOT NULL,
  media_type text NOT NULL CHECK (media_type IN ('image','video')),
  content_sha256 text NOT NULL CHECK (content_sha256 ~ '^[a-f0-9]{64}$'),
  provider_public_url text NOT NULL CHECK (provider_public_url ~ '^https://'),
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (attempt_id,ordinal),
  UNIQUE (attempt_id,source_asset_id),
  CHECK (expires_at > created_at)
);

CREATE TABLE social_publish_reconciliations (
  id text PRIMARY KEY,
  unknown_result_id text NOT NULL REFERENCES social_publish_results(id) ON DELETE RESTRICT,
  attempt_id text NOT NULL REFERENCES social_publish_attempts(id) ON DELETE RESTRICT,
  idempotency_key text NOT NULL,
  content_id text NOT NULL,
  draft_id text NOT NULL,
  draft_version integer NOT NULL CHECK (draft_version >= 1),
  schedule_id text NOT NULL,
  schedule_revision integer NOT NULL CHECK (schedule_revision >= 0),
  publishing_account_id text NOT NULL,
  channel text NOT NULL CHECK (channel IN ('facebook','instagram')),
  status text NOT NULL CHECK (status IN ('publicationFound','confirmedAbsent','inconclusive','publicationFailed')),
  provider_publication_ref text,
  published_at timestamptz,
  failure_type text CHECK (failure_type IN ('retryable','permanent')),
  reason_code text,
  message text,
  checked_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (reason_code IS NULL OR char_length(btrim(reason_code)) > 0),
  CHECK (message IS NULL OR char_length(btrim(message)) > 0),
  CHECK (CASE status
    WHEN 'publicationFound' THEN provider_publication_ref IS NOT NULL AND published_at IS NOT NULL AND failure_type IS NULL AND reason_code IS NULL
    WHEN 'confirmedAbsent' THEN provider_publication_ref IS NULL AND published_at IS NULL AND failure_type IS NULL AND reason_code IS NULL
    WHEN 'inconclusive' THEN provider_publication_ref IS NULL AND published_at IS NULL AND failure_type IS NULL AND reason_code IS NOT NULL
    WHEN 'publicationFailed' THEN provider_publication_ref IS NULL AND published_at IS NULL AND failure_type IS NOT NULL AND reason_code IS NOT NULL
    ELSE false END)
);
CREATE INDEX social_publish_reconciliations_attempt_idx ON social_publish_reconciliations(attempt_id,checked_at);
CREATE UNIQUE INDEX social_publish_reconciliations_terminal_idx ON social_publish_reconciliations(attempt_id)
  WHERE status IN ('publicationFound','confirmedAbsent','publicationFailed');

CREATE TABLE social_provider_webhook_events (
  provider text NOT NULL,
  event_id text NOT NULL,
  event_type text NOT NULL,
  payload_hash text NOT NULL CHECK (payload_hash ~ '^[a-f0-9]{64}$'),
  payload jsonb NOT NULL CHECK (jsonb_typeof(payload)='object'),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processing','processed','ignored','failed')),
  processing_attempts integer NOT NULL DEFAULT 0 CHECK (processing_attempts >= 0),
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  lease_token uuid,
  lease_until timestamptz,
  received_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  last_error_code text,
  PRIMARY KEY (provider,event_id),
  CHECK ((status='processing') = (lease_token IS NOT NULL AND lease_until IS NOT NULL)),
  CHECK (last_error_code IS NULL OR char_length(btrim(last_error_code)) > 0)
);
CREATE INDEX social_provider_webhook_events_pending_idx ON social_provider_webhook_events(next_attempt_at,received_at)
  WHERE status IN ('pending','processing');
