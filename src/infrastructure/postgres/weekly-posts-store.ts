import { randomUUID } from "node:crypto"
import type { Pool } from "pg"
import { emptyPosts, type PostsBatch, type PostsPayload, type PostAsset } from "../../blueprints/social/weekly-planning/posts"

const access = "r.owner_user_id=$1 AND EXISTS(SELECT 1 FROM brands b JOIN workspaces w ON w.id=b.workspace_id WHERE b.id=r.brand_id AND w.owner_user_id=$1)"
type Row = { run_id: string; status: PostsBatch["status"]; step: PostsBatch["step"]; payload: PostsPayload; error: string | null; lease_until: Date | null; approved_at: Date | null; updated_at: Date }
const fromRow = (r: Row): PostsBatch => ({ runId: r.run_id, status: r.status, step: r.step, payload: r.payload, error: r.error, leaseUntil: r.lease_until?.toISOString() ?? null, approvedAt: r.approved_at?.toISOString() ?? null, updatedAt: r.updated_at.toISOString() })
export async function readWeeklyPosts(pool: Pool, ownerId: string, runId: string): Promise<PostsBatch | null> {
  const rows = await pool.query<Row>(`SELECT p.* FROM weekly_post_batches p JOIN weekly_planning_runs r ON r.id=p.run_id WHERE ${access} AND r.id=$2`, [ownerId, runId])
  return rows.rows[0] ? fromRow(rows.rows[0]) : null
}
export async function beginWeeklyPosts(pool: Pool, ownerId: string, runId: string, version: number, retry = false) {
  const c = await pool.connect()
  try {
    await c.query("BEGIN")
    const r = await c.query(`SELECT r.id FROM weekly_planning_runs r WHERE ${access} AND r.id=$2 AND r.version=$3 AND r.status IN ('ready','approved') AND NOT EXISTS(SELECT 1 FROM weekly_planning_runs n WHERE n.brand_id=r.brand_id AND n.week_start=r.week_start AND n.version>r.version) FOR UPDATE`, [ownerId, runId, version])
    if (!r.rowCount) throw Error("მხოლოდ მიმდინარე დასრულებული გეგმის პოსტების მომზადებაა შესაძლებელი.")
    await c.query("INSERT INTO weekly_post_batches(run_id,status,step,payload) VALUES($1,'queued','outline',$2::jsonb) ON CONFLICT(run_id) DO NOTHING", [runId, JSON.stringify(emptyPosts())])
    if (retry) {
      const attempts = await c.query<{ n: number }>("SELECT count(*)::int n FROM weekly_planning_events WHERE run_id=$1 AND kind='posts-retried' AND created_at>now()-interval '1 hour'", [runId])
      if (attempts.rows[0]!.n >= 5) throw Error("ხელახლა ცდის ლიმიტი ამოიწურა. ცოტა ხანში გააგრძელეთ.")
      const updated = await c.query("UPDATE weekly_post_batches SET status='queued',error=NULL,lease_token=NULL,lease_until=NULL,updated_at=now() WHERE run_id=$1 AND status='failed' RETURNING run_id", [runId])
      if (updated.rowCount) await c.query("INSERT INTO weekly_planning_events(run_id,kind,payload) VALUES($1,'posts-retried','{}')", [runId])
    }
    await c.query("COMMIT")
  } catch (e) { await c.query("ROLLBACK"); throw e } finally { c.release() }
}
export async function claimWeeklyPosts(pool: Pool, ownerId: string, runId: string) {
  const token = randomUUID()
  const rows = await pool.query<Row>(`UPDATE weekly_post_batches p SET status='running',lease_token=$3,lease_until=now()+interval '4 minutes',updated_at=now() FROM weekly_planning_runs r WHERE r.id=p.run_id AND ${access} AND r.id=$2 AND r.status IN ('ready','approved') AND EXISTS(SELECT 1 FROM auth_user u WHERE u.id=$1 AND u."emailVerified"=true) AND (p.status='queued' OR (p.status='running' AND p.lease_until<now())) RETURNING p.*`, [ownerId, runId, token])
  return rows.rows[0] ? { batch: fromRow(rows.rows[0]), token } : null
}
export async function saveWeeklyPosts(pool: Pool, runId: string, token: string, payload: PostsPayload, step: PostsBatch["step"]) {
  const r = await pool.query("UPDATE weekly_post_batches SET payload=$3::jsonb,step=$4,status=$5,lease_token=NULL,lease_until=NULL,error=NULL,updated_at=now() WHERE run_id=$1 AND lease_token=$2 RETURNING run_id", [runId, token, JSON.stringify(payload), step, step === "ready" ? "ready" : "queued"])
  return !!r.rowCount
}
export async function savePostCopy(pool: Pool, runId: string, token: string, key: string, copy: unknown) {
  const r = await pool.query("UPDATE weekly_post_batches SET payload=jsonb_set(payload,ARRAY['copies',$3],$4::jsonb),updated_at=now() WHERE run_id=$1 AND lease_token=$2 RETURNING run_id", [runId, token, key, JSON.stringify(copy)])
  return !!r.rowCount
}
export async function failWeeklyPosts(pool: Pool, runId: string, token: string) {
  await pool.query("UPDATE weekly_post_batches SET status='failed',error=$3,lease_token=NULL,lease_until=NULL,updated_at=now() WHERE run_id=$1 AND lease_token=$2", [runId, token, "პოსტების მომზადება დროებით შეწყდა. დასრულებული ტექსტები შენახულია; ხელახლა ცდა აქედან გაგრძელდება."])
}
export async function listPostAssets(pool: Pool, ownerId: string, runId: string): Promise<PostAsset[]> {
  const r = await pool.query<{ id: string; post_key: string; slot: number; width: number; height: number; name: string }>(`SELECT a.id,a.post_key,a.slot,a.width,a.height,a.name FROM weekly_post_assets a JOIN weekly_planning_runs r ON r.id=a.run_id WHERE ${access} AND r.id=$2 ORDER BY a.post_key,a.slot`, [ownerId, runId])
  return r.rows.map((a) => ({ id: a.id, postKey: a.post_key, slot: a.slot, width: a.width, height: a.height, name: a.name }))
}
export async function readPostAsset(pool: Pool, ownerId: string, id: string) {
  const r = await pool.query<{ content: Buffer }>(`SELECT a.content FROM weekly_post_assets a JOIN weekly_planning_runs r ON r.id=a.run_id WHERE ${access} AND a.id=$2`, [ownerId, id])
  return r.rows[0]?.content ?? null
}
export async function mutatePostAsset(pool: Pool, ownerId: string, runId: string, key: string, slot: number, upload: { content: Buffer; width: number; height: number; name: string } | null) {
  const c = await pool.connect()
  try {
    await c.query("BEGIN")
    await c.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`weekly-assets:${ownerId}`])
    const found = await c.query<{ payload: PostsPayload }>(`SELECT p.payload FROM weekly_post_batches p JOIN weekly_planning_runs r ON r.id=p.run_id WHERE ${access} AND r.id=$2 AND r.status IN ('ready','approved') AND NOT EXISTS(SELECT 1 FROM weekly_planning_runs n WHERE n.brand_id=r.brand_id AND n.week_start=r.week_start AND n.version>r.version) FOR UPDATE OF p,r`, [ownerId, runId])
    const post = found.rows[0]?.payload.outline?.posts[Number(key.slice(1)) - 1]
    if (!/^p[1-5]$/.test(key) || !post || !Number.isInteger(slot) || slot < 0 || slot >= post.visual.frames.length || !["image", "carousel", "story"].includes(post.format)) throw Error("ამ პოსტისთვის გამოსახულების ატვირთვა ვერ მოხერხდა. განაახლეთ გვერდი.")
    if (upload) {
      const bytes = await c.query<{ total: string }>("SELECT coalesce(sum(octet_length(a.content)),0)::text total FROM weekly_post_assets a JOIN weekly_planning_runs r ON r.id=a.run_id WHERE r.owner_user_id=$1 AND NOT(a.run_id=$2 AND a.post_key=$3 AND a.slot=$4)", [ownerId, runId, key, slot])
      if (Number(bytes.rows[0]!.total) + upload.content.length > 100 * 1024 * 1024) throw Error("გამოსახულებების საცავი შეივსო. ჯერ წაშალეთ გამოუყენებელი ფაილები.")
      await c.query("INSERT INTO weekly_post_assets(id,run_id,post_key,slot,name,width,height,content) VALUES($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT(run_id,post_key,slot) DO UPDATE SET id=excluded.id,name=excluded.name,width=excluded.width,height=excluded.height,content=excluded.content,created_at=now()", [randomUUID(), runId, key, slot, upload.name, upload.width, upload.height, upload.content])
    } else await c.query("DELETE FROM weekly_post_assets WHERE run_id=$1 AND post_key=$2 AND slot=$3", [runId, key, slot])
    await c.query("INSERT INTO weekly_planning_events(run_id,kind,payload) VALUES($1,$2,$3::jsonb)", [runId, upload ? "post-image-uploaded" : "post-image-removed", JSON.stringify({ postKey: key, slot, ownerId })])
    await c.query("COMMIT")
  } catch (e) { await c.query("ROLLBACK"); throw e } finally { c.release() }
}
