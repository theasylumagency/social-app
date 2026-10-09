CREATE TABLE post_revisions (
 id uuid PRIMARY KEY,
 note_id uuid NOT NULL UNIQUE REFERENCES contextual_notes(id) ON DELETE CASCADE,
 owner_user_id text NOT NULL REFERENCES auth_user(id) ON DELETE CASCADE,
 brand_id text NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
 run_id uuid NOT NULL REFERENCES weekly_planning_runs(id) ON DELETE CASCADE,
 post_key text NOT NULL CHECK(post_key ~ '^p([1-9]|10)$'),
 channel text NOT NULL CHECK(channel IN ('facebook','instagram')),
 stable_post_id text NOT NULL,
 version integer NOT NULL CHECK(version>1),
 parent_revision_id uuid REFERENCES post_revisions(id),
 base_approval_id uuid NOT NULL,
 base_digest text NOT NULL,
 status text NOT NULL DEFAULT 'queued' CHECK(status IN ('queued','running','ready','needsChanges','approved','discarded','failed')),
 run_snapshot jsonb NOT NULL,
 before_payload jsonb NOT NULL,
 payload jsonb NOT NULL,
 approval_evidence jsonb,
 approved_at timestamptz,
 approved_by_user_id text REFERENCES auth_user(id),
 lease_token uuid,
 lease_until timestamptz,
 attempts integer NOT NULL DEFAULT 0,
 retry_count integer NOT NULL DEFAULT 0,
 retry_window_started_at timestamptz,
 error text,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(stable_post_id,channel,version)
);
CREATE INDEX post_revisions_pending ON post_revisions(updated_at,id) WHERE status IN ('queued','running');
CREATE INDEX post_revisions_run ON post_revisions(run_id,created_at DESC,id);
CREATE TABLE post_revision_model_runs (
 id uuid PRIMARY KEY,
 revision_id uuid NOT NULL REFERENCES post_revisions(id) ON DELETE CASCADE,
 payload jsonb NOT NULL
);
