import { randomUUID } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import type { PostRevision, PostRevisionView } from '../../application/post-revisions/model';
import type { PlanningRun } from '../../blueprints/social/weekly-planning/model';
import type { PostsBatch, PostsPayload, PostCopy } from '../../blueprints/social/weekly-planning/posts';
import { assertRevisionScope } from '../../application/post-revisions/scope';
import { assertCurrentWeeklyApproval, captureWeeklyApproval, weeklyBatchDigest } from '../../application/weekly-planning/approval-evidence';
import { reviewDigest } from '../../application/weekly-planning/review-evidence';
import { postsFactualBlocker } from '../../application/weekly-planning/factual-authority';
import { currentWeek } from '../../application/dashboard/model';
import { lockPublicKnowledge, readPublicKnowledge } from './public-knowledge-store';
import { listOperatingRules } from './operating-policy-store';
import { hasSubscription } from './subscription-store';
import { weeklyReviewBlocker } from '../../application/weekly-planning/review-policy';
type Row = {
    id: string;
    note_id: string;
    owner_user_id: string;
    brand_id: string;
    run_id: string;
    post_key: string;
    channel: PostRevision['channel'];
    stable_post_id: string;
    version: number;
    parent_revision_id: string | null;
    base_approval_id: string;
    base_digest: string;
    status: PostRevision['status'];
    run_snapshot: PlanningRun;
    before_payload: PostsPayload;
    payload: PostsPayload;
    approval_evidence: PostsBatch['approvalEvidence'];
    approved_at: Date | null;
    approved_by_user_id: string | null;
    error: string | null;
    updated_at: Date;
};
const owned = "r.owner_user_id=$1 AND EXISTS(SELECT 1 FROM brands b JOIN workspaces w ON w.id=b.workspace_id WHERE b.id=r.brand_id AND w.owner_user_id=$1)";
export const postRevisionFromRow = (r: Row): PostRevision => ({ id: r.id, noteId: r.note_id, ownerId: r.owner_user_id, brandId: r.brand_id, runId: r.run_id, postKey: r.post_key, channel: r.channel, stablePostId: r.stable_post_id, version: r.version, parentRevisionId: r.parent_revision_id, baseApprovalId: r.base_approval_id, baseDigest: r.base_digest, status: r.status, run: r.run_snapshot, before: r.before_payload, error: r.error, updatedAt: r.updated_at.toISOString(), batch: { runId: r.run_id, status: r.status === 'queued' ? 'queued' : r.status === 'running' ? 'running' : 'ready', step: 'ready', payload: r.payload, error: r.error, leaseUntil: null, updatedAt: r.updated_at.toISOString(), approvedAt: r.approved_at?.toISOString() ?? null, approvedByUserId: r.approved_by_user_id, approvalEvidence: r.approval_evidence ?? null } });
export async function readPostRevision(db: Pool | PoolClient, ownerId: string, id: string) {
    const row = (await db.query<Row>(`SELECT r.* FROM post_revisions r WHERE ${owned} AND r.id=$2`, [ownerId, id])).rows[0];
    return row ? postRevisionFromRow(row) : null;
}
export async function latestApprovedRevision(db: Pool | PoolClient, ownerId: string, runId: string) {
    const row = (await db.query<Row>(`SELECT r.* FROM post_revisions r WHERE ${owned} AND r.run_id=$2 AND r.status='approved' ORDER BY r.approved_at DESC,r.created_at DESC,r.id DESC LIMIT 1`, [ownerId, runId])).rows[0];
    return row ? postRevisionFromRow(row) : null;
}
export async function listPostRevisions(db: Pool | PoolClient, ownerId: string, brandId: string, runId: string): Promise<PostRevisionView[]> {
    const rows = (await db.query<Row>(`WITH recent AS (SELECT id FROM post_revisions WHERE owner_user_id=$1 AND brand_id=$2 AND run_id=$3 ORDER BY created_at DESC,id DESC LIMIT 20),
      approved AS (SELECT DISTINCT ON(post_key,channel) id FROM post_revisions WHERE owner_user_id=$1 AND brand_id=$2 AND run_id=$3 AND status='approved' ORDER BY post_key,channel,approved_at DESC,created_at DESC,id DESC),
      active AS (SELECT DISTINCT ON(post_key,channel) id FROM post_revisions WHERE owner_user_id=$1 AND brand_id=$2 AND run_id=$3 AND status NOT IN ('approved','discarded') ORDER BY post_key,channel,created_at DESC,id DESC)
      SELECT r.* FROM post_revisions r WHERE ${owned} AND r.id IN(SELECT id FROM recent UNION SELECT id FROM approved UNION SELECT id FROM active) ORDER BY created_at DESC,id DESC`, [ownerId, brandId, runId])).rows;
    return rows.map(row => { const r = postRevisionFromRow(row); return { id: r.id, postKey: r.postKey, channel: r.channel, version: r.version, status: r.status, updatedAt: r.updatedAt, error: r.error, batchTitle: r.batch.payload.outline!.posts[Number(r.postKey.slice(1)) - 1]!.title, approvalId: r.batch.approvalEvidence?.id ?? null, before: r.before.copies[r.postKey]!.variants.find(v => v.channel === r.channel)!, after: r.batch.payload.copies[r.postKey]!.variants.find(v => v.channel === r.channel)!, issues: r.batch.payload.review?.issues ?? [] }; });
}
async function lockRevisionSource(c: PoolClient, ownerId: string, run: PlanningRun, baseApprovalId: string) {
    await lockPublicKnowledge(c, run.brandId);
    await c.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`brand-confirm:${run.brandId}`]);
    await c.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`weekly-plan:${run.brandId}:${run.week}`]);
    const owner = await c.query('SELECT b.id FROM brands b JOIN workspaces w ON w.id=b.workspace_id WHERE b.id=$2 AND w.owner_user_id=$1 FOR UPDATE OF b', [ownerId, run.brandId]);
    if (!owner.rowCount || !await hasSubscription(c, ownerId))
        throw Error('გასაგრძელებლად განაახლეთ გამოწერა.');
    const source = (await c.query<{
        payload: PostsPayload;
        run_payload: PlanningRun['payload'];
        approval_evidence: PostsBatch['approvalEvidence'];
    }>(`SELECT p.payload,r.payload AS run_payload,p.approval_evidence FROM weekly_planning_runs r JOIN weekly_post_batches p ON p.run_id=r.id
 WHERE r.id=$2 AND r.owner_user_id=$1 AND r.brand_id=$3 AND r.status='approved' AND p.status='ready' AND p.approved_at IS NOT NULL AND r.week_start=$4::date
 AND NOT EXISTS(SELECT 1 FROM weekly_planning_runs n WHERE n.brand_id=r.brand_id AND n.week_start=r.week_start AND n.version>r.version) FOR UPDATE OF r,p`, [ownerId, run.id, run.brandId, currentWeek()])).rows[0];
    if (!source || source.approval_evidence?.id !== baseApprovalId || reviewDigest(source.run_payload) !== reviewDigest(run.payload))
        throw Error('საწყისი გეგმა ან დამტკიცება შეიცვალა. აირჩიეთ მიმდინარე პოსტი.');
    const dossier = (await c.query<{
        session_id: string;
        revision: number;
    }>('SELECT session_id,revision FROM brand_dossiers WHERE brand_id=$1 ORDER BY id DESC LIMIT 1', [run.brandId])).rows[0];
    if (dossier?.session_id !== run.payload.basis.sessionId || dossier.revision !== run.payload.basis.revision)
        throw Error('ბრენდის ინფორმაცია შეიცვალა. ჯერ განაახლეთ გეგმა.');
    const strategy = (await c.query<{
        id: string;
    }>("SELECT id FROM social_strategies WHERE brand_id=$1 AND status='approved' ORDER BY updated_at DESC LIMIT 1", [run.brandId])).rows[0];
    if (strategy?.id !== run.payload.socialStrategy?.id)
        throw Error('სტრატეგია შეიცვალა. ჯერ განაახლეთ გეგმა.');
    return source;
}
export async function createPostRevision(c: PoolClient, input: {
    ownerId: string;
    noteId: string;
    run: PlanningRun;
    posts: PostsBatch;
    parentRevisionId: string | null;
    postKey: string;
    channel: PostRevision['channel'];
    after: PostCopy;
}) {
    const existing = await readPostRevision(c, input.ownerId, input.noteId); // ID equals note ID; retry cannot create a second version.
    if (existing)
        return existing;
    const baseApprovalId = input.posts.approvalEvidence?.id;
    if (!baseApprovalId)
        throw Error('პოსტს მიმდინარე დამტკიცება სჭირდება.');
    const source = await lockRevisionSource(c, input.ownerId, input.run, baseApprovalId);
    const parent = await latestApprovedRevision(c, input.ownerId, input.run.id);
    if ((parent?.id ?? null) !== input.parentRevisionId)
        throw Error('პოსტის ახალი ვერსია უკვე დამტკიცდა. აირჩიეთ მიმდინარე ტექსტი.');
    const before = parent?.batch.payload ?? source.payload;
    if (weeklyBatchDigest(before) !== weeklyBatchDigest(input.posts.payload))
        throw Error('შესაცვლელი ტექსტი შეიცვალა. აირჩიეთ მიმდინარე ვერსია.');
    const payload = structuredClone(before);
    payload.copies[input.postKey] = input.after;
    payload.review = null;
    delete payload.reviewEvidence;
    delete payload.sequenceReview;
    delete payload.repairFeedback;
    delete payload.repairDrafts;
    payload.operatingRules = await listOperatingRules(c, input.ownerId, input.run.brandId);
    assertRevisionScope(before, payload, input.postKey, input.channel);
    const issue = postsFactualBlocker(input.run, payload, await readPublicKnowledge(c, input.run.brandId), new Date().toISOString());
    if (issue)
        throw Error(issue);
    const stableId = `post:${reviewDigest({ runId: input.run.id, postKey: input.postKey })}`;
    const version = Number((await c.query<{
        version: number;
    }>('SELECT coalesce(max(version),1)+1 AS version FROM post_revisions WHERE stable_post_id=$1 AND channel=$2', [stableId, input.channel])).rows[0]!.version);
    const row = (await c.query<Row>(`INSERT INTO post_revisions(id,note_id,owner_user_id,brand_id,run_id,post_key,channel,stable_post_id,version,parent_revision_id,base_approval_id,base_digest,run_snapshot,before_payload,payload)
 VALUES($1,$1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb,$13::jsonb,$14::jsonb) RETURNING *`, [input.noteId, input.ownerId, input.run.brandId, input.run.id, input.postKey, input.channel, stableId, version, input.parentRevisionId, baseApprovalId, weeklyBatchDigest(before), JSON.stringify(input.run), JSON.stringify(before), JSON.stringify(payload)])).rows[0]!;
    return postRevisionFromRow(row);
}
export async function claimPostRevision(pool: Pool, ownerId: string, id: string, leaseMs = 180000) {
    const token = randomUUID();
    const row = (await pool.query<Row & {
        attempts: number;
    }>(`UPDATE post_revisions r SET status='running',lease_token=$3,lease_until=now()+$4*interval '1 millisecond',attempts=attempts+1,updated_at=now() WHERE ${owned} AND r.id=$2
 AND (status='queued' OR (status='running' AND lease_until<now())) AND EXISTS(SELECT 1 FROM auth_user u WHERE u.id=$1 AND u."emailVerified"=true)
 AND EXISTS(SELECT 1 FROM workspaces w JOIN workspace_subscriptions sub ON sub.workspace_id=w.id WHERE w.owner_user_id=$1 AND sub.paid_at<=now() AND sub.expires_at>now()) RETURNING r.*`, [ownerId, id, token, leaseMs])).rows[0];
    return row ? { revision: postRevisionFromRow(row), token, attempts: row.attempts } : null;
}
export async function finishPostRevision(pool: Pool, id: string, token: string, payload: PostsPayload) {
    const status = payload.review?.issues.some(i => i.severity === 'blocking') || (!payload.reviewEvidence || weeklyReviewBlocker(payload.reviewEvidence)) ? 'needsChanges' : 'ready';
    return !!(await pool.query("UPDATE post_revisions SET payload=$3::jsonb,status=$4,lease_token=NULL,lease_until=NULL,error=NULL,updated_at=now() WHERE id=$1 AND lease_token=$2 AND lease_until>now()", [id, token, JSON.stringify(payload), status])).rowCount;
}
export async function resolvePostRevision(pool: Pool, ownerId: string, id: string, action: 'approve' | 'discard' | 'retry', expectedUpdatedAt: string) {
    const c = await pool.connect();
    try {
        await c.query('BEGIN');
        const initial = await readPostRevision(c, ownerId, id);
        if (!initial)
            throw Error('პოსტის ვერსია ვერ მოიძებნა.');
        await lockRevisionSource(c, ownerId, initial.run, initial.baseApprovalId);
        const row = (await c.query<Row>(`SELECT r.* FROM post_revisions r WHERE ${owned} AND id=$2 FOR UPDATE`, [ownerId, id])).rows[0]!;
        const revision = postRevisionFromRow(row);
        if (action === 'approve' && revision.status === 'approved' || action === 'discard' && revision.status === 'discarded') {
            await c.query('COMMIT');
            return revision;
        }
        if (revision.updatedAt !== expectedUpdatedAt)
            throw Error('პოსტის ვერსია შეიცვალა. განაახლეთ გვერდი.');
        if (action === 'approve') {
            if (revision.status !== 'ready')
                throw Error('ჯერ უნდა დასრულდეს ტექსტის შეფასება.');
            if ((await latestApprovedRevision(c, ownerId, revision.runId))?.id !== (revision.parentRevisionId ?? undefined))
                throw Error('ამ ტექსტის საწყისი ვერსია შეიცვალა. მოამზადეთ ახალი შესწორება.');
            assertRevisionScope(revision.before, revision.batch.payload, revision.postKey, revision.channel);
            const rules = await listOperatingRules(c, ownerId, revision.brandId);
            if (reviewDigest(rules) !== reviewDigest(revision.batch.payload.operatingRules ?? []))
                throw Error('მოქმედი წესები შეიცვალა. საჭიროა ახალი შეფასება.');
            const issue = postsFactualBlocker(revision.run, revision.batch.payload, await readPublicKnowledge(c, revision.brandId), new Date().toISOString());
            if (issue)
                throw Error(issue);
            const approvedAt = new Date().toISOString(), approval = captureWeeklyApproval(revision.run, revision.batch.payload, ownerId, approvedAt);
            await c.query("UPDATE post_revisions SET status='approved',approved_at=$3,approved_by_user_id=$2,approval_evidence=$4::jsonb,updated_at=now() WHERE id=$1", [id, ownerId, approvedAt, JSON.stringify(approval)]);
        }
        else if (action === 'discard') {
            if (['approved', 'discarded'].includes(revision.status))
                throw Error('დამტკიცებული ვერსია ისტორიაში რჩება.');
            await c.query("UPDATE post_revisions SET status='discarded',lease_token=NULL,lease_until=NULL,updated_at=now() WHERE id=$1", [id]);
        }
        else {
            if (revision.status !== 'failed')
                throw Error('ამ ვერსიის ხელახლა შეფასება საჭირო არ არის.');
            const accepted = await c.query(`UPDATE post_revisions SET status='queued',attempts=0,lease_token=NULL,lease_until=NULL,error=NULL,updated_at=now(),retry_count=CASE WHEN retry_window_started_at IS NULL OR retry_window_started_at<now()-interval '1 hour' THEN 1 ELSE retry_count+1 END,retry_window_started_at=CASE WHEN retry_window_started_at IS NULL OR retry_window_started_at<now()-interval '1 hour' THEN now() ELSE retry_window_started_at END WHERE id=$1 AND (retry_count<3 OR retry_window_started_at IS NULL OR retry_window_started_at<now()-interval '1 hour') RETURNING id`, [id]);
            if (!accepted.rowCount)
                throw Error('ხელახლა ცდის ლიმიტი ამოიწურა. მოგვიანებით სცადეთ.');
        }
        const result = (await readPostRevision(c, ownerId, id))!;
        await c.query('COMMIT');
        return result;
    }
    catch (e) {
        await c.query('ROLLBACK');
        throw e;
    }
    finally {
        c.release();
    }
}
export function assertApprovedRevision(revision: PostRevision) {
    if (revision.status !== 'approved')
        throw Error('შესწორებულ ტექსტს საკუთარი დამტკიცება სჭირდება.');
    assertRevisionScope(revision.before, revision.batch.payload, revision.postKey, revision.channel);
    assertCurrentWeeklyApproval(revision.run, revision.batch);
}
