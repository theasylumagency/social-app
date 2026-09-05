import type { Pool } from "pg"
import type { DashboardBrand, DashboardSource, WeeklyBrief } from "../../application/dashboard/model"
import { safeSourceUrl } from "../../application/dashboard/model"

export async function listDashboardBrands(pool: Pool, userId: string): Promise<DashboardBrand[]> {
  const result = await pool.query<{
    id: string; created_at: Date; knowledge: Record<string, unknown> | null; ready: boolean | null
  }>(`
    SELECT b.id, b.created_at, s.content #> '{data,knowledge}' AS knowledge,
      (r.minimum_viable_brand->>'satisfied')::boolean AS ready
    FROM brands b JOIN workspaces w ON w.id = b.workspace_id
    LEFT JOIN LATERAL (
      SELECT snapshot_id, minimum_viable_brand FROM ingestion_runs
      WHERE brand_id = b.id ORDER BY completed_at DESC, id DESC LIMIT 1
    ) r ON true
    LEFT JOIN source_snapshots s ON s.id = r.snapshot_id AND s.brand_id = b.id
    WHERE w.owner_user_id = $1 ORDER BY b.created_at, b.id
  `, [userId])
  return result.rows.map((row) => ({
    id: row.id, createdAt: row.created_at.toISOString(), ready: row.ready === true,
    name: typeof row.knowledge?.identityName === "string" ? row.knowledge.identityName : "ახალი ბრენდი",
    knowledge: row.knowledge ?? {},
  }))
}

export async function listDashboardSources(pool: Pool, userId: string, brandId: string): Promise<DashboardSource[]> {
  const result = await pool.query<{
    id: string; kind: string; reference: { url?: unknown }; captured_at: Date | null
  }>(`
    SELECT s.id, s.kind, s.reference, max(ss.captured_at) AS captured_at
    FROM sources s JOIN brands b ON b.id = s.brand_id
    JOIN workspaces w ON w.id = b.workspace_id
    LEFT JOIN source_snapshots ss ON ss.source_id = s.id AND ss.brand_id = b.id
    WHERE w.owner_user_id = $1 AND b.id = $2
    GROUP BY s.id ORDER BY s.created_at, s.id
  `, [userId, brandId])
  return result.rows.map((row) => ({
    id: row.id, kind: row.kind, url: safeSourceUrl(row.reference.url), capturedAt: row.captured_at?.toISOString() ?? null,
  }))
}

export async function readWeeklyBrief(pool: Pool, userId: string, brandId: string, week: string): Promise<WeeklyBrief> {
  const result = await pool.query<{ objective: string; updated_at: Date }>(`
    SELECT wb.objective, wb.updated_at FROM weekly_briefs wb
    JOIN brands b ON b.id = wb.brand_id JOIN workspaces w ON w.id = b.workspace_id
    WHERE w.owner_user_id = $1 AND b.id = $2 AND wb.week_start = $3::date
  `, [userId, brandId, week])
  const row = result.rows[0]
  return row ? { objective: row.objective, updatedAt: row.updated_at.toISOString() } : null
}

export async function saveWeeklyBrief(pool: Pool, userId: string, brandId: string, week: string, objective: string): Promise<boolean> {
  const result = await pool.query(`
    INSERT INTO weekly_briefs (brand_id, week_start, objective, updated_by)
    SELECT b.id, $3::date, $4, $1 FROM brands b
    JOIN workspaces w ON w.id = b.workspace_id
    WHERE b.id = $2 AND w.owner_user_id = $1
    ON CONFLICT (brand_id, week_start) DO UPDATE
    SET objective = EXCLUDED.objective, updated_by = EXCLUDED.updated_by, updated_at = now()
    RETURNING brand_id
  `, [userId, brandId, week, objective])
  return result.rowCount === 1
}
