CREATE TABLE contextual_notes (
  id uuid PRIMARY KEY,
  owner_user_id text NOT NULL REFERENCES auth_user(id) ON DELETE CASCADE,
  brand_id text NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  context jsonb NOT NULL,
  raw_text text NOT NULL CHECK (char_length(raw_text) BETWEEN 1 AND 8000),
  input_source text NOT NULL CHECK (input_source IN ('text','voice')),
  status text NOT NULL CHECK (status IN ('processing','answered','clarification','proposed','applied','dismissed','reverted','failed')),
  message text NOT NULL DEFAULT '',
  interpretation jsonb,
  decision jsonb,
  snapshot jsonb,
  result jsonb,
  confirmed_at timestamptz,
  reverted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX contextual_notes_history ON contextual_notes(owner_user_id,brand_id,created_at DESC);
CREATE TABLE contextual_note_model_runs (
  id uuid PRIMARY KEY,
  note_id uuid NOT NULL REFERENCES contextual_notes(id) ON DELETE CASCADE,
  payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE contextual_voice_requests (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  owner_user_id text NOT NULL REFERENCES auth_user(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX contextual_voice_budget ON contextual_voice_requests(owner_user_id,created_at DESC);
