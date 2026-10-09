-- UTC remains the dispatch authority; keep the user's explicit wall time and zone for audit.
ALTER TABLE social_content_schedules ADD COLUMN time_context jsonb
  CHECK (time_context IS NULL OR jsonb_typeof(time_context)='object');
ALTER TABLE social_content_schedule_events ADD COLUMN time_context jsonb
  CHECK (time_context IS NULL OR jsonb_typeof(time_context)='object');
