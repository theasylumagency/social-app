import { randomUUID } from "node:crypto"
import type { Pool, PoolClient } from "pg"
import { VisualError, type VisualPolicy } from "../../application/visuals/policy"
import type { VisualBalance, VisualCreditReason } from "../../application/visuals/types"
import type { WorkspaceAccess } from "./workspace-store"

export async function lockVisualWorkspace(c: PoolClient, access: WorkspaceAccess) {
  const row = await c.query("SELECT id FROM workspaces WHERE id=$1 AND owner_user_id=$2 FOR UPDATE", [access.workspaceId, access.userId])
  if (!row.rowCount) throw new VisualError("not_found", "სამუშაო სივრცე ვერ მოიძებნა.", 404)
}
export async function seedDemoCreditsIfNeeded(c: Pool | PoolClient, access: WorkspaceAccess, policy: VisualPolicy) {
  if (!policy.seedCredits || !policy.enabled) return
  await c.query(`INSERT INTO visual_credit_ledger(id,workspace_id,delta,reason,grant_key)
    SELECT $1,id,$3,'demo_seed','demo_seed:v1' FROM workspaces WHERE id=$2 AND owner_user_id=$4
    ON CONFLICT DO NOTHING`, [randomUUID(), access.workspaceId, policy.seedCredits, access.userId])
}
export async function getVisualCreditBalance(c: Pool | PoolClient, access: WorkspaceAccess): Promise<VisualBalance> {
  const r = await c.query<{ remaining: number; reserved: number }>(`SELECT
    (SELECT coalesce(sum(delta),0)::int FROM visual_credit_ledger WHERE workspace_id=w.id) remaining,
    (SELECT count(*)::int FROM visual_generations WHERE workspace_id=w.id AND status='pending') reserved
    FROM workspaces w WHERE w.id=$1 AND w.owner_user_id=$2`, [access.workspaceId, access.userId])
  if (!r.rows[0]) throw new VisualError("not_found", "სამუშაო სივრცე ვერ მოიძებნა.", 404)
  return { remainingCredits: r.rows[0].remaining, reservedCredits: r.rows[0].reserved, availableCredits: r.rows[0].remaining - r.rows[0].reserved }
}

/** Server-only billing/admin entrypoint; grantKey is the stable purchase or allowance-period ID. */
export async function addVisualCredits(pool: Pool, access: WorkspaceAccess, input: { delta: number; reason: Exclude<VisualCreditReason, "generation_success" | "demo_seed">; grantKey: string; note?: string }) {
  if (!Number.isSafeInteger(input.delta) || !input.delta || Math.abs(input.delta) > 1_000_000 || !input.grantKey || (input.reason !== "manual_adjustment" && input.delta < 0)) throw Error("Invalid visual credit grant")
  const c = await pool.connect()
  try {
    await c.query("BEGIN"); await lockVisualWorkspace(c, access)
    const prior = await c.query("SELECT delta,reason FROM visual_credit_ledger WHERE workspace_id=$1 AND grant_key=$2", [access.workspaceId, input.grantKey])
    if (prior.rows[0]) {
      if (prior.rows[0].delta !== input.delta || prior.rows[0].reason !== input.reason) throw Error("Credit grant key already used")
    } else {
      if ((await getVisualCreditBalance(c, access)).availableCredits + input.delta < 0) throw Error("Credit adjustment exceeds available balance")
      await c.query("INSERT INTO visual_credit_ledger(id,workspace_id,delta,reason,grant_key,note) VALUES($1,$2,$3,$4,$5,$6)", [randomUUID(), access.workspaceId, input.delta, input.reason, input.grantKey, input.note ?? null])
    }
    await c.query("COMMIT")
  } catch (e) { await c.query("ROLLBACK"); throw e } finally { c.release() }
}
