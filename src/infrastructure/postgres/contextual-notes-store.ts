import { createHash, randomUUID } from "node:crypto"
import type { Pool, PoolClient } from "pg"
import { currentWeek } from "../../application/dashboard/model"
import { decideNote, INTERPRETATION_SCHEMA, INTERPRETER_PROMPT, type Decision, type Interpretation, type NoteContext, type NoteEntry } from "../../application/contextual-notes/model"
import { createBrandReasoner, type BrandReasoner } from "../models/brand-reasoning"
import { readBrandDossier, saveDiscoveryDraft } from "./brand-discovery-store"
import { beginWeeklyPlanning, readPlanningView } from "./weekly-planning-store"
import { readStrategyView } from "./social-strategy-store"
import { hasSubscription } from "./subscription-store"
import { POST_COPY_SCHEMA, validatePostCopy, type PostCopy, type PostsPayload } from "../../blueprints/social/weekly-planning/posts"
import { compilePostGenerationContext } from "../../blueprints/social/weekly-planning/post-context"
import type { PlanningRun } from "../../blueprints/social/weekly-planning/model"
import type { BrandDossier } from "../../blueprints/social/brand-discovery/model"
import { PostgresSocialAnalyticsStore } from "./social-analytics-store"
import { readConnectionAccounts } from "../../application/social-connections/view"
import { PostgresSocialConnectionsStore } from "./social-connections-store"
import { readWeekEvidence } from "./social-strategy-store"

