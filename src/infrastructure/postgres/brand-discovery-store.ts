import { createHash, randomUUID } from "node:crypto"
import type { Pool, PoolClient } from "pg"
import type { BrandId, ContentHash, EvidenceId, IsoDateTime, SourceId, SourceSnapshotId } from "../../core/domain"
import type { IngestionPersistenceBatch, PersistedSourceGraph } from "../../core/persistence/ingestion-store"
import { SOCIAL_SOURCE_KINDS, SOCIAL_KNOWLEDGE_PATHS } from "../../blueprints/social/tokens"
import { emptyDiscovery, parseDiscoveryInput, type BrandDossier, type DiscoveryInput, type DiscoveryPayload, type DiscoverySession } from "../../blueprints/social/brand-discovery/model"
import type { FounderAudienceStance, FounderProvidedAudience } from "../../blueprints/social/audience"
import type { BrandModelRun } from "../models/brand-reasoning"
import { createBrandOnboarding } from "../../application/onboarding/create-brand"
import type { SocialManualKnowledgeInput } from "../../blueprints/social/ingestion/manual-profile"
import { persistIngestionInTransaction } from "./ingestion-store"

type Row = { id: string; owner_user_id: string; brand_id: string | null; revision: number; status: DiscoverySession["status"]; step: DiscoverySession["step"]; payload: DiscoveryPayload; error: string | null; updated_at: Date; lease_until: Date | null }
const readable = `s.owner_user_id = $1 AND (s.brand_id IS NULL OR EXISTS (SELECT 1 FROM brands b JOIN workspaces w ON w.id=b.workspace_id WHERE b.id=s.brand_id AND w.owner_user_id=$1))`
const sessionFromRow = (r: Row): DiscoverySession => ({ id: r.id, ownerId: r.owner_user_id, brandId: r.brand_id, revision: r.revision, status: r.status, step: r.step, payload: r.payload, error: r.error, updatedAt: r.updated_at.toISOString(), leaseUntil: r.lease_until?.toISOString() ?? null })

export class DiscoveryConflict extends Error { }
export const isDiscoveryId = (value: unknown): value is string => typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)

async function transaction<T>(pool: Pool, fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect()
  try { await client.query("BEGIN"); const result = await fn(client); await client.query("COMMIT"); return result }
  catch (error) { await client.query("ROLLBACK"); throw error }
  finally { client.release() }
}

export async function readDiscovery(pool: Pool, ownerId: string, id?: string, brandId?: string | null): Promise<DiscoverySession | null> {
  const result = id
    ? await pool.query<Row>(`SELECT s.* FROM brand_discovery_sessions s WHERE ${readable} AND s.id=$2`, [ownerId, id])
    : await pool.query<Row>(`SELECT s.* FROM brand_discovery_sessions s WHERE ${readable} AND s.brand_id IS NOT DISTINCT FROM $2 AND s.status <> 'confirmed' ORDER BY s.updated_at DESC LIMIT 1`, [ownerId, brandId ?? null])
  return result.rows[0] ? sessionFromRow(result.rows[0]) : null
}

export async function readBrandDossier(pool: Pool, ownerId: string, brandId: string): Promise<BrandDossier | null> {
  const result = await pool.query<{ session_id: string; revision: number; confirmed_at: Date; payload: DiscoveryPayload }>(`SELECT d.* FROM brand_dossiers d JOIN brands b ON b.id=d.brand_id JOIN workspaces w ON w.id=b.workspace_id WHERE w.owner_user_id=$1 AND b.id=$2 ORDER BY d.id DESC LIMIT 1`, [ownerId, brandId])
  const r = result.rows[0]
  return r ? { sessionId: r.session_id, revision: r.revision, confirmedAt: r.confirmed_at.toISOString(), payload: r.payload } : null
}

