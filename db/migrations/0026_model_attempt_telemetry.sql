-- Old receipts deliberately remain NULL: retry identity and request context cannot be reconstructed.
ALTER TABLE brand_discovery_model_runs ADD COLUMN telemetry jsonb;
ALTER TABLE weekly_planning_model_runs ADD COLUMN telemetry jsonb;