type Snapshot = { run: PlanningRun | null; dossier: BrandDossier | null; posts: PostsPayload | null; postCopy?: PostCopy; revisedCopy?: PostCopy }
type Result = { targetUrl: string; canUndo: boolean; targetId: string; before?: PostCopy; after?: PostCopy }
type Row = { id: string; owner_user_id: string; brand_id: string; context: NoteContext; raw_text: string; input_source: NoteEntry["source"]; status: NoteEntry["status"]; message: string; interpretation: Interpretation | null; decision: Decision | null; snapshot: Snapshot | null; result: Result | null; created_at: Date; updated_at: Date }
const owned = "n.owner_user_id=$1 AND EXISTS(SELECT 1 FROM brands b JOIN workspaces w ON w.id=b.workspace_id WHERE b.id=n.brand_id AND w.owner_user_id=$1)"
// PostgreSQL jsonb canonicalizes key order; equality must not depend on insertion order.
const hash = (v: unknown) => createHash("sha256").update(JSON.stringify(v, (_key, value: unknown) => value && typeof value === "object" && !Array.isArray(value) ? Object.fromEntries(Object.entries(value).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)) : value) ?? "undefined").digest("hex")
const publicNote = (r: Row): NoteEntry => {
  const expired = r.status === "processing" && Date.now() - r.created_at.getTime() > 300_000
  return { id: r.id, text: r.raw_text, source: r.input_source, context: r.context, status: expired ? "failed" : r.status, message: expired ? "დამუშავების დრო ამოიწურა. შენიშვნა შენახულია; ხელახლა სცადეთ." : r.message, createdAt: r.created_at.toISOString(), canUndo: r.status === "applied" && !!r.result?.canUndo, targetUrl: r.result?.targetUrl ?? null, meanings: r.interpretation?.statements.map(s => s.meaning) ?? [] }
}
async function transaction<T>(pool: Pool, fn: (c: PoolClient) => Promise<T>) {
  const c = await pool.connect()
  try { await c.query("BEGIN"); const result = await fn(c); await c.query("COMMIT"); return result }
  catch (error) { await c.query("ROLLBACK"); throw error } finally { c.release() }
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

export async function submitNote(pool: Pool, ownerId: string, input: { id: string; text: string; source: NoteEntry["source"]; context: NoteContext }, injectedReasoner?: BrandReasoner): Promise<NoteEntry> {
  const reserved = await transaction(pool, async c => {
    await requireNoteBrand(c, ownerId, input.context.brandId)
    await c.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`contextual-note:${ownerId}`])
    const existing = (await c.query<Row>(`SELECT n.* FROM contextual_notes n WHERE ${owned} AND n.id=$2 FOR UPDATE`, [ownerId, input.id])).rows[0]
    if (existing) {
      if (existing.raw_text !== input.text || hash(existing.context) !== hash(input.context)) throw Error("ეს შენიშვნა უკვე სხვა ტექსტით შეინახა. გაგზავნეთ ახალი შენიშვნა.")
      return { existing }
    }
    const count = await c.query<{ n: number }>("SELECT count(*)::int n FROM contextual_notes WHERE owner_user_id=$1 AND created_at>now()-interval '1 hour'", [ownerId])
    if (count.rows[0]!.n >= 40) throw Error("ამ საათში შენიშვნების ლიმიტი ამოიწურა. მოგვიანებით სცადეთ.")
    await c.query("INSERT INTO contextual_notes(id,owner_user_id,brand_id,context,raw_text,input_source,status) VALUES($1,$2,$3,$4::jsonb,$5,$6,'processing')", [input.id, ownerId, input.context.brandId, JSON.stringify(input.context), input.text, input.source])
    return { existing: null }
  })
  if (reserved.existing) return publicNote(reserved.existing)
  try {
    const { context } = input
    const [planning, dossier, strategy, history, screenData] = await Promise.all([
      readPlanningView(pool, ownerId, context.brandId, context.week), readBrandDossier(pool, ownerId, context.brandId), readStrategyView(pool, ownerId, context.brandId), listNotes(pool, ownerId, context),
      context.section === "results" ? Promise.all([new PostgresSocialAnalyticsStore(pool).listResults({ ownerId, brandId: context.brandId }), readWeekEvidence(pool, ownerId, context.brandId)]).then(([analytics, evidence]) => ({ analytics, evidence })) : context.section === "connections" || context.section === "overview" ? readConnectionAccounts(new PostgresSocialConnectionsStore(pool), { ownerId, brandId: context.brandId }) : Promise.resolve(null),
    ])
    if (context.runId && context.runId !== planning.run?.id) throw Error("არჩეული პოსტი ძველ გეგმას ეკუთვნის. განაახლეთ გვერდი და ხელახლა აირჩიეთ.")
    if (context.postVersion && context.postVersion !== planning.posts?.updatedAt) throw Error("არჩეული პოსტი შეიცვალა. ხელახლა აირჩიეთ პოსტი და შენიშვნა მიმდინარე ტექსტს მიამაგრეთ.")
    const post = context.postKey ? planning.posts?.payload.outline?.posts[Number(context.postKey.slice(1)) - 1] : null
    const copy = context.postKey ? planning.posts?.payload.copies[context.postKey] : null
    if (context.postKey && (!post || !copy || !context.channel || !post.channels.some(c => c.channel === context.channel))) throw Error("არჩეული პოსტის ტექსტი ჯერ არ არის მზად ან შეიცვალა.")
    const snapshot: Snapshot = { run: planning.run, dossier, posts: planning.posts?.payload ?? null, ...(copy ? { postCopy: copy } : {}) }
    const reason = injectedReasoner ?? createBrandReasoner(async run => { await pool.query("INSERT INTO contextual_note_model_runs(id,note_id,payload) VALUES($1,$2,$3::jsonb)", [run.id, input.id, JSON.stringify(run)]) }, { requestTimeoutMs: 40_000, ...(process.env.OPENAI_CONTEXTUAL_NOTES_MODEL ? { model: process.env.OPENAI_CONTEXTUAL_NOTES_MODEL } : {}) })
    const interpretation = await reason<Interpretation>({ step: "contextual_notes", version: "contextual-notes-v1", prompt: INTERPRETER_PROMPT, schema: INTERPRETATION_SCHEMA,
      input: { message: input.text, context, screenData, selectedPost: post ? { post, copy, channel: context.channel } : null, plan: planning.run?.payload ?? null, brand: dossier?.payload ?? null, strategy: strategy.active?.payload.proposal ?? null, recentConversation: history.filter(n => n.id !== input.id && n.context.postKey === context.postKey && n.context.channel === context.channel).slice(0, 6).reverse().map(n => ({ text: n.text, response: n.message, status: n.status })) },
      validate: v => (v as Interpretation).statements.some(s => !input.text.includes(s.quote)) ? ["Every quote must be an exact excerpt of the current user message, not history."] : [],
    })
    let decision = decideNote(interpretation, context)
    if (decision.action === "revise_plan" && (!planning.run || planning.stale || !["ready", "approved"].includes(planning.run.status) || context.week !== currentWeek())) decision = { mode: "clarify", action: "none", message: "გეგმა ჯერ მზადდება, მოძველებულია ან სხვა კვირას ეკუთვნის. მიმდინარე გეგმის დასრულების შემდეგ გავაგრძელოთ; შენიშვნა შენახულია." }
    if (decision.action === "revise_brand" && !dossier) decision = { mode: "clarify", action: "none", message: "ჯერ ბრენდის გაცნობა დაასრულეთ, შემდეგ მის ინფორმაციას დავაზუსტებთ." }
    if (decision.action === "revise_post") {
      if (!planning.run || planning.stale || planning.posts?.status !== "ready" || planning.posts.approvedAt || planning.run.status !== "ready" || context.week !== currentWeek()) decision = { mode: "explain", action: "none", message: "პირდაპირი შესწორება მხოლოდ მიმდინარე, ჯერ დაუდასტურებელი პოსტისთვის არის შესაძლებელი. დადასტურებული კონტენტისთვის კვირის გეგმის ახალი ვერსია მოამზადეთ. შენიშვნა შენახულია." }
      else {
        const revised = await reason<PostCopy>({ step: "contextual_post_revision", version: "contextual-post-v1", schema: POST_COPY_SCHEMA,
          prompt: "Revise ONLY the selected channel of this draft according to the current user instruction. Preserve the post's objective, factual boundaries, format and every unselected channel exactly. Do not invent facts. Do not store a brand preference. Return full copy including unchanged variants.",
          input: { instruction: interpretation.instruction, channel: context.channel, current: copy, context: compilePostGenerationContext(planning.run, post!) },
          validate: v => [...validatePostCopy(v as PostCopy, post!), ...((v as PostCopy).variants.filter(p => p.channel !== context.channel).some(p => hash(p) !== hash(copy!.variants.find(old => old.channel === p.channel))) ? ["Unselected channel must remain byte-for-byte unchanged"] : [])],
        })
        snapshot.revisedCopy = revised
      }
    }
    // Save the proposal before execution. Both application and ledger completion share a transaction.
    const status = decision.mode === "clarify" ? "clarification" : decision.mode === "explain" ? "answered" : "proposed"
    const saved = await pool.query("UPDATE contextual_notes SET interpretation=$2::jsonb,decision=$3::jsonb,snapshot=$4::jsonb,status=$5,message=$6,updated_at=now() WHERE id=$1 AND status='processing' AND created_at>now()-interval '5 minutes'", [input.id, JSON.stringify(interpretation), JSON.stringify(decision), JSON.stringify(snapshot), status, decision.message])
    if (!saved.rowCount) throw Error("დამუშავების დრო ამოიწურა. ცვლილება არ შესრულდა; ხელახლა სცადეთ.")
    if (decision.mode === "apply") return applyNote(pool, ownerId, input.id, false)
  } catch (error) {
    const message = error instanceof Error && /[ა-ჰ]/u.test(error.message) ? error.message : "შენიშვნა შენახულია, მაგრამ დამუშავება ვერ დასრულდა. სცადეთ ხელახლა."
    await pool.query("UPDATE contextual_notes SET status='failed',message=$2,updated_at=now() WHERE id=$1 AND status IN ('processing','proposed')", [input.id, message])
  }
  return publicNote((await pool.query<Row>(`SELECT n.* FROM contextual_notes n WHERE ${owned} AND n.id=$2`, [ownerId, input.id])).rows[0]!)
}

