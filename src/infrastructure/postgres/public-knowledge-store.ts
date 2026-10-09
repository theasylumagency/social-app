import { createHash, randomUUID } from "node:crypto"
import type { Pool, PoolClient } from "pg"
import { PUBLIC_FACT_KINDS, verbatimSourceSupports, type PublicFactKind, type PublicKnowledgeSnapshot, type RegisteredFact, type RegisteredProof } from "../../blueprints/social/public-knowledge"
import type { GenerationPermission } from "../../core/domain/primitives"

type Database = Pool | PoolClient
export class PublicKnowledgeConflict extends Error {}
export type SourceEvidenceOption = { id: string; excerpt: string; capturedAt: string }
export type PublicKnowledgeView = { snapshot: PublicKnowledgeSnapshot; sources: SourceEvidenceOption[] }
export type SavePublicFact = { requestId: string; brandId: string; id: string; revision: number; kind: PublicFactKind; subject: string; statement: string; permission: GenerationPermission; validUntil: string; confirmed: boolean; evidenceId?: string; sourcePublicConfirmed?: boolean }
async function access(db: Database, ownerId: string, brandId: string) {
  if (!(await db.query("SELECT b.id FROM brands b JOIN workspaces w ON w.id=b.workspace_id WHERE b.id=$1 AND w.owner_user_id=$2", [brandId, ownerId])).rowCount) throw Error("ბრენდი ვერ მოიძებნა.")
}
export async function lockPublicKnowledge(db: Database, brandId: string) {
  await db.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`public-knowledge:${brandId}`])
}
/** Single statement snapshot: fact/proof/version cannot come from different commits. */
export async function readPublicKnowledge(db: Database, brandId: string, now = new Date().toISOString()): Promise<PublicKnowledgeSnapshot> {
  const row = (await db.query<{ revision: number; facts: RegisteredFact[]; proofs: RegisteredProof[] }>(`SELECT
    coalesce((SELECT revision FROM brand_public_knowledge_versions WHERE brand_id=$1),0) AS revision,
    coalesce((SELECT jsonb_agg(entry ORDER BY id) FROM brand_public_facts WHERE brand_id=$1),'[]'::jsonb) AS facts,
    coalesce((SELECT jsonb_agg(p.entry ORDER BY p.id) FROM brand_public_proofs p JOIN brand_public_facts f ON f.id=p.fact_id AND f.brand_id=p.brand_id AND f.revision=p.fact_revision WHERE p.brand_id=$1),'[]'::jsonb) AS proofs`, [brandId])).rows[0]!
  return { version: 1, brandId, capturedAt: now, ...row }
}
export async function readPublicKnowledgeView(db: Database, ownerId: string, brandId: string): Promise<PublicKnowledgeView> {
  await access(db, ownerId, brandId)
  const [snapshot, evidence] = await Promise.all([readPublicKnowledge(db, brandId), db.query<{ id: string; excerpt: string; captured_at: Date }>(`SELECT e.id,e.excerpt,s.captured_at FROM evidence e JOIN source_snapshots s ON s.id=e.snapshot_id AND s.brand_id=e.brand_id
    WHERE e.brand_id=$1 AND e.source_claim_mode='explicit' AND e.type<>'inference' AND e.excerpt IS NOT NULL AND length(e.excerpt) BETWEEN 10 AND 3000 ORDER BY s.captured_at DESC,e.id LIMIT 100`, [brandId])])
  return { snapshot, sources: evidence.rows.map(e => ({ id: e.id, excerpt: e.excerpt, capturedAt: e.captured_at.toISOString() })) }
}
const uuid = (v: unknown) => typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f-]{27}$/iu.test(v)
function validate(input: SavePublicFact, now: string) {
  if (!uuid(input.requestId) || !uuid(input.id) || !Number.isSafeInteger(input.revision) || input.revision < 0 || !PUBLIC_FACT_KINDS.includes(input.kind)
    || typeof input.brandId !== "string" || input.brandId.length > 160 || typeof input.subject !== "string" || input.subject.trim().length < 2 || input.subject.length > 120
    || typeof input.statement !== "string" || input.statement.trim().length < 10 || input.statement.length > 1500
    || !["publicUse", "publicUseWithProof", "internalGuidance", "blocked"].includes(input.permission) || input.confirmed !== true) throw Error("შეავსეთ ფაქტი და აშკარად დაადასტურეთ მისი სისწორე და გამოყენების ნებართვა.")
  const duration = Date.parse(input.validUntil) - Date.parse(now)
  const maxDays = ["price", "hours", "availability"].includes(input.kind) ? 90 : 365
  if (!Number.isFinite(duration) || (input.permission !== "blocked" && (duration <= 0 || duration > maxDays * 86400000))) throw Error(`მიუთითეთ მომავალი მოქმედების ვადა, მაქსიმუმ ${maxDays} დღე.`)
  if (input.permission === "publicUseWithProof" && (!input.evidenceId || input.sourcePublicConfirmed !== true)) throw Error("მტკიცებულებისთვის აირჩიეთ წყარო და დაადასტურეთ მისი საჯარო გამოყენების უფლება.")
}
export async function savePublicFact(pool: Pool, ownerId: string, input: SavePublicFact): Promise<PublicKnowledgeView> {
  const c = await pool.connect()
  try {
    await c.query("BEGIN")
    await access(c, ownerId, input.brandId)
    await lockPublicKnowledge(c, input.brandId)
    const digest = createHash("sha256").update(JSON.stringify([ownerId, input.brandId, input.id, input.revision, input.kind, input.subject, input.statement, input.permission, input.validUntil, input.confirmed, input.evidenceId ?? null, input.sourcePublicConfirmed ?? false])).digest("hex")
    const retry = (await c.query<{ request_digest: string; brand_id: string; actor_user_id: string }>("SELECT request_digest,brand_id,actor_user_id FROM brand_public_knowledge_events WHERE id=$1", [input.requestId])).rows[0]
    if (retry) {
      if (retry.request_digest !== digest || retry.brand_id !== input.brandId || retry.actor_user_id !== ownerId) throw new PublicKnowledgeConflict("ეს მოთხოვნა უკვე სხვა ცვლილებისთვის გამოიყენეს. განაახლეთ გვერდი.")
      await c.query("COMMIT")
    } else {
      const now = new Date().toISOString()
      validate(input, now)
      const old = (await c.query<{ brand_id: string; revision: number; entry: RegisteredFact }>("SELECT brand_id,revision,entry FROM brand_public_facts WHERE id=$1 FOR UPDATE", [input.id])).rows[0]
      if ((old && (old.brand_id !== input.brandId || old.revision !== input.revision)) || (!old && input.revision !== 0)) throw new PublicKnowledgeConflict("ფაქტი სხვა ჩანართში შეიცვალა. განაახლეთ გვერდი.")
      const semanticKey = `${input.kind}:${input.subject.normalize("NFKC").trim().toLocaleLowerCase().replace(/\s+/gu, " ")}`
      if ((await c.query("SELECT id FROM brand_public_facts WHERE brand_id=$1 AND semantic_key=$2 AND id<>$3", [input.brandId, semanticKey, input.id])).rowCount) throw new PublicKnowledgeConflict("ამ თემის ფაქტი უკვე არსებობს. განაახლეთ არსებული ჩანაწერი.")
      if ((await c.query<{ n: number }>("SELECT count(*)::int n FROM brand_public_knowledge_events WHERE actor_user_id=$1 AND created_at>now()-interval '1 day'", [ownerId])).rows[0]!.n >= 200) throw Error("დღიური ცვლილებების ზღვარი ამოიწურა.")
      if (!old && (await c.query<{ n: number }>("SELECT count(*)::int n FROM brand_public_facts WHERE brand_id=$1", [input.brandId])).rows[0]!.n >= 100) throw Error("ბრენდის 100 ფაქტის ზღვარი ამოიწურა. განაახლეთ არსებული ჩანაწერი.")
      const revision = input.revision + 1, decisionId = randomUUID()
      const fact: RegisteredFact = { key: input.id, revision, kind: input.kind, subject: input.subject.trim(), statement: input.statement.trim(), permission: input.permission, confirmedBy: ownerId, updatedAt: now,
        fact: { id: input.id as never, brandId: input.brandId as never, type: input.kind as never, value: { subject: input.subject.trim(), statement: input.statement.trim() }, lifecycle: input.permission === "blocked" ? "inactive" : "active", provenance: [{ kind: "founderDecision", founderDecisionId: decisionId as never }], validFrom: now as never, validUntil: new Date(input.validUntil).toISOString() as never, createdAt: old?.entry.fact.createdAt ?? now as never },
        decision: { id: decisionId as never, brandId: input.brandId as never, type: "confirmPublicFact" as never, subject: { kind: "businessFact", factId: input.id as never }, value: { statement: input.statement.trim(), permission: input.permission, validUntil: input.validUntil, actorId: ownerId }, createdAt: now as never } }
      let proof: RegisteredProof | undefined
      if (input.permission === "publicUseWithProof") {
        const e = (await c.query<{ id: string; snapshot_id: string; excerpt: string; captured_at: Date }>(`SELECT e.id,e.snapshot_id,e.excerpt,s.captured_at FROM evidence e JOIN source_snapshots s ON s.id=e.snapshot_id AND s.brand_id=e.brand_id
          WHERE e.id=$1 AND e.brand_id=$2 AND e.source_claim_mode='explicit' AND e.type<>'inference' AND length(e.excerpt) BETWEEN 10 AND 3000`, [input.evidenceId, input.brandId])).rows[0]
        if (!e || e.captured_at.getTime() > Date.parse(now) || !verbatimSourceSupports(fact.statement, e.excerpt)) throw Error("ფაქტი არჩეული წყაროს ზუსტ ციტატას უნდა ემთხვეოდეს. დაუდასტურებელი დასკვნა მტკიცებულება ვერ გახდება.")
        const proofId = `proof:${input.id}:${revision}`
        fact.fact = { ...fact.fact, provenance: [...fact.fact.provenance, { kind: "evidence", evidenceId: e.id as never }] }
        proof = { key: proofId, factKey: input.id, factRevision: revision, permission: "publicUse", validUntil: fact.fact.validUntil!,
          proof: { id: proofId as never, brandId: input.brandId as never, type: "sourceExcerpt" as never, subject: { kind: "businessFact", factId: input.id as never }, evidenceIds: [e.id as never], lifecycle: "active", createdAt: now as never },
          assessment: { proofId: proofId as never, supportStatus: "sufficient", freshness: { status: "current", basis: "explicitValidity", assessedAt: now as never }, policyVersion: "owner-verbatim-source-v1", assessedAt: now as never },
          source: { evidenceId: e.id, snapshotId: e.snapshot_id, capturedAt: e.captured_at.toISOString(), excerpt: e.excerpt } }
      }
      await c.query(`INSERT INTO brand_public_facts(id,brand_id,semantic_key,revision,entry) VALUES($1,$2,$3,$4,$5::jsonb)
        ON CONFLICT(id) DO UPDATE SET semantic_key=excluded.semantic_key,revision=excluded.revision,entry=excluded.entry,updated_at=now()`, [input.id, input.brandId, semanticKey, revision, JSON.stringify(fact)])
      if (proof) await c.query("INSERT INTO brand_public_proofs(id,brand_id,fact_id,fact_revision,entry) VALUES($1,$2,$3,$4,$5::jsonb)", [proof.key, input.brandId, input.id, revision, JSON.stringify(proof)])
      await c.query("INSERT INTO brand_public_knowledge_versions(brand_id,revision) VALUES($1,1) ON CONFLICT(brand_id) DO UPDATE SET revision=brand_public_knowledge_versions.revision+1", [input.brandId])
      await c.query("INSERT INTO brand_public_knowledge_events(id,brand_id,actor_user_id,fact_id,request_digest,snapshot) VALUES($1,$2,$3,$4,$5,$6::jsonb)", [input.requestId, input.brandId, ownerId, input.id, digest, JSON.stringify({ previous: old?.entry ?? null, fact, proof: proof ?? null })])
      await c.query("COMMIT")
    }
  } catch (error) { await c.query("ROLLBACK"); throw error } finally { c.release() }
  return readPublicKnowledgeView(pool, ownerId, input.brandId)
}
