import {lockPublicKnowledge} from "./public-knowledge-store"
import {applyPreparedNote} from "../../application/contextual-notes/mutation"
import {createPostRevision,latestApprovedRevision,readPostRevision} from "./post-revisions-store"
import { prepareContextualNote, type NoteSnapshot, type NoteWorkInput } from '../../application/contextual-notes/workflow'
import { createHash, randomUUID } from "node:crypto"
import type { Pool, PoolClient } from "pg"
import { currentWeek } from "../../application/dashboard/model"
import type { Decision, Interpretation, NoteContext, NoteEntry } from "../../application/contextual-notes/model"
import { createBrandReasoner, type BrandReasoner } from "../models/brand-reasoning"
import { readBrandDossier, saveDiscoveryDraft } from "./brand-discovery-store"
import { beginWeeklyPlanning, readPlanningView, revertContextualPlanningRevision } from "./weekly-planning-store"
import { readStrategyView } from "./social-strategy-store"
import { hasSubscription } from "./subscription-store"
import type {PostCopy,PostsPayload} from "../../blueprints/social/weekly-planning/posts"
import type { BrandDossier } from "../../blueprints/social/brand-discovery/model"
import { PostgresSocialAnalyticsStore } from "./social-analytics-store"
import { readConnectionAccounts } from "../../application/social-connections/view"
import { PostgresSocialConnectionsStore } from "./social-connections-store"
import { readWeekEvidence } from "./social-strategy-store"
import { activateOperatingRule, listChannelPolicies, listOperatingRules, revertChannelPolicy, revertOperatingRule, setChannelPolicy } from "./operating-policy-store"
import { type SocialChannel } from "../../core/domain/operating-policy"

type Result = { targetUrl: string; canUndo: boolean; targetId: string; before?: PostCopy; after?: PostCopy; previousId?: string; ruleId?: string; policyEventId?: string | null; policyRevision?: number; cancelledSchedules?: number; unresolvedSchedules?: number }
type Row = { id: string; owner_user_id: string; brand_id: string; context: NoteContext; raw_text: string; input_source: NoteEntry["source"]; status: NoteEntry["status"]; message: string; interpretation: Interpretation | null; decision: Decision | null; snapshot: NoteSnapshot | null; result: Result | null; created_at: Date; updated_at: Date }
const owned = "n.owner_user_id=$1 AND EXISTS(SELECT 1 FROM brands b JOIN workspaces w ON w.id=b.workspace_id WHERE b.id=n.brand_id AND w.owner_user_id=$1)"
// PostgreSQL jsonb canonicalizes key order; equality must not depend on insertion order.
const hash = (v: unknown) => createHash("sha256").update(JSON.stringify(v, (_key, value: unknown) => value && typeof value === "object" && !Array.isArray(value) ? Object.fromEntries(Object.entries(value).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)) : value) ?? "undefined").digest("hex")
const requestContextIdentity = (context: NoteContext) => ({ ...context, target: context.target ? { type: context.target.type, id: context.target.id, version: context.target.version } : null })
const publicNote = (r: Row): NoteEntry => {
  return { id: r.id, text: r.raw_text, source: r.input_source, context: r.context, status: r.status, message: r.message || (r.status === "queued" ? "შენიშვნა შენახულია და ფონურად დამუშავდება. შეგიძლიათ მუშაობა გააგრძელოთ." : ""), createdAt: r.created_at.toISOString(), canUndo: r.status === "applied" && !!r.result?.canUndo, targetUrl: r.result?.targetUrl ?? null, meanings: r.interpretation?.statements.map(s => s.meaning) ?? [] }
}
async function transaction<T>(pool: Pool, fn: (c: PoolClient) => Promise<T>) {
  const c = await pool.connect()
  try { await c.query("BEGIN"); const result = await fn(c); await c.query("COMMIT"); return result }
  catch (error) { await c.query("ROLLBACK"); throw error } finally { c.release() }
}
type ChannelImpact = { affectedFuture: number; unresolved: number }
async function channelImpact(db: Pool | PoolClient, brandId: string, channel: SocialChannel): Promise<ChannelImpact> {
  const row = (await db.query<{ affected_future: number; unresolved: number }>(`
    WITH latest_event AS (SELECT DISTINCT ON (schedule_id) schedule_id,event_type,publish_at FROM social_content_schedule_events ORDER BY schedule_id,revision DESC),
    latest_attempt AS (SELECT DISTINCT ON (schedule_id) id,schedule_id,attempt_number FROM social_publish_attempts ORDER BY schedule_id,attempt_number DESC),
    terminal AS (SELECT a.schedule_id,r.status FROM latest_attempt a LEFT JOIN social_publish_results r ON r.attempt_id=a.id),
    reconciled AS (SELECT DISTINCT ON (a.schedule_id) a.schedule_id,c.status FROM latest_attempt a JOIN social_publish_reconciliations c ON c.attempt_id=a.id ORDER BY a.schedule_id,c.checked_at DESC,c.id DESC),
    candidates AS (SELECT s.id,a.id AS attempt_id,t.status,r.status AS reconciliation_status FROM social_content_schedules s
      LEFT JOIN latest_event e ON e.schedule_id=s.id LEFT JOIN latest_attempt a ON a.schedule_id=s.id LEFT JOIN terminal t ON t.schedule_id=s.id LEFT JOIN reconciled r ON r.schedule_id=s.id
      WHERE s.brand_id=$1 AND s.channel=$2 AND coalesce(e.event_type,'rescheduled')<>'cancelled' AND coalesce(e.publish_at,s.publish_at)>now())
    SELECT count(*)::int affected_future,
      count(*) FILTER (WHERE attempt_id IS NOT NULL)::int unresolved
    FROM candidates`, [brandId, channel])).rows[0]
  return { affectedFuture: row?.affected_future ?? 0, unresolved: row?.unresolved ?? 0 }
}