async function lockNote(c: PoolClient, ownerId: string, id: string) {
  const note = (await c.query<Row>(`SELECT n.* FROM contextual_notes n WHERE ${owned} AND n.id=$2 FOR UPDATE OF n`, [ownerId, id])).rows[0]
  if (!note) throw Error("შენიშვნა ვერ მოიძებნა.")
  if (!await hasSubscription(c, ownerId)) throw Error("გასაგრძელებლად განაახლეთ გამოწერა.")
  return note
}
async function lockCurrentPost(c: PoolClient, note: Row) {
  const run = note.snapshot!.run!
  await c.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`brand-confirm:${note.brand_id}`])
  await c.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`weekly-plan:${note.brand_id}:${note.context.week}`])
  const rows = await c.query<{ payload: PostsPayload; status: string; approved_at: Date | null }>(`SELECT p.payload,p.status,p.approved_at FROM weekly_post_batches p JOIN weekly_planning_runs r ON r.id=p.run_id
    WHERE r.id=$1 AND r.owner_user_id=$2 AND r.brand_id=$3 AND r.status='ready'
    AND r.week_start=date_trunc('week',now() AT TIME ZONE 'Asia/Tbilisi')::date
    AND NOT EXISTS(SELECT 1 FROM weekly_planning_runs n WHERE n.brand_id=r.brand_id AND n.week_start=r.week_start AND n.version>r.version)
    AND EXISTS(SELECT 1 FROM social_strategies s WHERE s.id::text=r.payload#>>'{socialStrategy,id}' AND s.status='approved')
    AND NOT EXISTS(SELECT 1 FROM social_publication_inputs i WHERE i.source_weekly_run_id=r.id)
    FOR UPDATE OF r,p`, [run.id, note.owner_user_id, note.brand_id])
  const row = rows.rows[0]
  if (!row || row.approved_at || !["ready", "queued"].includes(row.status)) throw Error("პოსტი შეიცვალა, დასტურდება ან მუშავდება. განაახლეთ გვერდი და სცადეთ ხელახლა.")
  const currentBasis = (await c.query<{ session_id: string; revision: number }>("SELECT session_id,revision FROM brand_dossiers WHERE brand_id=$1 ORDER BY id DESC LIMIT 1", [note.brand_id])).rows[0]
  if (currentBasis?.session_id !== run.payload.basis.sessionId || currentBasis.revision !== run.payload.basis.revision) throw Error("ბრენდის ინფორმაცია შეიცვალა. ჯერ განაახლეთ კვირის გეგმა.")
  return row
}
async function writePostRevision(c: PoolClient, note: Row, payload: PostsPayload, copy: PostCopy, kind: string) {
  const postKey = note.context.postKey!
  payload.copies[postKey] = copy
  // Reuse the existing quality review worker; edited content cannot inherit approval.
  payload.review = null
  await c.query("UPDATE weekly_post_batches SET payload=$2::jsonb,status='queued',step='review',lease_token=NULL,lease_until=NULL,error=NULL,updated_at=now() WHERE run_id=$1", [note.snapshot!.run!.id, JSON.stringify(payload)])
  await c.query("INSERT INTO weekly_planning_events(run_id,kind,payload) VALUES($1,$2,$3::jsonb)", [note.snapshot!.run!.id, kind, JSON.stringify({ noteId: note.id, postKey, channel: note.context.channel, ownerId: note.owner_user_id })])
}
export async function applyNote(pool: Pool, ownerId: string, id: string, confirmed: boolean): Promise<NoteEntry> {
  return transaction(pool, async c => {
    const n = await lockNote(c, ownerId, id)
    if (n.status === "applied") return publicNote(n)
    if (n.status !== "proposed" || !n.decision || !n.snapshot || !n.interpretation) throw Error("ამ შენიშვნას დასადასტურებელი ცვლილება არ აქვს.")
    if (n.decision.mode === "confirm" && !confirmed) throw Error("ჯერ გადაამოწმეთ და დაადასტურეთ ცვლილების შედეგი.")
    if (!["confirm", "apply"].includes(n.decision.mode)) throw Error("ცვლილება არ არის დაშვებული.")
    const snapshot = n.snapshot
    let result: Result
    let message: string
    if (n.decision.action === "revise_plan") {
      const previous = snapshot.run!
      const next = await beginWeeklyPlanning(pool, ownerId, { id: randomUUID(), brandId: n.brand_id, week: n.context.week, priority: previous.payload.priority, parentId: previous.id, parentVersion: previous.version, revisionNote: `${n.interpretation.instruction}\nშეინარჩუნე ამ კვირის ბიზნესმიზანი; შეზღუდვის შესაბამისად თავიდან შეაფასე მის მისაღწევად გამოსადეგი მოქმედებები.` }, c)
      result = { targetId: next.id, targetUrl: `/workspace/week?week=${n.context.week}`, canUndo: false }
      message = "კვირის გეგმის ახალი ვერსიის მომზადება დაიწყო. წინა ვერსია ისტორიაშია; ახალი გეგმა განხილვასა და დადასტურებას დაელოდება. უკვე შენახული გამოქვეყნების განრიგი უცვლელია."
    } else if (n.decision.action === "revise_brand") {
      await c.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`brand-confirm:${n.brand_id}`])
      const latest = (await c.query<{ session_id: string; revision: number }>("SELECT session_id,revision FROM brand_dossiers WHERE brand_id=$1 ORDER BY id DESC LIMIT 1", [n.brand_id])).rows[0]
      if (latest?.session_id !== snapshot.dossier?.sessionId || latest?.revision !== snapshot.dossier?.revision) throw Error("ბრენდი შეიცვალა. ახალი შენიშვნით გადაამოწმეთ ცვლილება.")
      const nextId = randomUUID()
      const old = snapshot.dossier!.payload.input
      const notes = `${old.notes}\n\nბრენდის ფაქტობრივი დაზუსტება:\n${n.interpretation.instruction}`
      if (notes.length > 8000) throw Error("ბრენდის აღწერა უკვე გრძელია. დაზუსტება ბრენდის გვერდზე შეიტანეთ.")
      const draft = await saveDiscoveryDraft(pool, ownerId, nextId, { ...old, notes }, n.brand_id, c)
      if (draft.id !== nextId) throw Error("ბრენდის სხვა დაზუსტება უკვე გახსნილია. ჯერ ის დაასრულეთ ბრენდის გვერდზე.")
      result = { targetId: draft.id, targetUrl: `/onboarding?brand=${encodeURIComponent(n.brand_id)}`, canUndo: true }
      message = "ბრენდის დაზუსტების მონახაზი მომზადებულია. ბრენდის გვერდზე გაუშვით ანალიზი და გადაამოწმეთ შედეგი. მოქმედი ინფორმაცია ჯერ არ შეცვლილა."
    } else if (n.decision.action === "revise_post") {
      const row = await lockCurrentPost(c, n)
      if (row.status !== "ready" || hash(row.payload.copies[n.context.postKey!]) !== hash(snapshot.postCopy)) throw Error("არჩეული ტექსტი შეიცვალა. ხელახლა გაგზავნეთ შენიშვნა მიმდინარე ვერსიისთვის.")
      if (!snapshot.revisedCopy) throw Error("შესწორებული ტექსტი ვერ მოიძებნა.")
      await writePostRevision(c, n, row.payload, snapshot.revisedCopy, "contextual-post-revised")
      result = { targetId: snapshot.run!.id, targetUrl: `/workspace/content?week=${n.context.week}#post-${Number(n.context.postKey!.slice(1))}`, canUndo: true, before: snapshot.postCopy!, after: snapshot.revisedCopy }
      message = "არჩეული პოსტის ტექსტი შევასწორე. ტექსტი ხარისხის შემოწმებას გაივლის; გამოქვეყნებისთვის კვლავ დადასტურებაა საჭირო. წინა ტექსტის დაბრუნება შეგიძლიათ."
    } else throw Error("ამ ცვლილების შესრულება ჯერ არ არის მხარდაჭერილი.")
    const row = (await c.query<Row>("UPDATE contextual_notes SET status='applied',message=$2,result=$3::jsonb,confirmed_at=CASE WHEN $4 THEN now() ELSE NULL END,updated_at=now() WHERE id=$1 RETURNING *", [id, message, JSON.stringify(result), confirmed])).rows[0]!
    return publicNote(row)
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
      // Only our untouched input draft may be removed; the ledger retains the complete prior/input evidence.
      const deleted = await c.query("DELETE FROM brand_discovery_sessions WHERE id=$1 AND owner_user_id=$2 AND brand_id=$3 AND status='draft' AND payload#>>'{input,notes}'=$4", [n.result.targetId, ownerId, n.brand_id, `${n.snapshot!.dossier!.payload.input.notes}\n\nბრენდის ფაქტობრივი დაზუსტება:\n${n.interpretation!.instruction}`])
      if (!deleted.rowCount) throw Error("ბრენდის მონახაზი უკვე მუშავდება ან შეიცვალა. მოქმედი ცოდნა ამ დაბრუნებით არ შეიცვლება.")
    } else throw Error("პირდაპირი დაბრუნება ამ ცვლილებისთვის არ არის ხელმისაწვდომი.")
    return publicNote((await c.query<Row>("UPDATE contextual_notes SET status='reverted',message='ცვლილება დაბრუნებულია. ჩანაწერი ისტორიაში შენარჩუნდა.',reverted_at=now(),updated_at=now() WHERE id=$1 RETURNING *", [id])).rows[0]!)
  })
}
