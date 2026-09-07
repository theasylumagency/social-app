import { randomUUID } from "node:crypto"
import type { Pool, PoolClient } from "pg"
import type { IsoDateTime } from "../../core/domain"
import type { BrandDossier } from "../../blueprints/social/brand-discovery/model"
import { publicDiscoveryPayload } from "../../blueprints/social/brand-discovery/model"
import type { PlanningRun, PlanningPayload, PlanningView } from "../../blueprints/social/weekly-planning/model"
import { summarizePlan } from "../../blueprints/social/weekly-planning/model"
import { approveWeeklyPlan, requestWeeklyPlanChanges, supersedeWeeklyPlan } from "../../blueprints/social/weekly-plan-lifecycle"
import { isWeek } from "../../application/dashboard/model"
import type { BrandModelRun } from "../models/brand-reasoning"
import { isDiscoveryId } from "./brand-discovery-store"
import { emptyPosts, type PostsPayload } from "../../blueprints/social/weekly-planning/posts"
import { readWeeklyPosts, listPostAssets } from "./weekly-posts-store"

type Row = { id: string; owner_user_id: string; brand_id: string; week: string; version: number; status: PlanningRun["status"]; step: PlanningRun["step"]; payload: PlanningPayload; error: string | null; lease_until: Date | null; created_at: Date; updated_at: Date }
const fields = "r.*,to_char(r.week_start,'YYYY-MM-DD') AS week"
const owned = "r.owner_user_id=$1 AND EXISTS(SELECT 1 FROM brands b JOIN workspaces w ON w.id=b.workspace_id WHERE b.id=r.brand_id AND w.owner_user_id=$1)"
const fromRow = (r: Row): PlanningRun => ({ id: r.id, ownerId: r.owner_user_id, brandId: r.brand_id, week: r.week, version: r.version, status: r.status, step: r.step, payload: r.payload, error: r.error, leaseUntil: r.lease_until?.toISOString() ?? null, createdAt: r.created_at.toISOString(), updatedAt: r.updated_at.toISOString() })
export class PlanningConflict extends Error {}
async function transaction<T>(pool: Pool, fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const c = await pool.connect()
  try { await c.query("BEGIN"); const result = await fn(c); await c.query("COMMIT"); return result }
  catch (error) { await c.query("ROLLBACK"); throw error }
  finally { c.release() }
}
async function lockBrandWeek(c: PoolClient, ownerId: string, brandId: string, week: string) {
  const access = await c.query("SELECT b.id FROM brands b JOIN workspaces w ON w.id=b.workspace_id WHERE b.id=$1 AND w.owner_user_id=$2", [brandId, ownerId])
  if (!access.rowCount) throw new Error("ბრენდი ვერ მოიძებნა.")
  // Shares the foundation-confirmation lock; an approval cannot race a new dossier.
  await c.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`brand-confirm:${brandId}`])
  await c.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`weekly-plan:${brandId}:${week}`])
}
async function budget(c: PoolClient, ownerId: string) {
  await c.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`weekly-budget:${ownerId}`])
  const n = await c.query<{ n: number }>("SELECT count(*)::int n FROM weekly_planning_events e JOIN weekly_planning_runs r ON r.id=e.run_id WHERE r.owner_user_id=$1 AND e.kind IN ('started','retried') AND e.created_at>now()-interval '1 hour'", [ownerId])
  if (n.rows[0]!.n >= 12) throw new Error("ბოლო საათში ბევრი გეგმა მოითხოვეთ. მოგვიანებით სცადეთ; შენახული გეგმები ხელმისაწვდომია.")
}
async function basis(c: Pool | PoolClient, ownerId: string, brandId: string): Promise<BrandDossier | null> {
  const result = await c.query<{ session_id: string; revision: number; confirmed_at: Date; payload: BrandDossier["payload"] }>("SELECT d.* FROM brand_dossiers d JOIN brands b ON b.id=d.brand_id JOIN workspaces w ON w.id=b.workspace_id WHERE w.owner_user_id=$1 AND b.id=$2 ORDER BY d.id DESC LIMIT 1", [ownerId, brandId])
  const r = result.rows[0]
  return r ? { sessionId: r.session_id, revision: r.revision, confirmedAt: r.confirmed_at.toISOString(), payload: publicDiscoveryPayload(r.payload) } : null
}
function assertBasis(d: BrandDossier | null): asserts d is BrandDossier {
  if (!d?.payload.understanding || !d.payload.landscape || !d.payload.envelope || d.payload.landscape.version !== d.revision || d.payload.envelope.landscapeVersion !== d.revision || !d.payload.feedback.selectedGoalIds?.length) throw new Error("ჯერ ბრენდის გაცნობა დაასრულეთ და მისი საფუძველი დაადასტურეთ.")
  const p = d.payload
  const entries = p.landscape!.entries.filter((e) => e.influence !== "none")
  if (!entries.length || p.profiles.length !== entries.length || entries.some((e) => p.profiles.filter((profile) => profile.audience.id === e.audience.id && profile.audience.source === e.source && profile.landscapeVersion === d.revision).length !== 1) || p.feedback.selectedGoalIds!.some((id) => !p.goals.some((g) => g.id === id))) throw new Error("ბრენდის აუდიტორიებისა და კომუნიკაციის მიმდინარე ვერსია დასაზუსტებელია.")
}
async function event(c: PoolClient, runId: string, kind: string, payload: unknown) {
  await c.query("INSERT INTO weekly_planning_events(run_id,kind,payload) VALUES($1,$2,$3::jsonb)", [runId, kind, JSON.stringify(payload)])
}
export async function readPlanningRun(pool: Pool, ownerId: string, id: string): Promise<PlanningRun | null> {
  const r = await pool.query<Row>(`SELECT ${fields} FROM weekly_planning_runs r WHERE ${owned} AND r.id=$2`, [ownerId, id])
  return r.rows[0] ? fromRow(r.rows[0]) : null
}
export async function readPlanningView(pool: Pool, ownerId: string, brandId: string, week: string): Promise<PlanningView> {
  const [r, approved, history, foundation] = await Promise.all([
    pool.query<Row>(`SELECT ${fields} FROM weekly_planning_runs r WHERE ${owned} AND r.brand_id=$2 AND r.week_start=$3::date ORDER BY r.version DESC LIMIT 1`, [ownerId, brandId, week]),
    pool.query<Row>(`SELECT ${fields} FROM weekly_planning_runs r WHERE ${owned} AND r.brand_id=$2 AND r.week_start=$3::date AND r.status='approved' LIMIT 1`, [ownerId, brandId, week]),
    pool.query<{ id: string; version: number; status: PlanningRun["status"]; updated_at: Date; objective: string | null }>(`SELECT r.id,r.version,r.status,r.updated_at,r.payload->'objective'->>'objective' AS objective FROM weekly_planning_runs r WHERE ${owned} AND r.brand_id=$2 AND r.week_start=$3::date ORDER BY r.version DESC LIMIT 20`, [ownerId, brandId, week]),
    basis(pool, ownerId, brandId),
  ])
  const run = r.rows[0] ? fromRow(r.rows[0]) : null
  const [posts, assets] = run ? await Promise.all([readWeeklyPosts(pool, ownerId, run.id), listPostAssets(pool, ownerId, run.id)]) : [null, []]
  const previousId = approved.rows[0]?.id
  const [approvedPosts, approvedAssets] = previousId && previousId !== run?.id ? await Promise.all([readWeeklyPosts(pool, ownerId, previousId), listPostAssets(pool, ownerId, previousId)]) : [null, []]
  return { run, posts, assets, approvedPosts, approvedAssets, approved: approved.rows[0] ? fromRow(approved.rows[0]) : null, history: history.rows.map((r) => ({ id: r.id, version: r.version, status: r.status, updatedAt: r.updated_at.toISOString(), objective: r.objective })), basis: foundation, stale: !!run && (run.payload.basis.sessionId !== foundation?.sessionId || run.payload.basis.revision !== foundation.revision) }
}

