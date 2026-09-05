CREATE TABLE workspaces (
  id text PRIMARY KEY,
  owner_user_id text NOT NULL UNIQUE REFERENCES auth_user(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Existing development brands have no known owner. Preserve them without
-- automatically exposing them to the first registered account.
ALTER TABLE brands ADD COLUMN workspace_id text REFERENCES workspaces(id) ON DELETE RESTRICT;
CREATE INDEX brands_workspace_id_idx ON brands(workspace_id);
