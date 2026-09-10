import { createHash, randomUUID } from "node:crypto"
import type { Pool, PoolClient } from "pg"
import type { PostsPayload } from "../../blueprints/social/weekly-planning/posts"
import { creditCostForSuccessfulGeneration, VISUAL_LEASE_SECONDS, VisualError, type VisualPolicy } from "../../application/visuals/policy"
import type { GeneratedVisual, VisualGeneration, VisualInput, VisualTarget } from "../../application/visuals/types"
import { getVisualCreditBalance, lockVisualWorkspace, seedDemoCreditsIfNeeded } from "./visual-credit-store"
import type { WorkspaceAccess } from "./workspace-store"

type Row = { id: string; workspace_id: string; brand_id: string | null; prompt: string; model: string; quality: VisualPolicy["quality"]; aspect_ratio: VisualInput["aspectRatio"]; request_kind: VisualInput["requestKind"]; target: VisualTarget | null; status: VisualGeneration["status"]; error_message: string | null; created_at: Date; completed_at: Date | null; width: number | null; height: number | null; request_fingerprint: string; lease_token: string | null }
const projection = (r: Row): VisualGeneration => ({ id: r.id, brandId: r.brand_id, prompt: r.prompt, model: r.model, requestKind: r.request_kind, target: r.target, status: r.status, error: r.error_message,
  imageUrl: r.status === "succeeded" ? `/api/visuals/assets?id=${r.id}` : null, width: r.width ?? null, height: r.height ?? null, createdAt: r.created_at.toISOString(), completedAt: r.completed_at?.toISOString() ?? null })

async function validateTarget(c: PoolClient, access: WorkspaceAccess, input: VisualInput) {
  if (input.brandId) {
    const brand = await c.query("SELECT id FROM brands WHERE id=$1 AND workspace_id=$2", [input.brandId, access.workspaceId])
    if (!brand.rowCount) throw new VisualError("not_found", "ბრენდი ვერ მოიძებნა.", 404)
  }
  if (!input.target) return input.brandId
  const t = input.target
  const found = await c.query<{ brand_id: string; payload: PostsPayload }>(`SELECT r.brand_id,p.payload FROM weekly_planning_runs r
    JOIN brands b ON b.id=r.brand_id JOIN weekly_post_batches p ON p.run_id=r.id
    WHERE r.id=$1 AND r.owner_user_id=$2 AND b.workspace_id=$3 AND r.status IN ('ready','approved')
    AND NOT EXISTS(SELECT 1 FROM weekly_planning_runs n WHERE n.brand_id=r.brand_id AND n.week_start=r.week_start AND n.version>r.version)`, [t.runId, access.userId, access.workspaceId])
  const row = found.rows[0]; const post = row?.payload.outline?.posts[Number(t.postKey.slice(1)) - 1]
  if (!row || !post || !["image", "carousel", "story"].includes(post.format) || t.slot >= post.visual.frames.length || (input.brandId && row.brand_id !== input.brandId)) throw new VisualError("invalid_target", "ამ პოსტისთვის გამოსახულების შექმნა ვერ მოხერხდა. განაახლეთ გვერდი.", 409)
  return row.brand_id
}

export async function createPendingVisualGeneration(pool: Pool, access: WorkspaceAccess, input: VisualInput, policy: VisualPolicy) {
  const fingerprint = createHash("sha256").update(JSON.stringify({ prompt: input.prompt, brandId: input.brandId, aspectRatio: input.aspectRatio, requestKind: input.requestKind, target: input.target })).digest("hex")
  const c = await pool.connect()
  try {
    await c.query("BEGIN"); await lockVisualWorkspace(c, access)
    const prior = await c.query<Row>("SELECT g.*,a.width,a.height FROM visual_generations g LEFT JOIN visual_assets a ON a.generation_id=g.id WHERE g.workspace_id=$1 AND g.request_id=$2", [access.workspaceId, input.requestId])
    if (prior.rows[0]) {
      if (prior.rows[0].request_fingerprint !== fingerprint) throw new VisualError("idempotency_conflict", "ეს მოთხოვნა უკვე გამოყენებულია სხვა აღწერისთვის.", 409)
      await c.query("COMMIT"); return projection(prior.rows[0])
    }
    const brandId = await validateTarget(c, access, input)
    await seedDemoCreditsIfNeeded(c, access, policy)
    if ((await getVisualCreditBalance(c, access)).availableCredits < 1) throw new VisualError("no_credits", "თავისუფალი ვიზუალური კრედიტები ამოიწურა.", 402)
    const row = await c.query<Row>(`INSERT INTO visual_generations(id,workspace_id,brand_id,request_id,request_fingerprint,prompt,model,quality,aspect_ratio,request_kind,target,status)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'pending') RETURNING *`,
    [randomUUID(), access.workspaceId, brandId, input.requestId, fingerprint, input.prompt, policy.model, policy.quality, input.aspectRatio, input.requestKind, input.target ? JSON.stringify(input.target) : null])
    await c.query("COMMIT"); return projection(row.rows[0]!)
  } catch (e) { await c.query("ROLLBACK"); throw e } finally { c.release() }
}

