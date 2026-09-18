ALTER TABLE contextual_voice_requests ADD COLUMN voice_session_id uuid;
CREATE UNIQUE INDEX contextual_voice_session_owner_unique ON contextual_voice_requests(owner_user_id,voice_session_id) WHERE voice_session_id IS NOT NULL;
