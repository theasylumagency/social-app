-- Historical snapshots retain unknown metric semantics; never invent a definition in a backfill.
ALTER TABLE social_post_analytics ADD COLUMN metric_contract text NOT NULL DEFAULT 'legacy-unspecified'
  CHECK (char_length(btrim(metric_contract)) BETWEEN 1 AND 160);
ALTER TABLE social_publish_results ADD COLUMN evidence_recorded_at timestamptz NOT NULL DEFAULT now();
CREATE INDEX social_publish_results_published_idx ON social_publish_results(published_at,attempt_id)
  WHERE status='published';
CREATE INDEX social_publish_reconciliations_found_idx ON social_publish_reconciliations(published_at,attempt_id)
  WHERE status='publicationFound';
