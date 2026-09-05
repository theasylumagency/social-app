import { randomUUID } from "node:crypto"
import type { Pool, PoolClient } from "pg"

export type WorkspaceAccess = { readonly workspaceId: string; readonly userId: string }

export async function ensurePersonalWorkspace(pool: Pool, userId: string): Promise<WorkspaceAccess> {
  const result = await pool.query<{ id: string }>(`
    INSERT INTO workspaces(id, owner_user_id) VALUES ($1, $2)
    ON CONFLICT (owner_user_id) DO UPDATE SET owner_user_id = EXCLUDED.owner_user_id
    RETURNING id
  `, [`workspace:${randomUUID()}`, userId])
  const workspace = result.rows[0]
  if (!workspace) throw new Error("Could not resolve workspace")
  return { workspaceId: workspace.id, userId }
}

export async function assertWorkspaceAccess(client: PoolClient, access: WorkspaceAccess): Promise<void> {
  const result = await client.query("SELECT id FROM workspaces WHERE id = $1 AND owner_user_id = $2", [access.workspaceId, access.userId])
  if (result.rowCount !== 1) throw new Error("Workspace access denied")
}
