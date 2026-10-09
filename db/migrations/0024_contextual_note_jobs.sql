ALTER TABLE contextual_notes DROP CONSTRAINT contextual_notes_status_check;
ALTER TABLE contextual_notes ADD CONSTRAINT contextual_notes_status_check CHECK(status IN ('queued','processing','answered','clarification','proposed','applied','dismissed','reverted','failed'));
ALTER TABLE contextual_notes ADD COLUMN job_kind text NOT NULL DEFAULT 'interpret' CHECK(job_kind IN ('interpret','apply'));
ALTER TABLE contextual_notes ADD COLUMN job_state text NOT NULL DEFAULT 'idle' CHECK(job_state IN ('queued','running','idle'));
ALTER TABLE contextual_notes ADD COLUMN lease_token uuid;
ALTER TABLE contextual_notes ADD COLUMN lease_until timestamptz;
ALTER TABLE contextual_notes ADD COLUMN attempts integer NOT NULL DEFAULT 0 CHECK(attempts>=0);
-- In-flight legacy HTTP work cannot finish after the coordinated worker/API upgrade.
UPDATE contextual_notes SET status='queued',job_state='queued',message='' WHERE status='processing';
CREATE INDEX contextual_notes_pending ON contextual_notes(updated_at,id) WHERE job_state IN ('queued','running');

ALTER TABLE contextual_notes ADD COLUMN retry_count integer NOT NULL DEFAULT 0;
ALTER TABLE contextual_notes ADD COLUMN retry_window_started_at timestamptz;