export type DossierHistoryEntry = { sessionId: string; confirmedAt: string; summary: string; offers: string[]; goals: string[] }
export async function readDossierHistory(pool: Pool, ownerId: string, brandId: string): Promise<DossierHistoryEntry[]> {
  const result = await pool.query<{ session_id: string; confirmed_at: Date; summary: string; offers: { name: string }[]; goals: { id: string; title: string }[]; selected: string[] }>(`SELECT d.session_id,d.confirmed_at,d.payload#>>'{understanding,summary}' AS summary,d.payload#>'{understanding,offers}' AS offers,d.payload->'goals' AS goals,d.payload#>'{feedback,selectedGoalIds}' AS selected FROM brand_dossiers d JOIN brands b ON b.id=d.brand_id JOIN workspaces w ON w.id=b.workspace_id WHERE w.owner_user_id=$1 AND b.id=$2 ORDER BY d.id DESC LIMIT 20`, [ownerId, brandId])
  return result.rows.map((r) => ({ sessionId: r.session_id, confirmedAt: r.confirmed_at.toISOString(), summary: r.summary, offers: r.offers.map((o) => o.name), goals: r.goals.filter((g) => r.selected.includes(g.id)).map((g) => g.title) }))
}

async function reserveAnalysisRequest(client: PoolClient, ownerId: string) {
  await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`brand-discovery:${ownerId}`])
  const rate = await client.query<{ count: number }>("SELECT count(*)::int AS count FROM brand_discovery_events e JOIN brand_discovery_sessions s ON s.id=e.session_id WHERE s.owner_user_id=$1 AND e.kind IN ('started','before-revision','retry') AND e.created_at>now()-interval '1 hour'", [ownerId])
  if (rate.rows[0]!.count >= 12) throw new Error("ბოლო საათში ბევრი ანალიზი დაიწყეთ. ცოტა მოგვიანებით სცადეთ; თქვენი ინფორმაცია შენახულია.")
}

export async function saveDiscoveryDraft(pool: Pool, ownerId: string, id: string, input: DiscoveryInput, brandId: string | null): Promise<DiscoverySession> {
  return transaction(pool, async (client) => {
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`brand-discovery:${ownerId}`])
    if (brandId) {
      const access = await client.query("SELECT b.id FROM brands b JOIN workspaces w ON w.id=b.workspace_id WHERE b.id=$1 AND w.owner_user_id=$2", [brandId, ownerId])
      if (!access.rowCount) throw new Error("ბრენდი ვერ მოიძებნა.")
    }
    const existing = await client.query<Row>("SELECT * FROM brand_discovery_sessions WHERE id=$1 FOR UPDATE", [id])
    const row = existing.rows[0]
    if (row) {
      if (row.owner_user_id !== ownerId || row.brand_id !== brandId) throw new Error("ბრენდის სესია ვერ მოიძებნა.")
      if (row.status !== "draft") return sessionFromRow(row)
      const updated = await client.query<Row>("UPDATE brand_discovery_sessions SET payload=jsonb_set(payload,'{input}',$2::jsonb),updated_at=now() WHERE id=$1 RETURNING *", [id, JSON.stringify(input)])
      return sessionFromRow(updated.rows[0]!)
    }
    const active = await client.query<Row>("SELECT * FROM brand_discovery_sessions WHERE owner_user_id=$1 AND brand_id IS NOT DISTINCT FROM $2 AND status <> 'confirmed' ORDER BY updated_at DESC LIMIT 1", [ownerId, brandId])
    if (active.rows[0]) return sessionFromRow(active.rows[0])
    const payload = emptyDiscovery(input)
    if (brandId) {
      const prior = await client.query<{ audiences: FounderProvidedAudience[] }>("SELECT payload#>'{feedback,founderAudiences}' AS audiences FROM brand_dossiers WHERE brand_id=$1 ORDER BY id DESC LIMIT 1", [brandId])
      payload.feedback.founderAudiences = prior.rows[0]?.audiences ?? []
    }
    const created = await client.query<Row>("INSERT INTO brand_discovery_sessions(id,owner_user_id,brand_id,payload) VALUES($1,$2,$3,$4::jsonb) RETURNING *", [id, ownerId, brandId, JSON.stringify(payload)])
    return sessionFromRow(created.rows[0]!)
  })
}