async function cancelSafeFutureSchedules(c: PoolClient, ownerId: string, brandId: string, channel: SocialChannel) {
  const rows = await c.query<{ id: string; revision: number; publish_at: Date; attempt_id: string | null; result_status: string | null; reconciliation_status: string | null }>(`
    WITH latest_event AS (SELECT DISTINCT ON (schedule_id) schedule_id,event_type,publish_at,revision FROM social_content_schedule_events ORDER BY schedule_id,revision DESC),
    latest_attempt AS (SELECT DISTINCT ON (schedule_id) id,schedule_id,attempt_number FROM social_publish_attempts ORDER BY schedule_id,attempt_number DESC),
    terminal AS (SELECT a.schedule_id,r.status FROM latest_attempt a LEFT JOIN social_publish_results r ON r.attempt_id=a.id),
    reconciled AS (SELECT DISTINCT ON (a.schedule_id) a.schedule_id,c.status FROM latest_attempt a JOIN social_publish_reconciliations c ON c.attempt_id=a.id ORDER BY a.schedule_id,c.checked_at DESC,c.id DESC)
    SELECT s.id,coalesce(e.revision,0)::int revision,coalesce(e.publish_at,s.publish_at) publish_at,a.id attempt_id,t.status result_status,r.status reconciliation_status
    FROM social_content_schedules s LEFT JOIN latest_event e ON e.schedule_id=s.id LEFT JOIN latest_attempt a ON a.schedule_id=s.id
      LEFT JOIN terminal t ON t.schedule_id=s.id LEFT JOIN reconciled r ON r.schedule_id=s.id
    WHERE s.brand_id=$1 AND s.channel=$2 AND coalesce(e.event_type,'rescheduled')<>'cancelled' AND coalesce(e.publish_at,s.publish_at)>now()
    FOR UPDATE OF s`, [brandId, channel])
  let cancelled = 0, unresolved = 0
  for (const row of rows.rows) {
    // Retain every recorded delivery attempt; channel policy cannot rewrite delivery history.
    if (row.attempt_id) { unresolved++; continue }
    await c.query(`INSERT INTO social_content_schedule_events(id,schedule_id,revision,event_type,publish_at,actor_user_id,occurred_at,reason)
      VALUES($1,$2,$3,'cancelled',NULL,$4,now(),$5)`, [randomUUID(), row.id, row.revision + 1, ownerId, "არხი ოპერაციულად გამორთულია."])
    cancelled++
  }
  return { cancelled, unresolved }
}
export async function requireNoteBrand(db: Pool | PoolClient, ownerId: string, brandId: string) {
  const r = await db.query("SELECT b.id FROM brands b JOIN workspaces w ON w.id=b.workspace_id WHERE b.id=$1 AND w.owner_user_id=$2", [brandId, ownerId])
  if (!r.rowCount) throw Error("ბრენდი ვერ მოიძებნა.")
}
export async function listNotes(pool: Pool, ownerId: string, context: NoteContext): Promise<NoteEntry[]> {
  await requireNoteBrand(pool, ownerId, context.brandId)
  const rows = await pool.query<Row>(`SELECT n.* FROM contextual_notes n WHERE ${owned} AND n.brand_id=$2 AND n.context->>'section'=$3 AND (n.context->>'week'=$4 OR $3 NOT IN ('week','content')) ORDER BY n.created_at DESC LIMIT 40`, [ownerId, context.brandId, context.section, context.week])
  return rows.rows.map(publicNote)
}
export async function reserveVoiceRequest(pool: Pool, ownerId: string) {
  await transaction(pool, async c => {
    await c.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`contextual-voice:${ownerId}`])
    const count = await c.query<{ n: number }>("SELECT count(*)::int n FROM contextual_voice_requests WHERE owner_user_id=$1 AND created_at>now()-interval '1 hour'", [ownerId])
    if (count.rows[0]!.n >= 30) throw Error("ამ საათში ხმის შეყვანის ლიმიტი ამოიწურა. შეგიძლიათ ტექსტი დაწეროთ.")
    await c.query("INSERT INTO contextual_voice_requests(owner_user_id) VALUES($1)", [ownerId])
  })
}