export type BeginPlanningInput = { id: string; brandId: string; week: string; priority: string; parentId?: string; parentVersion?: number; revisionNote?: string }
export async function beginWeeklyPlanning(pool: Pool, ownerId: string, input: BeginPlanningInput): Promise<PlanningRun> {
  if (!isDiscoveryId(input.id) || !isWeek(input.week) || typeof input.priority !== "string" || input.priority.length > 1200 || typeof input.brandId !== "string" || input.brandId.length > 160) throw new Error("შეამოწმეთ ბრენდი, კვირა და პრიორიტეტი.")
  if (input.parentId && (!isDiscoveryId(input.parentId) || !Number.isSafeInteger(input.parentVersion) || typeof input.revisionNote !== "string" || input.revisionNote.trim().length < 10 || input.revisionNote.length > 2000)) throw new Error("გეგმის დაზუსტება უნდა შეიცავდეს 10–2000 სიმბოლოს.")
  return transaction(pool, async (c) => {
    await budget(c, ownerId)
    await lockBrandWeek(c, ownerId, input.brandId, input.week)
    const duplicate = await c.query<Row>(`SELECT ${fields} FROM weekly_planning_runs r WHERE r.id=$1`, [input.id])
    if (duplicate.rows[0]) {
      const r = fromRow(duplicate.rows[0]); if (r.ownerId !== ownerId || r.brandId !== input.brandId || r.week !== input.week) throw new Error("გეგმა ვერ მოიძებნა.")
      return r
    }
    const latest = await c.query<Row>(`SELECT ${fields} FROM weekly_planning_runs r WHERE r.brand_id=$1 AND r.week_start=$2::date ORDER BY r.version DESC LIMIT 1 FOR UPDATE`, [input.brandId, input.week])
    const previous = latest.rows[0] ? fromRow(latest.rows[0]) : null
    if (!input.parentId && previous) return previous
    if (input.parentId && (!previous || previous.id !== input.parentId || previous.version !== input.parentVersion || !["ready", "approved", "failed"].includes(previous.status))) throw new PlanningConflict("გეგმა სხვა ჩანართში შეიცვალა ან ჯერ მზადდება. განაახლეთ გვერდი.")
    const foundation = await basis(c, ownerId, input.brandId)
    assertBasis(foundation)
    const prior = await c.query<Row>(`SELECT ${fields} FROM weekly_planning_runs r WHERE r.brand_id=$1 AND r.week_start<$2::date AND r.status='approved' ORDER BY r.week_start DESC LIMIT 3`, [input.brandId, input.week])
    const payload: PlanningPayload = { basis: foundation, priority: input.priority.trim(), revisionNote: input.revisionNote?.trim() ?? "", previousVersion: previous?.payload.plan ? summarizePlan(previous.payload.plan) : null, priorWeeks: prior.rows.flatMap((r) => r.payload.plan ? [summarizePlan(r.payload.plan)] : []), plannedOn: new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Tbilisi" }), objective: null, focus: null, directions: [], adaptation: [], experiment: null, review: null, plan: null }
    const now = new Date().toISOString() as IsoDateTime
    payload.founderPosts = true
    if (previous && previous.status !== "approved") {
      const oldPayload = { ...previous.payload }
      if (oldPayload.plan?.state === "awaitingReview") oldPayload.plan = requestWeeklyPlanChanges(oldPayload.plan, payload.revisionNote, now).plan
      await c.query("UPDATE weekly_planning_runs SET status='changesRequested',payload=$2::jsonb,updated_at=now() WHERE id=$1", [previous.id, JSON.stringify(oldPayload)])
    }
    if (previous) await event(c, previous.id, "changes-requested", { note: payload.revisionNote, replacementRunId: input.id, previousPlan: previous.payload.plan })
    const created = await c.query<Row>(`INSERT INTO weekly_planning_runs(id,owner_user_id,brand_id,week_start,version,status,step,payload) VALUES($1,$2,$3,$4::date,$5,'queued','objective',$6::jsonb) RETURNING *,to_char(week_start,'YYYY-MM-DD') AS week`, [input.id, ownerId, input.brandId, input.week, (previous?.version ?? 0) + 1, JSON.stringify(payload)])
    await event(c, input.id, "started", { basisSessionId: foundation.sessionId, basisRevision: foundation.revision, priority: payload.priority, revisionNote: payload.revisionNote })
    if (payload.priority) await c.query("INSERT INTO weekly_briefs(brand_id,week_start,objective,updated_by) VALUES($1,$2::date,$3,$4) ON CONFLICT(brand_id,week_start) DO UPDATE SET objective=excluded.objective,updated_by=excluded.updated_by,updated_at=now()", [input.brandId, input.week, payload.priority, ownerId])
    else await c.query("DELETE FROM weekly_briefs WHERE brand_id=$1 AND week_start=$2::date", [input.brandId, input.week])
    return fromRow(created.rows[0]!)
  })
}

export async function claimPlanningRun(pool: Pool, ownerId: string, id: string) {
  const token = randomUUID()
  const result = await pool.query<Row>(`UPDATE weekly_planning_runs r SET status='running',lease_token=$3,lease_until=now()+interval '4 minutes',updated_at=now() WHERE ${owned} AND r.id=$2 AND (r.status='queued' OR (r.status='running' AND r.lease_until<now())) AND EXISTS(SELECT 1 FROM auth_user u WHERE u.id=$1 AND u."emailVerified"=true) RETURNING ${fields}`, [ownerId, id, token])
  return result.rows[0] ? { run: fromRow(result.rows[0]), token } : null
}
export async function finishPlanningStep(pool: Pool, run: PlanningRun, token: string, payload: PlanningPayload, step: PlanningRun["step"]) {
  return transaction(pool, async (c) => {
    const changed = await c.query("UPDATE weekly_planning_runs SET payload=$4::jsonb,step=$5,status=$6,lease_token=NULL,lease_until=NULL,error=NULL,updated_at=now() WHERE id=$1 AND version=$2 AND lease_token=$3 RETURNING id", [run.id, run.version, token, JSON.stringify(payload), step, step === "ready" ? "ready" : "queued"])
    if (!changed.rowCount) return false
    if (step === "ready" && payload.founderPosts && !payload.review?.concerns.some((c) => c.severity === "blocking")) await c.query("INSERT INTO weekly_post_batches(run_id,status,step,payload) VALUES($1,'queued','outline',$2::jsonb) ON CONFLICT(run_id) DO NOTHING", [run.id, JSON.stringify(emptyPosts())])
    await event(c, run.id, `completed:${run.step}`, { step, ...(step === "ready" ? { plan: payload.plan, review: payload.review } : {}) })
    return true
  })
}
export async function failPlanningStep(pool: Pool, run: PlanningRun, token: string, error: string) {
  await pool.query("UPDATE weekly_planning_runs SET status='failed',error=$4,lease_token=NULL,lease_until=NULL,updated_at=now() WHERE id=$1 AND version=$2 AND lease_token=$3", [run.id, run.version, token, error])
}
export async function recordPlanningModelRun(pool: Pool, id: string, run: BrandModelRun) {
  await pool.query("INSERT INTO weekly_planning_model_runs(id,run_id,step,prompt_version,model,input_hash,duration_ms,usage,validation_errors) VALUES($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9::jsonb)", [run.id, id, run.step, run.promptVersion, run.model, run.inputHash, run.durationMs, JSON.stringify(run.usage), JSON.stringify(run.validationErrors)])
}
export async function retryPlanningRun(pool: Pool, ownerId: string, id: string, version: number) {
  return transaction(pool, async (c) => {
    await budget(c, ownerId)
    const found = await c.query<Row>(`SELECT ${fields} FROM weekly_planning_runs r WHERE ${owned} AND r.id=$2 FOR UPDATE`, [ownerId, id])
    const run = found.rows[0] ? fromRow(found.rows[0]) : null
    if (!run || run.version !== version) throw new PlanningConflict("გეგმა შეიცვალა. განაახლეთ გვერდი.")
    if (run.status !== "failed") return
    await c.query("UPDATE weekly_planning_runs SET status='queued',error=NULL,lease_token=NULL,lease_until=NULL,updated_at=now() WHERE id=$1", [id])
    await event(c, id, "retried", { step: run.step })
  })
}
export async function approvePlanningRun(pool: Pool, ownerId: string, id: string, version: number): Promise<void> {
  const preview = await readPlanningRun(pool, ownerId, id)
  if (!preview) throw new Error("გეგმა ვერ მოიძებნა.")
  return transaction(pool, async (c) => {
    await lockBrandWeek(c, ownerId, preview.brandId, preview.week)
    const found = await c.query<Row>(`SELECT ${fields} FROM weekly_planning_runs r WHERE ${owned} AND r.id=$2 FOR UPDATE`, [ownerId, id])
    const run = found.rows[0] ? fromRow(found.rows[0]) : null
    if (!run || run.version !== version) throw new PlanningConflict("გეგმის ვერსია შეიცვალა. განაახლეთ გვერდი.")
    const posts = await c.query<{ status: string; payload: PostsPayload; approved_at: Date | null }>("SELECT status,payload,approved_at FROM weekly_post_batches WHERE run_id=$1 FOR UPDATE", [id])
    if (run.status === "approved" && (!posts.rowCount || posts.rows[0]?.approved_at)) return
    const latest = await c.query<{ id: string }>("SELECT id FROM weekly_planning_runs WHERE brand_id=$1 AND week_start=$2::date ORDER BY version DESC LIMIT 1", [run.brandId, run.week])
    if (latest.rows[0]?.id !== id || !["ready", "approved"].includes(run.status) || !run.payload.plan || !run.payload.review) throw new PlanningConflict("მხოლოდ დასრულებული მიმდინარე ვერსიის დადასტურებაა შესაძლებელი.")
    const current = await basis(c, ownerId, run.brandId)
    if (current?.sessionId !== run.payload.basis.sessionId || current.revision !== run.payload.basis.revision) throw new PlanningConflict("ბრენდის საფუძველი განახლდა. ჯერ გეგმა ახალ ცოდნაზე განაახლეთ.")
    if (run.payload.review.concerns.some((issue) => issue.severity === "blocking")) throw new PlanningConflict("ჯერ გეგმის შემოწმებისას აღმოჩენილი საკითხები დააზუსტეთ.")
    if ((run.payload.founderPosts || posts.rowCount) && (posts.rows[0]?.status !== "ready" || !posts.rows[0].payload.review || posts.rows[0].payload.review.issues.some((i) => i.severity === "blocking"))) throw new PlanningConflict("ჯერ პოსტების ტექსტების მომზადება და შემოწმება დაასრულეთ.")
    const now = new Date().toISOString() as IsoDateTime
    if (posts.rowCount) {
      await c.query("UPDATE weekly_post_batches SET approved_at=now(),updated_at=now() WHERE run_id=$1", [id])
      await event(c, id, "posts-approved", { decidedBy: ownerId, posts: posts.rows[0]!.payload })
    }
    if (run.status === "approved") return
    const prior = await c.query<Row>(`SELECT ${fields} FROM weekly_planning_runs r WHERE r.brand_id=$1 AND r.week_start=$2::date AND r.id<>$3 AND r.status IN ('approved','changesRequested') FOR UPDATE`, [run.brandId, run.week, id])
    for (const row of prior.rows) {
      const old = fromRow(row)
      if (old.payload.plan && ["approved", "changesRequested"].includes(old.payload.plan.state)) old.payload.plan = supersedeWeeklyPlan(old.payload.plan, now)
      await c.query("UPDATE weekly_planning_runs SET status='superseded',payload=$2::jsonb,updated_at=now() WHERE id=$1", [old.id, JSON.stringify(old.payload)])
    }
    const approval = approveWeeklyPlan(run.payload.plan, now)
    await c.query("UPDATE weekly_planning_runs SET status='approved',payload=$2::jsonb,updated_at=now() WHERE id=$1", [id, JSON.stringify({ ...run.payload, plan: approval.plan })])
    await event(c, id, "approved", { ...approval.decision, decidedBy: ownerId })
  })
}