async function lockedSession(client: PoolClient, ownerId: string, id: string, revision: number): Promise<DiscoverySession> {
  const result = await client.query<Row>(`SELECT s.* FROM brand_discovery_sessions s WHERE ${readable} AND s.id=$2 FOR UPDATE OF s`, [ownerId, id])
  if (!result.rows[0]) throw new Error("ბრენდის სესია ვერ მოიძებნა.")
  const session = sessionFromRow(result.rows[0])
  if (session.revision !== revision) throw new DiscoveryConflict("ინფორმაცია სხვა ჩანართში განახლდა. განაახლეთ გვერდი და სცადეთ ხელახლა.")
  return session
}

async function event(client: PoolClient, session: DiscoverySession, kind: string) {
  await client.query("INSERT INTO brand_discovery_events(session_id,revision,kind,payload) VALUES($1,$2,$3,$4::jsonb)", [session.id, session.revision, kind, JSON.stringify(session.payload)])
}

export async function startDiscovery(pool: Pool, ownerId: string, id: string, revision: number, input: unknown): Promise<void> {
  const parsed = parseDiscoveryInput(input)
  await transaction(pool, async (client) => {
    await reserveAnalysisRequest(client, ownerId)
    const session = await lockedSession(client, ownerId, id, revision)
    if (["queued", "running", "ready", "confirmed"].includes(session.status)) return
    await event(client, session, "started")
    const payload = emptyDiscovery(parsed)
    payload.feedback.founderAudiences = session.payload.feedback.founderAudiences
    await client.query("UPDATE brand_discovery_sessions SET payload=$2::jsonb,status='queued',step='sources',error=NULL,lease_token=NULL,lease_until=NULL,updated_at=now() WHERE id=$1", [id, JSON.stringify(payload)])
  })
}

export async function reviseDiscovery(pool: Pool, ownerId: string, id: string, revision: number, changes: Record<string, unknown>): Promise<void> {
  await transaction(pool, async (client) => {
    await reserveAnalysisRequest(client, ownerId)
    const session = await lockedSession(client, ownerId, id, revision)
    if (!["ready", "failed"].includes(session.status)) throw new DiscoveryConflict("ჯერ მიმდინარე ანალიზის დასრულებას დაელოდეთ.")
    const p = structuredClone(session.payload)
    const now = new Date().toISOString() as IsoDateTime
    let step: DiscoverySession["step"] = "profiles"
    if (changes.kind === "business") {
      if (typeof changes.note !== "string" || changes.note.trim().length < 10 || changes.note.length > 4000) throw new Error("დაზუსტება უნდა შეიცავდეს 10–4000 სიმბოლოს.")
      const notes = `${p.input.notes}\n\nდამატებითი დაზუსტება (${now}):\n${changes.note.trim()}`.trim()
      if (notes.length > 8000) throw new Error("დაზუსტებები ჯამში მაქსიმუმ 8000 სიმბოლო უნდა იყოს.")
      p.input.notes = notes
      p.sources = [...p.sources.filter((s) => s.key !== "founder"), { key: "founder", title: "თქვენი ინფორმაცია", url: null, text: notes, capturedAt: now }]
      p.understanding = null; p.hypotheses = []; p.evidence = []; p.feedback.stances = []
      step = p.sources.length ? "understanding" : "sources"
    } else {
      if (!p.hypotheses.length || !Array.isArray(changes.stances) || !Array.isArray(changes.founderAudiences) || changes.stances.length > 5 || changes.founderAudiences.length > 4) throw new Error("აუდიტორიის პასუხები არასწორია.")
      const used = new Set<string>()
      p.feedback.stances = changes.stances.map((raw: unknown) => {
        if (!raw || typeof raw !== "object") throw new Error("შეამოწმეთ აუდიტორიის პასუხი.")
        const s = raw as Record<string, unknown>
        if (typeof s.audienceHypothesisId !== "string" || !p.hypotheses.some((h) => h.id === s.audienceHypothesisId) || used.has(s.audienceHypothesisId) || !["agree", "unsure", "disagree"].includes(String(s.stance)) || (s.note !== undefined && (typeof s.note !== "string" || s.note.length > 1000))) throw new Error("შეამოწმეთ აუდიტორიის პასუხი.")
        used.add(s.audienceHypothesisId)
        const old = p.feedback.stances.find((item) => item.audienceHypothesisId === s.audienceHypothesisId)
        return { audienceHypothesisId: s.audienceHypothesisId, stance: s.stance, ...(typeof s.note === "string" && s.note.trim() ? { note: s.note.trim() } : {}), createdAt: old?.createdAt ?? now, updatedAt: now } as FounderAudienceStance
      })
      p.feedback.founderAudiences = changes.founderAudiences.map((raw: unknown) => {
        if (!raw || typeof raw !== "object") throw new Error("აღწერეთ თქვენი აუდიტორია.")
        const a = raw as Record<string, unknown>
        if (typeof a.name !== "string" || a.name.trim().length < 3 || a.name.length > 120 || typeof a.description !== "string" || a.description.trim().length < 10 || a.description.length > 1000) throw new Error("აუდიტორიას სჭირდება სახელი (3–120) და აღწერა (10–1000 სიმბოლო).")
        const old = p.feedback.founderAudiences.find((item) => item.id === a.id)
        return { id: old?.id ?? `founder-audience:${randomUUID()}`, brandId: session.brandId ?? `brand:${session.id}`, name: a.name.trim(), description: a.description.trim(), createdAt: old?.createdAt ?? now, updatedAt: now } as FounderProvidedAudience
      })
    }
    await event(client, session, "before-revision")
    p.landscape = null; p.profiles = []; p.envelope = null; p.goals = []; p.feedback.selectedGoalIds = null
    await client.query("UPDATE brand_discovery_sessions SET payload=$2::jsonb,revision=revision+1,status='queued',step=$3,error=NULL,lease_token=NULL,lease_until=NULL,updated_at=now() WHERE id=$1", [id, JSON.stringify(p), step])
  })
}

