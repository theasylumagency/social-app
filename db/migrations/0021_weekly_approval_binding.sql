ALTER TABLE weekly_post_batches ADD COLUMN approval_evidence jsonb;
-- PostgreSQL can shorten automatically generated constraint names. Match the
-- logical key rather than depending on its generated spelling.
DO $$
DECLARE old_key text;
BEGIN
  SELECT c.conname INTO STRICT old_key FROM pg_constraint c
  WHERE c.conrelid='social_publication_inputs'::regclass AND c.contype='u'
    AND c.conkey=ARRAY[
      (SELECT attnum FROM pg_attribute WHERE attrelid=c.conrelid AND attname='source_weekly_run_id'),
      (SELECT attnum FROM pg_attribute WHERE attrelid=c.conrelid AND attname='post_key'),
      (SELECT attnum FROM pg_attribute WHERE attrelid=c.conrelid AND attname='channel')
    ];
  EXECUTE format('ALTER TABLE social_publication_inputs DROP CONSTRAINT %I', old_key);
END $$;
ALTER TABLE social_publication_inputs ADD COLUMN superseded_by_input_id text REFERENCES social_publication_inputs(id), ADD COLUMN superseded_at timestamptz;
ALTER TABLE social_publication_inputs ADD CONSTRAINT social_publication_supersession_check CHECK (
  (superseded_by_input_id IS NULL) = (superseded_at IS NULL) AND superseded_by_input_id IS DISTINCT FROM id
);
CREATE INDEX social_publication_inputs_lineage ON social_publication_inputs(source_weekly_run_id,post_key,channel,created_at DESC);