export async function enqueueNote(pool: Pool, ownerId: string, input: { id: string; text: string; source: NoteEntry["source"]; context: NoteContext }): Promise<NoteEntry> {
  const reserved = await transaction(pool, async c => {
    await requireNoteBrand(c, ownerId, input.context.brandId)
    await c.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`contextual-note:${ownerId}`])
    const existing = (await c.query<Row>(`SELECT n.* FROM contextual_notes n WHERE ${owned} AND n.id=$2 FOR UPDATE`, [ownerId, input.id])).rows[0]
    if (existing) {
      if (existing.raw_text !== input.text || existing.input_source !== input.source || hash(requestContextIdentity(existing.context)) !== hash(requestContextIdentity(input.context))) throw Error("ეს შენიშვნა უკვე სხვა ტექსტით შეინახა. გაგზავნეთ ახალი შენიშვნა.")
      return { existing }
    }
    const count = await c.query<{ n: number }>("SELECT count(*)::int n FROM contextual_notes WHERE owner_user_id=$1 AND created_at>now()-interval '1 hour'", [ownerId])
    if (count.rows[0]!.n >= 40) throw Error("ამ საათში შენიშვნების ლიმიტი ამოიწურა. მოგვიანებით სცადეთ.")
    await c.query("INSERT INTO contextual_notes(id,owner_user_id,brand_id,context,raw_text,input_source,status,job_state) VALUES($1,$2,$3,$4::jsonb,$5,$6,'queued','queued')", [input.id, ownerId, input.context.brandId, JSON.stringify(input.context), input.text, input.source])
    return { existing: null }
  })
  if (reserved.existing) return publicNote(reserved.existing)
  return readNote(pool,ownerId,input.id)
}
export async function readNote(pool:Pool,ownerId:string,id:string) {
 const row=(await pool.query<Row>(`SELECT n.* FROM contextual_notes n WHERE ${owned} AND n.id=$2`,[ownerId,id])).rows[0]
 if(!row) throw Error('შენიშვნა ვერ მოიძებნა.')
 return publicNote(row)
}
export async function retryNote(pool:Pool,ownerId:string,id:string) {
 return transaction(pool,async c=>{
  const row=await lockNote(c,ownerId,id)
  if(row.status==='failed') {
   const accepted=await c.query(`UPDATE contextual_notes SET status='queued',job_state='queued',attempts=0,lease_token=NULL,lease_until=NULL,message='',updated_at=now(),retry_count=CASE WHEN retry_window_started_at IS NULL OR retry_window_started_at<now()-interval '1 hour' THEN 1 ELSE retry_count+1 END,retry_window_started_at=CASE WHEN retry_window_started_at IS NULL OR retry_window_started_at<now()-interval '1 hour' THEN now() ELSE retry_window_started_at END WHERE id=$1 AND (retry_count<3 OR retry_window_started_at IS NULL OR retry_window_started_at<now()-interval '1 hour') RETURNING id`,[id])
   if(!accepted.rowCount)throw Error('ხელახლა ცდის ლიმიტი ამოიწურა. მოგვიანებით სცადეთ.')
  }
  return publicNote((await c.query<Row>('SELECT * FROM contextual_notes WHERE id=$1',[id])).rows[0]!)
 })
}
export async function claimNote(pool:Pool,ownerId:string,id:string,leaseMs=180000) {
 const token=randomUUID()
 const row=(await pool.query<Row & {job_kind:'interpret'|'apply';attempts:number}>(`UPDATE contextual_notes n SET status='processing',job_state='running',lease_token=$3,lease_until=now()+$4*interval '1 millisecond',attempts=attempts+1,updated_at=now()
 WHERE ${owned} AND n.id=$2 AND (job_state='queued' OR (job_state='running' AND lease_until<now()))
 AND EXISTS(SELECT 1 FROM auth_user u WHERE u.id=$1 AND u."emailVerified"=true)
 AND EXISTS(SELECT 1 FROM workspaces w JOIN workspace_subscriptions sub ON sub.workspace_id=w.id WHERE w.owner_user_id=$1 AND sub.paid_at<=now() AND sub.expires_at>now()) RETURNING n.*`,[ownerId,id,token,leaseMs])).rows[0]
 return row?{row,token}:null
}
export async function executeNote(pool:Pool,ownerId:string,id:string,injectedReasoner?:BrandReasoner,leaseMs=180000) {
 const claim=await claimNote(pool,ownerId,id,leaseMs)
 if(!claim) return readNote(pool,ownerId,id)
 const {row,token}=claim
 const heartbeat=setInterval(()=>{void pool.query("UPDATE contextual_notes SET lease_until=now()+$3*interval '1 millisecond' WHERE id=$1 AND lease_token=$2 AND lease_until>now()",[id,token,leaseMs]).catch(()=>{})},Math.max(1000,Math.floor(leaseMs/3)))
 heartbeat.unref()
 try {
  if(row.attempts>3) throw Error('შენიშვნის ავტომატური დამუშავება ვერ დასრულდა. შენიშვნა შენახულია; ხელახლა სცადეთ.')
  if(row.job_kind==='apply') return await applyNote(pool,ownerId,id,false,token)
  const context=row.context
  const [planning,dossier,strategy,history,screenData,activeRules]=await Promise.all([
    readPlanningView(pool,ownerId,context.brandId,context.week),readBrandDossier(pool,ownerId,context.brandId),readStrategyView(pool,ownerId,context.brandId),listNotes(pool,ownerId,context),
    context.section==='results'?Promise.all([new PostgresSocialAnalyticsStore(pool).listResults({ownerId,brandId:context.brandId}),readWeekEvidence(pool,ownerId,context.brandId)]).then(([analytics,evidence])=>({analytics,evidence})):context.section==='connections'||context.section==='overview'?readConnectionAccounts(new PostgresSocialConnectionsStore(pool),{ownerId,brandId:context.brandId}):Promise.resolve(null),listOperatingRules(pool,ownerId,context.brandId)])
  const latest=planning.posts?.approvedAt&&planning.run?await latestApprovedRevision(pool,ownerId,planning.run.id):null
  if(context.postRevisionId) {
   const selected=await readPostRevision(pool,ownerId,context.postRevisionId)
   if(!selected||selected.status!=='approved'||selected.runId!==context.runId||selected.postKey!==context.postKey||selected.channel!==context.channel||hash(selected.batch.payload.copies[context.postKey!]!.variants.find(v=>v.channel===context.channel))!==hash(latest?.batch.payload.copies[context.postKey!]!.variants.find(v=>v.channel===context.channel))) throw Error('არჩეული პოსტის ვერსია შეიცვალა. აირჩიეთ მიმდინარე ტექსტი.')
   planning.posts={...planning.posts!,updatedAt:selected.updatedAt}
  } else if(latest&&context.postKey&&hash(latest.batch.payload.copies[context.postKey]!.variants.find(v=>v.channel===context.channel))!==hash(planning.posts!.payload.copies[context.postKey]!.variants.find(v=>v.channel===context.channel))) throw Error('ამ არხს უკვე ახალი დამტკიცებული ტექსტი აქვს. შენიშვნა ახალ ვერსიას მიამაგრეთ.')
  if(latest) planning.posts={...planning.posts!,payload:latest.batch.payload}
  const model=injectedReasoner??createBrandReasoner(async run=>{await pool.query('INSERT INTO contextual_note_model_runs(id,note_id,payload) SELECT $1,$2,$3::jsonb WHERE EXISTS(SELECT 1 FROM contextual_notes WHERE id=$2 AND lease_token=$4 AND lease_until>now())',[run.id,id,JSON.stringify(run),token])},{requestTimeoutMs:40000,...(process.env.OPENAI_CONTEXTUAL_NOTES_MODEL?{model:process.env.OPENAI_CONTEXTUAL_NOTES_MODEL}:{})})
  const reason:BrandReasoner=async call=>{
    const live=await pool.query('SELECT 1 FROM contextual_notes WHERE id=$1 AND lease_token=$2 AND lease_until>now()',[id,token]);if(!live.rowCount)throw Error('Note lease expired')
    return model(call)
  }
  const prepared=await prepareContextualNote({id,text:row.raw_text,source:row.input_source,context},{planning,dossier,strategy,history,screenData,activeRules,parentRevisionId:latest?.id??null},{reason,channelImpact: (brandId,channel)=>channelImpact(pool,brandId,channel),channelPolicies:()=>listChannelPolicies(pool,ownerId,context.brandId)})
  const automatic=prepared.decision.mode==='apply'
  await pool.query(`UPDATE contextual_notes SET context=$2::jsonb,interpretation=$3::jsonb,decision=$4::jsonb,snapshot=$5::jsonb,status=$6,message=$7,job_state=$8,job_kind=$9,attempts=0,lease_token=NULL,lease_until=NULL,updated_at=now() WHERE id=$1 AND lease_token=$10 AND lease_until>now()`,[id,JSON.stringify(prepared.context),JSON.stringify(prepared.interpretation),JSON.stringify(prepared.decision),JSON.stringify(prepared.snapshot),automatic?'queued':prepared.status,prepared.decision.message,automatic?'queued':'idle',automatic?'apply':'interpret',token])
 } catch(error) {
  const message=error instanceof Error&&/[ა-ჰ]/u.test(error.message)?error.message:'შენიშვნა შენახულია, მაგრამ დამუშავება ვერ დასრულდა. სცადეთ ხელახლა.'
  await pool.query("UPDATE contextual_notes SET status='failed',message=$2,job_state='idle',lease_token=NULL,lease_until=NULL,updated_at=now() WHERE id=$1 AND lease_token=$3 AND lease_until>now()",[id,message,token])
 } finally {clearInterval(heartbeat)}
 return readNote(pool,ownerId,id)
}
/** Compatibility entry point for application tests; HTTP submission only enqueues. */
export async function submitNote(pool:Pool,ownerId:string,input:NoteWorkInput,injectedReasoner?:BrandReasoner) {
 let note=await enqueueNote(pool,ownerId,input)
 for(let step=0;step<2&&note.status==='queued';step++) note=await executeNote(pool,ownerId,input.id,injectedReasoner)
 return note
}