export async function listVisualGenerationsForWorkspace(pool: Pool, access: WorkspaceAccess, filter: { id?: string; runId?: string } = {}) {
  const r = await pool.query<Row>(`SELECT g.*,a.width,a.height FROM visual_generations g
    JOIN workspaces w ON w.id=g.workspace_id LEFT JOIN visual_assets a ON a.generation_id=g.id
    WHERE w.id=$1 AND w.owner_user_id=$2 AND ($3::uuid IS NULL OR g.id=$3)
      AND ($4::text IS NULL OR g.target->>'runId'=$4) ORDER BY g.created_at DESC LIMIT 50`, [access.workspaceId, access.userId, filter.id ?? null, filter.runId ?? null])
  return r.rows.map(projection)
}
export async function readVisualAsset(pool: Pool, access: WorkspaceAccess, id: string) {
  const r = await pool.query<{ content: Buffer; width: number; height: number }>(`SELECT a.* FROM visual_assets a JOIN visual_generations g ON g.id=a.generation_id
    JOIN workspaces w ON w.id=g.workspace_id WHERE g.id=$1 AND w.id=$2 AND w.owner_user_id=$3 AND g.status='succeeded'`, [id, access.workspaceId, access.userId])
  return r.rows[0] ?? null
}

export async function claimVisualGeneration(pool: Pool, id: string) {
  const r = await pool.query<Row & { owner_user_id: string }>(`UPDATE visual_generations g SET started_at=now(),lease_token=$2,
    lease_until=now()+($3 * interval '1 second') FROM workspaces w
    WHERE g.id=$1 AND g.workspace_id=w.id AND g.status='pending' AND g.started_at IS NULL
    RETURNING g.*,w.owner_user_id`, [id, randomUUID(), VISUAL_LEASE_SECONDS])
  const row = r.rows[0]
  return row ? { id: row.id, access: { workspaceId: row.workspace_id, userId: row.owner_user_id }, token: row.lease_token!, prompt: row.prompt, model: row.model, quality: row.quality, aspectRatio: row.aspect_ratio } : null
}

export async function markVisualGenerationFailed(pool: Pool, id: string, token: string, message: string) {
  await pool.query("UPDATE visual_generations SET status='failed',error_message=$3,completed_at=now(),lease_token=NULL,lease_until=NULL WHERE id=$1 AND lease_token=$2 AND status='pending'", [id, token, message])
}

/** Bytes, success and the debit commit together. A repeated completion cannot double charge. */
export async function markVisualGenerationSucceeded(pool: Pool, access: WorkspaceAccess, id: string, token: string, image: GeneratedVisual) {
  const c = await pool.connect()
  try {
    await c.query("BEGIN"); await lockVisualWorkspace(c, access)
    const row = await c.query("SELECT id FROM visual_generations WHERE id=$1 AND workspace_id=$2 AND lease_token=$3 AND status='pending' FOR UPDATE", [id, access.workspaceId, token])
    if (!row.rowCount) { await c.query("COMMIT"); return false }
    await c.query("INSERT INTO visual_assets(generation_id,content,width,height) VALUES($1,$2,$3,$4)", [id, image.content, image.width, image.height])
    await c.query(`UPDATE visual_generations SET status='succeeded',completed_at=now(),lease_token=NULL,lease_until=NULL,
      provider_request_id=$2,provider_asset_id=$3,provider_cost_usd=$4,metadata=$5 WHERE id=$1`, [id, image.providerRequestId, image.providerAssetId, image.providerCostUsd, JSON.stringify(image.metadata)])
    await c.query("INSERT INTO visual_credit_ledger(id,workspace_id,delta,reason,generation_id) VALUES($1,$2,$3,'generation_success',$4)", [randomUUID(), access.workspaceId, -creditCostForSuccessfulGeneration(), id])
    await c.query("COMMIT"); return true
  } catch (e) { await c.query("ROLLBACK"); throw e } finally { c.release() }
}

export async function expireVisualGenerations(pool: Pool) {
  // Never replay an ambiguous paid provider request after a process interruption.
  await pool.query(`UPDATE visual_generations SET status='failed',completed_at=now(),lease_token=NULL,lease_until=NULL,
    error_message='გენერაცია შეწყდა. კრედიტი არ ჩამოჭრილა; ახალი ცდის დაწყება შეგიძლიათ.'
    WHERE status='pending' AND (lease_until<now() OR (started_at IS NULL AND created_at<now()-interval '30 minutes'))`)
}
