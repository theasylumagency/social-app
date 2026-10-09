import type { Pool } from "pg"

export type PlanningStatus = { revision: string; working: boolean }

/** No copy, source payload or media bytes enter the polling response. */
export async function readPlanningStatus(pool: Pool, ownerId: string, brandId: string, week: string): Promise<PlanningStatus | null> {
  const result = await pool.query<PlanningStatus>(`
    WITH access AS (
      SELECT b.id FROM brands b JOIN workspaces w ON w.id=b.workspace_id
      WHERE b.id=$2 AND w.owner_user_id=$1
    ), recent_runs AS (
      SELECT r.id,r.version,r.status,r.step,r.updated_at,r.lease_until
      FROM weekly_planning_runs r JOIN access a ON a.id=r.brand_id
      WHERE r.owner_user_id=$1 AND r.week_start=$3::date
      ORDER BY r.version DESC LIMIT 20
    ), runs AS (
      SELECT * FROM recent_runs
      UNION
      SELECT r.id,r.version,r.status,r.step,r.updated_at,r.lease_until
      FROM weekly_planning_runs r JOIN access a ON a.id=r.brand_id
      WHERE r.owner_user_id=$1 AND r.week_start=$3::date AND r.status='approved'
    ), latest AS (
      SELECT * FROM runs WHERE status NOT IN ('superseded','changesRequested') ORDER BY version DESC LIMIT 1
    ), batches AS (
      SELECT p.run_id,p.status,p.step,p.updated_at,p.approved_at,p.lease_until
      FROM weekly_post_batches p JOIN runs r ON r.id=p.run_id
    ), assets AS (
      SELECT a.id,a.run_id,a.post_key,a.slot,a.created_at
      FROM weekly_post_assets a JOIN runs r ON r.id=a.run_id
    ), foundation AS (
      SELECT d.id,d.session_id,d.revision,d.confirmed_at
      FROM brand_dossiers d JOIN access a ON a.id=d.brand_id ORDER BY d.id DESC LIMIT 1
    ), strategies AS (
      SELECT s.id,s.revision,s.status,s.updated_at FROM social_strategies s JOIN access a ON a.id=s.brand_id
      WHERE s.owner_user_id=$1 ORDER BY s.revision DESC LIMIT 20
    )
    SELECT md5(jsonb_build_object('owner',$1::text,'brand',$2::text,'week',$3::text,
      'runs',(SELECT jsonb_agg(to_jsonb(r) ORDER BY r.version) FROM runs r),
      'batches',(SELECT jsonb_agg(to_jsonb(b) ORDER BY b.run_id) FROM batches b),
      'assets',(SELECT jsonb_agg(to_jsonb(a) ORDER BY a.id) FROM assets a),
      'foundation',(SELECT to_jsonb(f) FROM foundation f),
      'strategies',(SELECT jsonb_agg(to_jsonb(s) ORDER BY s.revision) FROM strategies s),
      'publicFacts',(SELECT jsonb_agg(jsonb_build_object('id',f.id,'revision',f.revision,'current',(f.entry->'fact'->>'validUntil')::timestamptz>now()) ORDER BY f.id) FROM brand_public_facts f JOIN access a ON a.id=f.brand_id))::text) AS revision,
      (EXISTS(SELECT 1 FROM latest WHERE status IN ('queued','running')) OR
       EXISTS(SELECT 1 FROM batches b JOIN latest r ON r.id=b.run_id WHERE b.status IN ('queued','running'))) AS working
    FROM access`, [ownerId, brandId, week])
  return result.rows[0] ?? null
}