export async function retryDiscovery(pool: Pool, ownerId: string, id: string, revision: number) {
  await transaction(pool, async (client) => {
    await reserveAnalysisRequest(client, ownerId)
    const session = await lockedSession(client, ownerId, id, revision)
    if (session.status !== "failed") return
    await event(client, session, "retry")
    await client.query("UPDATE brand_discovery_sessions SET status='queued',error=NULL,lease_token=NULL,lease_until=NULL,updated_at=now() WHERE id=$1", [id])
  })
}

export async function claimDiscovery(pool: Pool, ownerId: string, id: string): Promise<{ session: DiscoverySession; token: string } | null> {
  const token = randomUUID()
  const result = await pool.query<Row>(`UPDATE brand_discovery_sessions s SET status='running',lease_token=$3,lease_until=now()+interval '4 minutes',updated_at=now() WHERE ${readable} AND s.id=$2 AND (s.status='queued' OR (s.status='running' AND s.lease_until<now())) AND EXISTS(SELECT 1 FROM auth_user u WHERE u.id=$1 AND u."emailVerified"=true) RETURNING s.*`, [ownerId, id, token])
  return result.rows[0] ? { session: sessionFromRow(result.rows[0]), token } : null
}

export async function finishDiscoveryStep(pool: Pool, session: DiscoverySession, token: string, payload: DiscoveryPayload, step: DiscoverySession["step"]): Promise<boolean> {
  return transaction(pool, async (client) => {
    const result = await client.query("UPDATE brand_discovery_sessions SET payload=$4::jsonb,step=$5,status=$6,lease_token=NULL,lease_until=NULL,error=NULL,updated_at=now() WHERE id=$1 AND revision=$2 AND lease_token=$3 RETURNING id", [session.id, session.revision, token, JSON.stringify(payload), step, step === "ready" ? "ready" : "queued"])
    if (!result.rowCount) return false
    await event(client, { ...session, payload }, `completed:${session.step}`)
    return true
  })
}

