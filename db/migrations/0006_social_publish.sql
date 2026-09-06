-- Durable publication attempts.
--
-- One publication intent may have multiple numbered attempts.
-- The pair (idempotency_key, attempt_number) is the atomic worker claim.
CREATE TABLE social_publish_attempts (
  id text PRIMARY KEY,

  idempotency_key text NOT NULL
    CHECK (char_length(btrim(idempotency_key)) > 0),

  attempt_number integer NOT NULL
    CHECK (attempt_number >= 1),

  content_id text NOT NULL,
  draft_id text NOT NULL,

  draft_version integer NOT NULL
    CHECK (draft_version >= 1),

  schedule_id text NOT NULL,

  schedule_revision integer NOT NULL
    CHECK (schedule_revision >= 0),

  publishing_account_id text NOT NULL,

  channel text NOT NULL
    CHECK (channel IN ('facebook', 'instagram')),

  publish_at timestamptz NOT NULL,
  attempted_at timestamptz NOT NULL,

  CHECK (attempted_at >= publish_at),

  UNIQUE (idempotency_key, attempt_number)
);

CREATE INDEX social_publish_attempts_schedule_idx
  ON social_publish_attempts(schedule_id);

CREATE INDEX social_publish_attempts_content_idx
  ON social_publish_attempts(content_id);

CREATE INDEX social_publish_attempts_attempted_at_idx
  ON social_publish_attempts(attempted_at);


-- Canonical result for one immutable publication attempt.
--
-- Publication lineage is intentionally NOT duplicated here.
-- It is reconstructed from social_publish_attempts through attempt_id,
-- preventing attempt/result lineage from diverging in storage.
CREATE TABLE social_publish_results (
  id text PRIMARY KEY,

  attempt_id text NOT NULL UNIQUE
    REFERENCES social_publish_attempts(id)
    ON DELETE RESTRICT,

  recorded_at timestamptz NOT NULL,

  status text NOT NULL
    CHECK (
      status IN (
        'published',
        'retryableFailure',
        'permanentFailure',
        'unknownOutcome'
      )
    ),

  provider_publication_ref text,

  published_at timestamptz,

  error_code text,

  message text,

  retry_after timestamptz,

  CHECK (
    provider_publication_ref IS NULL
    OR char_length(btrim(provider_publication_ref)) > 0
  ),

  CHECK (
    error_code IS NULL
    OR char_length(btrim(error_code)) > 0
  ),

  CHECK (
    message IS NULL
    OR char_length(btrim(message)) > 0
  ),

  CHECK (
    retry_after IS NULL
    OR retry_after > recorded_at
  ),

  CHECK (
    CASE status

      WHEN 'published' THEN
        provider_publication_ref IS NOT NULL
        AND published_at IS NOT NULL
        AND error_code IS NULL
        AND message IS NULL
        AND retry_after IS NULL
        AND published_at <= recorded_at

      WHEN 'retryableFailure' THEN
        provider_publication_ref IS NULL
        AND published_at IS NULL
        AND error_code IS NOT NULL

      WHEN 'permanentFailure' THEN
        provider_publication_ref IS NULL
        AND published_at IS NULL
        AND error_code IS NOT NULL
        AND retry_after IS NULL

      WHEN 'unknownOutcome' THEN
        provider_publication_ref IS NULL
        AND published_at IS NULL
        AND error_code IS NOT NULL
        AND retry_after IS NULL

      ELSE false
    END
  )
);