import type { Pool, PoolClient } from "pg"
import { randomUUID } from "node:crypto"
import { assertStrategyRevision, type SocialStrategy, type StrategyPayload, type StrategyView, type WeekEvidence } from "../../blueprints/social/strategy/model"
import { currentWeek } from "../../application/dashboard/model"
import { readBrandDossier } from "./brand-discovery-store"
import { OPERATOR_LEASE_MS } from "../models/runtime-policy"
import { hasSubscription } from "./subscription-store"

type Row = { id: string; brand_id: string; owner_user_id: string; revision: number; status: SocialStrategy["status"]; payload: StrategyPayload; error: string | null; created_at: Date; updated_at: Date }
const owned = "s.owner_user_id=$1 AND EXISTS(SELECT 1 FROM brands b JOIN workspaces w ON w.id=b.workspace_id WHERE b.id=s.brand_id AND w.owner_user_id=$1)"
const fromRow = (r: Row): SocialStrategy => ({ id: r.id, brandId: r.brand_id, ownerId: r.owner_user_id, revision: r.revision, status: r.status, payload: r.payload, error: r.error, createdAt: r.created_at.toISOString(), updatedAt: r.updated_at.toISOString() })
export async function readStrategyView(pool: Pool | PoolClient, ownerId: string, brandId: string): Promise<StrategyView> {
  const r = await pool.query<Row>(`SELECT s.* FROM social_strategies s WHERE ${owned} AND s.brand_id=$2 ORDER BY revision DESC LIMIT 30`, [ownerId, brandId])
  const active = r.rows.find((r) => r.status === "approved")
  // The approved version may predate the latest 30 revisions.
  const approved = active ?? (await pool.query<Row>(`SELECT s.* FROM social_strategies s WHERE ${owned} AND s.brand_id=$2 AND s.status='approved'`, [ownerId, brandId])).rows[0]
  return { latest: r.rows[0] ? fromRow(r.rows[0]) : null, active: approved ? fromRow(approved) : null, legacy: !r.rowCount }
}
async function transaction<T>(pool: Pool, ownerId: string, brandId: string, fn: (c: PoolClient) => Promise<T>) {
  const c = await pool.connect()
  try {
    await c.query("BEGIN")
    const access = await c.query("SELECT b.id FROM brands b JOIN workspaces w ON w.id=b.workspace_id WHERE b.id=$1 AND w.owner_user_id=$2", [brandId, ownerId])
    if (!access.rowCount || !await hasSubscription(c, ownerId)) throw Error("ბრენდის წვდომა ან გამოწერა არ არის აქტიური.")
    await c.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`brand-confirm:${brandId}`])
    const result = await fn(c); await c.query("COMMIT"); return result
  } catch (error) { await c.query("ROLLBACK"); throw error } finally { c.release() }
}
export async function proposeStrategy(pool: Pool, ownerId: string, input: { id: string; brandId: string; parentId?: string; reason?: unknown; comment?: unknown }) {
  const basis = await readBrandDossier(pool, ownerId, input.brandId)
  if (!basis?.payload.understanding || !basis.payload.envelope) throw Error("ჯერ ბრენდის საფუძველი დაადასტურეთ.")
  return transaction(pool, ownerId, input.brandId, async (c) => {
    const duplicate = await c.query<Row>(`SELECT s.* FROM social_strategies s WHERE ${owned} AND s.id=$2 AND s.brand_id=$3`, [ownerId, input.id, input.brandId])
    if (duplicate.rowCount) return fromRow(duplicate.rows[0]!)
    const view = await readStrategyView(c, ownerId, input.brandId)
    if (!input.parentId && view.latest) return view.latest
    if (input.parentId && (view.latest?.id !== input.parentId || ["queued", "running"].includes(view.latest.status))) throw Error("სტრატეგია შეიცვალა ან ჯერ მზადდება. განაახლეთ გვერდი.")
    if (view.latest) assertStrategyRevision(view.latest.status === "approved" ? view.active : null, input.reason, input.comment)
    const count = await c.query<{ n: number }>("SELECT count(*)::int n FROM social_strategies WHERE owner_user_id=$1 AND created_at>now()-interval '1 hour'", [ownerId])
    if (count.rows[0]!.n >= 8) throw Error("ბოლო საათში ბევრი რეკომენდაცია მოითხოვეთ. სცადეთ მოგვიანებით.")
    const payload: StrategyPayload = { basis, sources: null, proposal: null, previousProposal: view.latest?.payload.proposal ?? view.latest?.payload.previousProposal ?? null, reason: view.latest ? input.reason as StrategyPayload["reason"] : null, comment: typeof input.comment === "string" ? input.comment.trim() : "", approvedAt: null }
    const created = await c.query<Row>("INSERT INTO social_strategies(id,brand_id,owner_user_id,revision,status,payload) VALUES($1,$2,$3,$4,'queued',$5::jsonb) RETURNING *", [input.id, input.brandId, ownerId, (view.latest?.revision ?? 0) + 1, JSON.stringify(payload)])
    return fromRow(created.rows[0]!)
  })
}
export async function approveStrategy(pool: Pool, ownerId: string, brandId: string, id: string, revision: number) {
  return transaction(pool, ownerId, brandId, async (c) => {
    const view = await readStrategyView(c, ownerId, brandId)
    const s = view.latest
    if (!s || s.id !== id || s.revision !== revision || !["proposed", "approved"].includes(s.status) || !s.payload.proposal) throw Error("დასადასტურებელი რეკომენდაცია შეიცვალა.")
    if (s.status === "approved") return
    const basis = await c.query<{ session_id: string; revision: number }>("SELECT session_id,revision FROM brand_dossiers WHERE brand_id=$1 ORDER BY id DESC LIMIT 1", [brandId])
    if (basis.rows[0]?.session_id !== s.payload.basis.sessionId || basis.rows[0]?.revision !== s.payload.basis.revision) throw Error("ბრენდის საფუძველი შეიცვალა. განაახლეთ რეკომენდაცია ახალი მტკიცებულებით.")
    await c.query("UPDATE social_strategies SET status='superseded',updated_at=now() WHERE brand_id=$1 AND status='approved'", [brandId])
    s.payload.approvedAt = new Date().toISOString()
    await c.query("UPDATE social_strategies SET status='approved',payload=$2::jsonb,updated_at=now() WHERE id=$1", [id, JSON.stringify(s.payload)])
  })
}
export async function retryStrategy(pool: Pool, ownerId: string, brandId: string, id: string) {
  return transaction(pool, ownerId, brandId, async (c) => {
    const view = await readStrategyView(c, ownerId, brandId)
    if (view.latest?.id !== id || view.latest.status !== "failed") throw Error("განაახლეთ სტრატეგიის გვერდი.")
    await c.query("UPDATE social_strategies SET status='queued',error=NULL,updated_at=now() WHERE id=$1", [id])
  })
}
export async function claimStrategy(pool: Pool, ownerId: string, id: string) {
  if (!await hasSubscription(pool, ownerId)) return null
  const token = randomUUID()
  const r = await pool.query<Row>(`UPDATE social_strategies s SET status='running',lease_token=$3,lease_until=now()+($4*interval '1 millisecond'),updated_at=now() WHERE ${owned} AND s.id=$2 AND (s.status='queued' OR (s.status='running' AND s.lease_until<now())) RETURNING s.*`, [ownerId, id, token, OPERATOR_LEASE_MS])
  return r.rows[0] ? { strategy: fromRow(r.rows[0]), token } : null
}
export async function readWeekEvidence(pool: Pool | PoolClient, ownerId: string, brandId: string): Promise<WeekEvidence[]> {
  const r = await pool.query<{ payload: WeekEvidence }>("SELECT r.payload FROM social_week_reviews r JOIN brands b ON b.id=r.brand_id JOIN workspaces w ON w.id=b.workspace_id WHERE w.owner_user_id=$1 AND b.id=$2 ORDER BY r.week_start DESC LIMIT 8", [ownerId, brandId])
  return r.rows.map((r) => r.payload)
}
export async function saveWeekEvidence(pool: Pool, ownerId: string, brandId: string, evidence: WeekEvidence) {
  if (evidence.week > currentWeek()) throw Error("მომავალი კვირის შედეგებს ჯერ ვერ შევაფასებთ.")
  return transaction(pool, ownerId, brandId, async (c) => {
    const saved = { ...evidence, reviewedAt: new Date().toISOString(), availability: evidence.observations.length ? "available" : "unavailable" }
    await c.query("INSERT INTO social_week_reviews(brand_id,week_start,payload) VALUES($1,$2,$3::jsonb) ON CONFLICT(brand_id,week_start) DO UPDATE SET payload=excluded.payload,reviewed_at=now()", [brandId, evidence.week, JSON.stringify(saved)])
  })
}