export async function failDiscoveryStep(pool: Pool, session: DiscoverySession, token: string, error: string) {
  await pool.query("UPDATE brand_discovery_sessions SET status='failed',error=$4,lease_token=NULL,lease_until=NULL,updated_at=now() WHERE id=$1 AND revision=$2 AND lease_token=$3", [session.id, session.revision, token, error])
}

export async function recordDiscoveryModelRun(pool: Pool, session: DiscoverySession, run: BrandModelRun) {
  await pool.query("INSERT INTO brand_discovery_model_runs(id,session_id,revision,step,prompt_version,model,input_hash,duration_ms,usage,validation_errors) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10::jsonb)", [run.id, session.id, session.revision, run.step, run.promptVersion, run.model, run.inputHash, run.durationMs, JSON.stringify(run.usage), JSON.stringify(run.validationErrors)])
}

function sourceGraphs(session: DiscoverySession, brandId: BrandId, now: IsoDateTime): PersistedSourceGraph[] {
  return session.payload.sources.map((source) => {
    const sourceId = `source:discovery:${session.id}:${session.revision}:${source.key}` as SourceId
    const snapshotId = `snapshot:discovery:${session.id}:${session.revision}:${source.key}` as SourceSnapshotId
    return {
      source: { id: sourceId, brandId, kind: source.url ? SOCIAL_SOURCE_KINDS.website : SOCIAL_SOURCE_KINDS.manualInput, reference: source.url ? { kind: "url", url: source.url } : { kind: "manual", label: source.title }, createdAt: now },
      snapshot: { id: snapshotId, sourceId, brandId, capturedAt: source.capturedAt as IsoDateTime, contentHash: `sha256:${createHash("sha256").update(source.text).digest("hex")}` as ContentHash, content: { kind: "text", text: source.text, mediaType: "text/plain" }, sourceMetadata: { title: source.title } },
      evidence: session.payload.evidence.filter((e) => e.sourceKey === source.key).map((e) => ({ id: e.id as EvidenceId, brandId, snapshotId, type: "observation", sourceClaimMode: "explicit", value: e.statement, evidenceStrength: "medium", excerpt: e.exactExcerpt })),
      routings: [],
    }
  })
}

