import type { Pool } from 'pg';
import { claimPostRevision, finishPostRevision } from '../infrastructure/postgres/post-revisions-store';
import { createBrandReasoner, type BrandModelRun, type BrandReasoner } from '../infrastructure/models/brand-reasoning';
import { reviewPostRevision } from '../application/post-revisions/review';
export async function runPostRevision(pool: Pool, ownerId: string, id: string, injected?: {
    reason: BrandReasoner;
    runs: BrandModelRun[];
}) {
    const claim = await claimPostRevision(pool, ownerId, id);
    if (!claim)
        return;
    const heartbeat = setInterval(() => { void pool.query("UPDATE post_revisions SET lease_until=now()+interval '180 seconds' WHERE id=$1 AND lease_token=$2 AND lease_until>now()", [id, claim.token]).catch(() => { }); }, 60000);
    heartbeat.unref();
    const runs = injected?.runs ?? [];
    try {
        if (claim.attempts > 3)
            throw Error('შესწორების შეფასება ვერ დასრულდა. ხელახლა სცადეთ.');
        const reason = injected?.reason ?? createBrandReasoner(async (run) => { runs.push(run); await pool.query('INSERT INTO post_revision_model_runs(id,revision_id,payload) SELECT $1,$2,$3::jsonb WHERE EXISTS(SELECT 1 FROM post_revisions WHERE id=$2 AND lease_token=$4 AND lease_until>now())', [run.id, id, JSON.stringify(run), claim.token]); }, { requestTimeoutMs: 60000 });
        const payload = await reviewPostRevision(claim.revision, reason, runs);
        await finishPostRevision(pool, id, claim.token, payload);
    }
    catch (error) {
        await pool.query("UPDATE post_revisions SET status='failed',error=$3,lease_token=NULL,lease_until=NULL,updated_at=now() WHERE id=$1 AND lease_token=$2 AND lease_until>now()", [id, claim.token, error instanceof Error && /[ა-ჰ]/u.test(error.message) ? error.message : 'შეფასება ვერ დასრულდა. ტექსტი შენახულია; ხელახლა სცადეთ.']);
    }
    finally {
        clearInterval(heartbeat);
    }
}
