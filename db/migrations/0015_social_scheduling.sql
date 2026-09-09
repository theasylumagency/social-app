ALTER TABLE weekly_post_batches
  ADD COLUMN approved_by_user_id text REFERENCES auth_user(id) ON DELETE RESTRICT;

ALTER TABLE weekly_post_assets DROP CONSTRAINT weekly_post_assets_post_key_check;
ALTER TABLE weekly_post_assets ADD CONSTRAINT weekly_post_assets_post_key_check CHECK (post_key ~ '^p([1-9]|10)$');

CREATE TABLE social_publication_inputs (
  id text PRIMARY KEY,
  brand_id text NOT NULL REFERENCES brands(id) ON DELETE RESTRICT,
  source_weekly_run_id uuid NOT NULL REFERENCES weekly_post_batches(run_id) ON DELETE RESTRICT,
  post_key text NOT NULL CHECK (post_key ~ '^p([1-9]|10)$'),
  channel text NOT NULL CHECK (channel IN ('facebook','instagram')),
  content_id text NOT NULL,
  content_brief_id text NOT NULL,
  content_execution_spec_id text NOT NULL,
  draft_id text NOT NULL,
  draft_version integer NOT NULL CHECK (draft_version >= 1),
  bundle_schema text NOT NULL CHECK (bundle_schema='unda.social-publication-input'),
  bundle_version integer NOT NULL CHECK (bundle_version >= 1),
  bundle jsonb NOT NULL CHECK (jsonb_typeof(bundle)='object'),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source_weekly_run_id,post_key,channel),
  UNIQUE (id,channel)
);

CREATE TABLE social_publication_input_assets (
  publication_input_id text NOT NULL REFERENCES social_publication_inputs(id) ON DELETE RESTRICT,
  ordinal integer NOT NULL CHECK (ordinal >= 0),
  weekly_post_asset_id uuid NOT NULL REFERENCES weekly_post_assets(id) ON DELETE RESTRICT,
  media_type text NOT NULL CHECK (media_type IN ('image/jpeg','image/png','image/webp','video/mp4')),
  alt_text text,
  PRIMARY KEY (publication_input_id,ordinal),
  UNIQUE (publication_input_id,weekly_post_asset_id),
  CHECK (alt_text IS NULL OR char_length(btrim(alt_text)) > 0)
);

CREATE TABLE social_content_schedules (
  id text PRIMARY KEY,
  brand_id text NOT NULL REFERENCES brands(id) ON DELETE RESTRICT,
  publication_input_id text NOT NULL,
  publishing_account_id text NOT NULL,
  content_id text NOT NULL,
  draft_id text NOT NULL,
  draft_version integer NOT NULL CHECK (draft_version >= 1),
  content_execution_spec_id text NOT NULL,
  channel text NOT NULL CHECK (channel IN ('facebook','instagram')),
  "authorization" jsonb NOT NULL CHECK (jsonb_typeof("authorization")='object'),
  publish_at timestamptz NOT NULL,
  scheduled_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (publication_input_id,publishing_account_id),
  UNIQUE (id,channel),
  FOREIGN KEY (publication_input_id,channel) REFERENCES social_publication_inputs(id,channel) ON DELETE RESTRICT,
  FOREIGN KEY (publishing_account_id,channel) REFERENCES social_publishing_accounts(id,channel) ON DELETE RESTRICT,
  CHECK (publish_at > scheduled_at)
);
CREATE INDEX social_content_schedules_due_idx ON social_content_schedules(publish_at,id);

CREATE TABLE social_content_schedule_events (
  id text PRIMARY KEY,
  schedule_id text NOT NULL REFERENCES social_content_schedules(id) ON DELETE RESTRICT,
  revision integer NOT NULL CHECK (revision >= 1),
  event_type text NOT NULL CHECK (event_type IN ('rescheduled','cancelled')),
  publish_at timestamptz,
  actor_user_id text NOT NULL REFERENCES auth_user(id) ON DELETE RESTRICT,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  reason text,
  UNIQUE (schedule_id,revision),
  CHECK ((event_type='rescheduled' AND publish_at IS NOT NULL AND publish_at > occurred_at)
    OR (event_type='cancelled' AND publish_at IS NULL)),
  CHECK (reason IS NULL OR char_length(btrim(reason)) > 0)
);
CREATE INDEX social_content_schedule_events_schedule_idx ON social_content_schedule_events(schedule_id,revision);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM social_publish_attempts a LEFT JOIN social_content_schedules s
    ON s.id=a.schedule_id AND s.channel=a.channel WHERE s.id IS NULL) THEN
    RAISE EXCEPTION 'Cannot add social scheduling foreign keys: orphan social_publish_attempts.schedule_id/channel rows exist';
  END IF;
  IF EXISTS (SELECT 1 FROM social_publish_attempts a LEFT JOIN social_publishing_accounts p
    ON p.id=a.publishing_account_id AND p.channel=a.channel WHERE p.id IS NULL) THEN
    RAISE EXCEPTION 'Cannot add social scheduling foreign keys: orphan social_publish_attempts.publishing_account_id/channel rows exist';
  END IF;
END $$;

ALTER TABLE social_publish_attempts ADD CONSTRAINT social_publish_attempts_schedule_channel_fk
  FOREIGN KEY (schedule_id,channel) REFERENCES social_content_schedules(id,channel) ON DELETE RESTRICT;
ALTER TABLE social_publish_attempts ADD CONSTRAINT social_publish_attempts_account_channel_fk
  FOREIGN KEY (publishing_account_id,channel) REFERENCES social_publishing_accounts(id,channel) ON DELETE RESTRICT;