export async function confirmDiscovery(pool: Pool, ownerId: string, id: string, revision: number, selectedGoals: unknown, language: unknown): Promise<string> {
  return transaction(pool, async (client) => {
    const session = await lockedSession(client, ownerId, id, revision)
    if (session.status === "confirmed" && session.brandId) return session.brandId
    const p = session.payload
    if (session.status !== "ready" || !p.understanding || !p.envelope || p.envelope.landscapeVersion !== revision || p.profiles.some((profile) => profile.landscapeVersion !== revision)) throw new DiscoveryConflict("ჯერ მიმდინარე ანალიზი დაასრულეთ.")
    if (!Array.isArray(selectedGoals) || !selectedGoals.length || new Set(selectedGoals).size !== selectedGoals.length || selectedGoals.some((goal) => typeof goal !== "string" || !p.goals.some((g) => g.id === goal))) throw new Error("აირჩიეთ სულ მცირე ერთი შემოთავაზებული მიზანი.")
    if (language !== "ka" && language !== "en") throw new Error("აირჩიეთ კონტენტის ენა.")
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`brand-confirm:${session.brandId ?? session.id}`])
    const workspace = await client.query<{ id: string }>("SELECT id FROM workspaces WHERE owner_user_id=$1", [ownerId])
    if (!workspace.rows[0]) throw new Error("სამუშაო სივრცე ვერ მოიძებნა.")
    const access = { workspaceId: workspace.rows[0].id, userId: ownerId }
    const existing = session.brandId ? (await client.query<{ id: string; created_at: Date }>("SELECT id,created_at FROM brands WHERE id=$1 AND workspace_id=$2", [session.brandId, access.workspaceId])).rows[0] : undefined
    if (session.brandId && !existing) throw new Error("ბრენდი ვერ მოიძებნა.")
    const previous = existing ? (await client.query<{ knowledge: SocialManualKnowledgeInput }>("SELECT s.content#>'{data,knowledge}' AS knowledge FROM ingestion_runs r JOIN source_snapshots s ON s.id=r.snapshot_id WHERE r.brand_id=$1 ORDER BY r.completed_at DESC,r.id DESC LIMIT 1", [existing.id])).rows[0]?.knowledge : undefined
    const preservedIdentity: Pick<
      SocialManualKnowledgeInput,
      "identityIndustry" | "identityLocations" | "identitySocialAccounts"
    > | undefined = previous
        ? {
          ...(previous.identityIndustry === undefined
            ? {}
            : { identityIndustry: previous.identityIndustry }),
          ...(previous.identityLocations === undefined
            ? {}
            : { identityLocations: previous.identityLocations }),
          ...(previous.identitySocialAccounts === undefined
            ? {}
            : { identitySocialAccounts: previous.identitySocialAccounts }),
        }
        : undefined

    p.feedback.selectedGoalIds = selectedGoals as string[]
    p.input.language = language
    const now = new Date().toISOString() as IsoDateTime
    let confirmedBatch: IngestionPersistenceBatch | undefined
    const result = await createBrandOnboarding({
      businessName: p.understanding.name, language, services: p.understanding.offers.map((o) => o.name), description: p.understanding.summary, tones: p.understanding.voice.traits,
      ...(p.sources.find((s) => s.url)?.url ? { website: p.sources.find((s) => s.url)!.url! } : {}), goals: p.goals.filter((g) => selectedGoals.includes(g.id)).map((g) => g.title), ...(p.understanding.constraints.length ? { avoidTopics: p.understanding.constraints } : {}),
    }, {
      async persist(batch) {
        const withSources = { ...batch, supportingSources: sourceGraphs(session, batch.brand.id, now) }
        confirmedBatch = withSources
        return persistIngestionInTransaction(client, withSources, access)
      }, async loadBySnapshotId() { throw new Error("Not used during confirmation") },
    }, {
      createOperationId: () => session.id,
      now: () => new Date(now),
      ...(preservedIdentity === undefined ? {} : { preservedIdentity }),
      ...(existing
        ? {
          existingBrand: {
            id: existing.id as BrandId,
            createdAt: existing.created_at.toISOString(),
          },
        }
        : {}),
    })
    if (!confirmedBatch || result.persistence !== "persisted") throw new Error("Setup confirmation snapshot conflict")
    const proposals = confirmedBatch.knowledgeProposals.filter((proposal) => proposal.kind === "proposeSet" || proposal.kind === "proposeAdd")
    await client.query("UPDATE knowledge_claims SET lifecycle='inactive' WHERE brand_id=$1 AND path=ANY($2::text[])", [result.brandId, [...new Set([...proposals.map((proposal) => proposal.path), SOCIAL_KNOWLEDGE_PATHS.constraintsSensitiveTopics])]])
    for (const [i, proposal] of proposals.entries()) {
      await client.query("INSERT INTO knowledge_claims(id,brand_id,path,value,epistemic_status,lifecycle,provenance,created_at) VALUES($1,$2,$3,$4::jsonb,'confirmed','active',$5::jsonb,$6)", [`claim:${session.id}:${i}`, result.brandId, proposal.path, JSON.stringify(proposal.proposed.value), JSON.stringify(proposal.proposed.provenance), now])
    }
    await client.query("INSERT INTO brand_dossiers(brand_id,session_id,revision,payload,confirmed_by) VALUES($1,$2,$3,$4::jsonb,$5)", [result.brandId, id, revision, JSON.stringify(p), ownerId])
    await client.query("UPDATE brand_discovery_sessions SET status='confirmed',brand_id=$2,payload=$3::jsonb,updated_at=now() WHERE id=$1", [id, result.brandId, JSON.stringify(p)])
    await event(client, session, "confirmed")
    return result.brandId
  })
}
