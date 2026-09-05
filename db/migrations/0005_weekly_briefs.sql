-- User-authored weekly direction, kept separate from Brand Knowledge and generated plans.
CREATE TABLE weekly_briefs (
  brand_id text NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  week_start date NOT NULL CHECK (extract(isodow FROM week_start) = 1),
  objective text NOT NULL CHECK (char_length(btrim(objective)) BETWEEN 1 AND 1200),
  updated_by text NOT NULL REFERENCES auth_user(id) ON DELETE RESTRICT,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (brand_id, week_start)
);