async function lockNote(c: PoolClient, ownerId: string, id: string) {
  const note = (await c.query<Row>(`SELECT n.* FROM contextual_notes n WHERE ${owned} AND n.id=$2 FOR UPDATE OF n`, [ownerId, id])).rows[0]
  if (!note) throw Error("შენიშვნა ვერ მოიძებნა.")
  if (!await hasSubscription(c, ownerId)) throw Error("გასაგრძელებლად განაახლეთ გამოწერა.")
  return note
}
async function lockCurrentPost(c: PoolClient, note: Row) {
  const runId = note.snapshot!.post?.runId ?? note.snapshot!.run!.id
  await c.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`brand-confirm:${note.brand_id}`])
  await c.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`weekly-plan:${note.brand_id}:${note.context.week}`])
  const rows = await c.query<{ payload: PostsPayload; status: string; approved_at: Date | null; basis_session_id: string; basis_revision: string }>(`SELECT p.payload,p.status,p.approved_at,r.payload#>>'{basis,sessionId}' basis_session_id,r.payload#>>'{basis,revision}' basis_revision FROM weekly_post_batches p JOIN weekly_planning_runs r ON r.id=p.run_id
    WHERE r.id=$1 AND r.owner_user_id=$2 AND r.brand_id=$3 AND r.status='ready'
    AND r.week_start=date_trunc('week',now() AT TIME ZONE 'Asia/Tbilisi')::date
    AND NOT EXISTS(SELECT 1 FROM weekly_planning_runs n WHERE n.brand_id=r.brand_id AND n.week_start=r.week_start AND n.version>r.version AND n.status NOT IN ('superseded','changesRequested'))
    AND EXISTS(SELECT 1 FROM social_strategies s WHERE s.id::text=r.payload#>>'{socialStrategy,id}' AND s.status='approved')
    AND NOT EXISTS(SELECT 1 FROM social_publication_inputs i WHERE i.source_weekly_run_id=r.id)
    FOR UPDATE OF r,p`, [runId, note.owner_user_id, note.brand_id])
  const row = rows.rows[0]
  if (!row || row.approved_at || !["ready", "queued"].includes(row.status)) throw Error("პოსტი შეიცვალა, დასტურდება ან მუშავდება. განაახლეთ გვერდი და სცადეთ ხელახლა.")
  const currentBasis = (await c.query<{ session_id: string; revision: number }>("SELECT session_id,revision FROM brand_dossiers WHERE brand_id=$1 ORDER BY id DESC LIMIT 1", [note.brand_id])).rows[0]
  if (currentBasis?.session_id !== row.basis_session_id || currentBasis.revision !== Number(row.basis_revision)) throw Error("ბრენდის ინფორმაცია შეიცვალა. ჯერ განაახლეთ კვირის გეგმა.")
  return row
}
async function writePostRevision(c: PoolClient, note: Row, payload: PostsPayload, copy: PostCopy, kind: string) {
  const postKey = note.context.postKey!
  payload.copies[postKey] = copy
  payload.operatingRules = await listOperatingRules(c, note.owner_user_id, note.brand_id)
  // Reuse the existing quality review worker; edited content cannot inherit approval.
  payload.review = null
  delete payload.reviewEvidence
  const runId = note.snapshot!.post?.runId ?? note.snapshot!.run!.id
  await c.query("UPDATE weekly_post_batches SET payload=$2::jsonb,status='queued',step='review',lease_token=NULL,lease_until=NULL,error=NULL,updated_at=now() WHERE run_id=$1", [runId, JSON.stringify(payload)])
  await c.query("INSERT INTO weekly_planning_events(run_id,kind,payload) VALUES($1,$2,$3::jsonb)", [runId, kind, JSON.stringify({ noteId: note.id, postKey, channel: note.context.channel, ownerId: note.owner_user_id })])
}
export async function applyNote(pool: Pool, ownerId: string, id: string, confirmed: boolean, leaseToken?: string): Promise<NoteEntry> {
  return transaction(pool, async c => {
    const n = await lockNote(c, ownerId, id)
    if (leaseToken) {
      const fence=await c.query("SELECT 1 FROM contextual_notes WHERE id=$1 AND lease_token=$2 AND lease_until>now() AND job_state='running'",[id,leaseToken])
      if(!fence.rowCount) throw Error("Note lease expired")
    }
    if (n.status === "applied") return publicNote(n)
    return applyPreparedNote(n,{confirmed,leasedAutomatic:!!leaseToken},async command=>{
    const snapshot=command.snapshot
    let result: Result
    let message: string
    if (command.action === "revise_plan") {
      const previous = snapshot.plan ?? (snapshot.run ? { runId: snapshot.run.id, version: snapshot.run.version, priority: snapshot.run.payload.priority } : null)
      if (!previous) throw Error("გეგმის საწყისი ვერსია ვერ მოიძებნა.")
      const next = await beginWeeklyPlanning(pool, ownerId, { id: randomUUID(), brandId: n.brand_id, week: n.context.week, priority: previous.priority, parentId: previous.runId, parentVersion: previous.version, revisionNote: `${command.instruction}
შეინარჩუნე ამ კვირის ბიზნესმიზანი; ზუსტად შეასრულე მომხმარებლის პირდაპირი მოთხოვნები.`, revisionSource: { noteId: n.id, text: n.raw_text }, ...(snapshot.weeklyDirectives ? { weeklyDirectives: snapshot.weeklyDirectives } : {}) }, c)
      result = { targetId: next.id, previousId: previous.runId, targetUrl: `/workspace/week?week=${n.context.week}`, canUndo: true }
      message = "კვირის გეგმის ახალი ვერსიის მომზადება დაიწყო. წინა ვერსია ისტორიაშია; სანამ ახალ ვერსიაზე კონტენტი ან სხვა შემდგომი სამუშაო არ შექმნილა, ცვლილების დაბრუნება შეგიძლიათ."
    } else if (command.action === "revise_brand") {
      await c.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`brand-confirm:${n.brand_id}`])
      const latest = (await c.query<{ session_id: string; revision: number; payload: BrandDossier["payload"] }>("SELECT session_id,revision,payload FROM brand_dossiers WHERE brand_id=$1 ORDER BY id DESC LIMIT 1", [n.brand_id])).rows[0]
      const source = snapshot.brand ?? (snapshot.dossier ? { sessionId: snapshot.dossier.sessionId, revision: snapshot.dossier.revision, inputNotesHash: hash(snapshot.dossier.payload.input.notes) } : null)
      if (!source || latest?.session_id !== source.sessionId || latest?.revision !== source.revision || hash(latest.payload.input.notes) !== source.inputNotesHash) throw Error("ბრენდი შეიცვალა. ახალი შენიშვნით გადაამოწმეთ ცვლილება.")
      const nextId = randomUUID()
      const old = latest.payload.input
      const notes = `${old.notes}\n\nბრენდის ფაქტობრივი დაზუსტება:\n${command.instruction}`
      if (notes.length > 8000) throw Error("ბრენდის აღწერა უკვე გრძელია. დაზუსტება ბრენდის გვერდზე შეიტანეთ.")
      const draft = await saveDiscoveryDraft(pool, ownerId, nextId, { ...old, notes }, n.brand_id, c)
      if (draft.id !== nextId) throw Error("ბრენდის სხვა დაზუსტება უკვე გახსნილია. ჯერ ის დაასრულეთ ბრენდის გვერდზე.")
      result = { targetId: draft.id, targetUrl: `/onboarding?brand=${encodeURIComponent(n.brand_id)}`, canUndo: true }
      message = "ბრენდის დაზუსტების მონახაზი მომზადებულია. ბრენდის გვერდზე გაუშვით ანალიზი და გადაამოწმეთ შედეგი. მოქმედი ინფორმაცია ჯერ არ შეცვლილა."
    } else if (command.action === "revise_post" && snapshot.revision && snapshot.post?.after) {
      const revision=await createPostRevision(c,{ownerId,noteId:n.id,run:snapshot.revision.run,posts:snapshot.revision.posts,parentRevisionId:snapshot.revision.parentRevisionId,postKey:n.context.postKey!,channel:n.context.channel!,after:snapshot.post.after})
      result={targetId:revision.id,targetUrl:`/workspace/content?week=${n.context.week}#post-revision-${revision.id}`,canUndo:false}
      message='არჩეული არხის ახალი ტექსტი ცალკე ვერსიად შეინახა და შეფასდება. გადაამოწმეთ და დაამტკიცეთ; შემდეგ ძველი განრიგის ჩანაცვლება ცალკე აირჩიეთ.'
    } else if (command.action === "revise_post") {
      const row = await lockCurrentPost(c, n)
      const before = snapshot.post?.before ?? snapshot.postCopy
      const after = snapshot.post?.after ?? snapshot.revisedCopy
      if (row.status !== "ready" || hash(row.payload.copies[n.context.postKey!]) !== hash(before)) throw Error("არჩეული ტექსტი შეიცვალა. ხელახლა გაგზავნეთ შენიშვნა მიმდინარე ვერსიისთვის.")
      if (!after || !before) throw Error("შესწორებული ტექსტი ვერ მოიძებნა.")
      await writePostRevision(c, n, row.payload, after, "contextual-post-revised")
      result = { targetId: snapshot.post?.runId ?? snapshot.run!.id, targetUrl: `/workspace/content?week=${n.context.week}#post-${Number(n.context.postKey!.slice(1))}`, canUndo: true, before, after }
      message = "არჩეული პოსტის ტექსტი შევასწორე. ტექსტი ხარისხის შემოწმებას გაივლის; გამოქვეყნებისთვის კვლავ დადასტურებაა საჭირო. წინა ტექსტის დაბრუნება შეგიძლიათ."
    } else if (command.action === "set_operating_rule") {
      if (!snapshot.rule) throw Error("მუდმივი წესის აღწერა ვერ მოიძებნა.")
      const activated = await activateOperatingRule(c, { ownerId, brandId: n.brand_id, noteId: n.id, rule: snapshot.rule })
      result = { targetId: activated.rule.id, ruleId: activated.rule.id, targetUrl: n.context.section === "settings" ? "/workspace/settings" : `/workspace/${n.context.section}`, canUndo: activated.created }
      message = activated.created ? `მოქმედი წესი შენახულია: ${activated.rule.directive} მომავალ შესაბამის კონტენტში ეს წესი ავტომატურად შევა. ${activated.superseded.length ? "გადაფარული წინა წესი ისტორიაში დარჩა." : ""}` : "იგივე წესი უკვე მოქმედია; ახალი დუბლიკატი არ შექმნილა."
    } else if (command.action === "set_channel_policy") {
      // Match planning budget -> facts -> foundation -> brand -> schedule lock order.
      await c.query("SELECT pg_advisory_xact_lock(hashtext($1))",[`weekly-budget:${ownerId}`])
      await lockPublicKnowledge(c,n.brand_id)
      await c.query("SELECT pg_advisory_xact_lock(hashtext($1))",[`brand-confirm:${n.brand_id}`])
      await c.query("SELECT id FROM brands WHERE id=$1 FOR UPDATE",[n.brand_id])
      const change = snapshot.channelPolicy
      if (!change) throw Error("არხის გადაწყვეტილება ვერ მოიძებნა.")
      const policy = await setChannelPolicy(c, { ownerId, brandId: n.brand_id, noteId: n.id, channel: change.channel, active: change.active })
      const stopped = change.active ? { cancelled: 0, unresolved: 0 } : await cancelSafeFutureSchedules(c, ownerId, n.brand_id, change.channel)
      let planId: string | undefined, previousId: string | undefined
      const current = await readPlanningView(pool, ownerId, n.brand_id, n.context.week)
      if (current.run && n.context.week === currentWeek() && ["ready", "approved", "failed"].includes(current.run.status)) {
        previousId = current.run.id
        const next = await beginWeeklyPlanning(pool, ownerId, { id: randomUUID(), brandId: n.brand_id, week: n.context.week, priority: current.run.payload.priority, parentId: current.run.id, parentVersion: current.run.version, revisionNote: `${change.channel} არხის ოპერაციული სტატუსი შეიცვალა. შეინარჩუნე ბიზნესმიზანი და თავიდან შეაფასე არხების ნაზავი; სხვა არხზე კონტენტი მექანიკურად არ გადაიტანო.` }, c)
        planId = next.id
      }
      result = { targetId: planId ?? policy.eventId ?? n.id, ...(previousId ? { previousId } : {}), targetUrl: `/workspace/week?week=${n.context.week}`, canUndo: !!policy.eventId, policyEventId: policy.eventId, policyRevision: policy.revision, cancelledSchedules: stopped.cancelled, unresolvedSchedules: stopped.unresolved }
      message = `${change.channel === "instagram" ? "Instagram" : "Facebook"} ${change.active ? "კვლავ აქტიური სამუშაო არხია" : "აღარ არის აქტიური სამუშაო არხი"}. კავშირი, ისტორია და ანალიტიკა შენარჩუნდა.${stopped.cancelled ? ` ${stopped.cancelled} მომავალი განრიგი გაუქმდა და ისტორიაში დარჩა.` : ""}${stopped.unresolved ? ` ${stopped.unresolved} დაწყებული გაგზავნის ჩანაწერი ისტორიაში შენარჩუნდა.` : ""}${planId ? " მიმდინარე კვირის გეგმის ახალი კანდიდატი მზადდება." : ""}`
    } else throw Error("ამ ცვლილების შესრულება ჯერ არ არის მხარდაჭერილი.")
    const row = (await c.query<Row>("UPDATE contextual_notes SET status='applied',job_state='idle',lease_token=NULL,lease_until=NULL,message=$2,result=$3::jsonb,confirmed_at=CASE WHEN $4 THEN now() ELSE NULL END,updated_at=now() WHERE id=$1 RETURNING *", [id, message, JSON.stringify(result), confirmed])).rows[0]!
    return publicNote(row)
    })
  })
}
export async function resolveNote(pool: Pool, ownerId: string, id: string, action: "dismiss" | "undo"): Promise<NoteEntry> {
  return transaction(pool, async c => {
    const n = await lockNote(c, ownerId, id)
    if (action === "dismiss") {
      if (n.status === "dismissed") return publicNote(n)
      if (n.status !== "proposed") throw Error("ამ შენიშვნას დასადასტურებელი ცვლილება არ აქვს.")
      return publicNote((await c.query<Row>("UPDATE contextual_notes SET status='dismissed',message='ცვლილება არ შესრულდა.',updated_at=now() WHERE id=$1 RETURNING *", [id])).rows[0]!)
    }
    if (n.status === "reverted") return publicNote(n)
    if (n.status !== "applied" || !n.result?.canUndo) throw Error("ამ ცვლილების პირდაპირ დაბრუნება შეუძლებელია.")
    if (n.decision?.action === "revise_post") {
      const current = await lockCurrentPost(c, n)
      if (hash(current.payload.copies[n.context.postKey!]) !== hash(n.result.after)) throw Error("ტექსტი მოგვიანებით შეიცვალა. დაბრუნება ამ ახალ ცვლილებას გადაფარავდა; გამოიყენეთ ახალი შენიშვნა.")
      await writePostRevision(c, n, current.payload, n.result.before!, "contextual-post-reverted")
    } else if (n.decision?.action === "revise_brand") {
      // Only the draft created by this operation may be removed.
      const deleted = await c.query("DELETE FROM brand_discovery_sessions WHERE id=$1 AND owner_user_id=$2 AND brand_id=$3 AND status='draft'", [n.result.targetId, ownerId, n.brand_id])
      if (!deleted.rowCount) throw Error("ბრენდის მონახაზი უკვე მუშავდება ან შეიცვალა. მოქმედი ცოდნა ამ დაბრუნებით არ შეიცვლება.")
    } else if (n.decision?.action === "revise_plan") {
      if (!n.result.previousId) throw Error("წინა გეგმის ვერსია ვერ მოიძებნა.")
      await revertContextualPlanningRevision(c, ownerId, n.brand_id, n.context.week, n.result.targetId, n.result.previousId)
    } else if (n.decision?.action === "set_operating_rule") {
      await revertOperatingRule(c, ownerId, n.brand_id, n.result.ruleId ?? n.result.targetId)
    } else if (n.decision?.action === "set_channel_policy") {
      if (!n.result.policyEventId || !n.result.policyRevision) throw Error("არხის ცვლილება უკვე მოქმედ მდგომარეობას ემთხვეოდა და დასაბრუნებელი ჩანაწერი არ აქვს.")
      if (n.result.previousId && n.result.targetId !== n.result.policyEventId) await revertContextualPlanningRevision(c, ownerId, n.brand_id, n.context.week, n.result.targetId, n.result.previousId)
      await revertChannelPolicy(c, { ownerId, brandId: n.brand_id, noteId: n.id, eventId: n.result.policyEventId, expectedRevision: n.result.policyRevision })
    } else throw Error("პირდაპირი დაბრუნება ამ ცვლილებისთვის არ არის ხელმისაწვდომი.")
    const suffix = n.decision?.action === "set_channel_policy" && (n.result.cancelledSchedules ?? 0) > 0 ? " გაუქმებული განრიგები ავტომატურად არ აღდგენილა; მათი ისტორია შენარჩუნებულია." : ""
    return publicNote((await c.query<Row>("UPDATE contextual_notes SET status='reverted',message=$2,reverted_at=now(),updated_at=now() WHERE id=$1 RETURNING *", [id, `ცვლილება დაბრუნებულია. ჩანაწერი ისტორიაში შენარჩუნდა.${suffix}`])).rows[0]!)
  })
}
