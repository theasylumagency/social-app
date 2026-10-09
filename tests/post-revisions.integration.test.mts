import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { socialDeliveryFixture } from './social-delivery-fixture';
import { subscribeFixture, strategicBrandFixture } from './strategic-integration-fixture';
import { beginWeeklyPlanning, claimPlanningRun, finishPlanningStep, readPlanningView, approvePlanningRun } from '../src/infrastructure/postgres/weekly-planning-store';
import { completePlanningFixture } from './weekly-planning-fixture';
import { currentScheduleFixture, copyFixture, editorialFixture } from './weekly-posts-fixture';
import { reviewFixture } from './weekly-review-fixture';
import { emptyPosts } from '../src/blueprints/social/weekly-planning/posts';
import { currentWeek } from '../src/application/dashboard/model';
import { targetHash, type Interpretation, type NoteContext } from '../src/application/contextual-notes/model';
import { enqueueNote, executeNote, readNote } from '../src/infrastructure/postgres/contextual-notes-store';
import { listPostRevisions, readPostRevision, resolvePostRevision, claimPostRevision, finishPostRevision } from '../src/infrastructure/postgres/post-revisions-store';
import { runPostRevision } from '../src/worker/post-revisions';
import { materializePostRevision } from '../src/application/publishing/materialize-post-revision';
import { decodeSocialPublicationBundle } from '../src/application/publishing/publication-bundle-codec';
import { reviewDigest } from '../src/application/weekly-planning/review-evidence';
import { PostgresSocialPublicationStore } from '../src/infrastructure/postgres/social-publication-store';
import { scheduleApprovedWeek } from '../src/application/publishing/schedule-approved-post';
import type { BrandModelRun, BrandReasoner, BrandModelCall } from '../src/infrastructure/models/brand-reasoning';
async function fixture(t: Parameters<typeof socialDeliveryFixture>[0]) {
    const { pool } = await socialDeliveryFixture(t);
    await subscribeFixture(pool, 'owner');
    const brandId = await strategicBrandFixture(pool);
    await pool.query("INSERT INTO social_provider_profiles(id,brand_id,provider,provider_profile_ref) VALUES('revision-profile',$1,'zernio','revision-provider-profile')", [brandId]);
    await pool.query("INSERT INTO social_publishing_accounts(id,brand_id,channel,native_account_ref,display_name) VALUES('revision-account',$1,'facebook','revision-native-page','Revision Page')", [brandId]);
    await pool.query(`INSERT INTO social_provider_account_bindings(id,publishing_account_id,brand_id,channel,provider,provider_profile_ref,provider_account_ref,connection_status,can_publish,can_fetch_analytics,capabilities,connected_at) VALUES('revision-binding','revision-account',$1,'facebook','zernio','revision-provider-profile','revision-provider-account','connected',true,true,'{"publish":true,"analytics":true}',now())`, [brandId]);
    const run = await beginWeeklyPlanning(pool, 'owner', { id: randomUUID(), brandId, week: currentWeek(), priority: '' }), claim = (await claimPlanningRun(pool, 'owner', run.id))!, ready = await completePlanningFixture(claim.run);
    await finishPlanningStep(pool, claim.run, claim.token, ready.payload, 'ready');
    const payload = { ...emptyPosts(), outline: currentScheduleFixture(), copies: { p1: copyFixture(), p2: copyFixture(), p3: copyFixture() } };
    payload.outline.posts.forEach(p => { p.format = 'text'; p.visual = { kind: 'none', aspectRatio: 'none', description: '', frames: [] }; });
    for (const [key, copy] of Object.entries(payload.copies)) {
        copy.factualReferences = { factKeys: [], proofKeys: [] };
        copy.variants.forEach(v => { v.caption = `${key} · ${v.channel} · ${v.caption}`; });
    }
    payload.review = { summary: 'Fixture factual/editorial review', issues: [] };
    payload.reviewEvidence = reviewFixture(ready, payload, new Date().toISOString());
    await pool.query("UPDATE weekly_post_batches SET status='ready',step='ready',payload=$2::jsonb WHERE run_id=$1", [run.id, JSON.stringify(payload)]);
    await approvePlanningRun(pool, 'owner', run.id, run.version);
    const view = await readPlanningView(pool, 'owner', brandId, currentWeek()), original = structuredClone(view.posts!), approvedRun = view.run!;
    const data = { postKey: 'p1', channel: 'facebook' as const, title: payload.outline.posts[0]!.title };
    const context: NoteContext = { brandId, section: 'content', week: currentWeek(), postKey: 'p1', channel: 'facebook', runId: run.id, postVersion: original.updatedAt, target: { type: 'post', id: 'p1:facebook', label: data.title, version: original.updatedAt, hash: targetHash(data), data } };
    const meaning: Interpretation = { statements: [{ quote: 'შეამოკლე.', meaning: 'მხოლოდ არჩეული არხის ტექსტის შემოკლება', kind: 'draft_correction', scope: 'post', actionable: true }], response: 'შესწორებას მოვამზადებ.', clarification: '', action: 'revise_post', instruction: 'შეამოკლე მხოლოდ ამ პოსტის Facebook-ის ტექსტი.', ambiguous: false };
    const after = structuredClone(original.payload.copies.p1!);
    after.variants[0]!.caption = 'ნივთის სრული და დაზიანების ახლო ხედი ერთად გადაიღეთ.';
    const reason: BrandReasoner = async <T,>(call: BrandModelCall) => (call.step === 'contextual_notes' ? meaning : after) as T;
    const input = { id: randomUUID(), text: 'შეამოკლე.', source: 'text' as const, context };
    await enqueueNote(pool, 'owner', input);
    await executeNote(pool, 'owner', input.id, reason);
    assert.equal((await readNote(pool, 'owner', input.id)).status, 'queued', 'the interpretation checkpoint survives a worker restart');
    await executeNote(pool, 'owner', input.id, async () => { throw Error('Apply checkpoint must not repeat model work'); });
    const result = await readNote(pool, 'owner', input.id);
    assert.equal(result.status, 'applied', result.message);
    const revision = (await readPostRevision(pool, 'owner', input.id))!;
    const store = new PostgresSocialPublicationStore(pool), timeContext = { timeZone: 'Asia/Tbilisi', localDateTime: '2030-01-07T12:00', disambiguation: null };
    const selections = ['p1', 'p2'].map(postKey => ({ postKey, channel: 'facebook' as const, publishingAccountId: 'revision-account', timeContext }));
    const save = (changes: Partial<Parameters<typeof scheduleApprovedWeek>[0]> = {}) => scheduleApprovedWeek({ ownerId: 'owner', actorId: 'owner', run: approvedRun, posts: original, assets: [], approvalId: original.approvalEvidence!.id, selections, now: new Date().toISOString(), ...changes }, store);
    const runs: BrandModelRun[] = ['post_review', 'post_editorial'].map(step => ({ id: randomUUID(), step, model: 'fixture', promptVersion: 'fixture-revision-review-v1', inputHash: reviewDigest({ step }), durationMs: 1, usage: {}, validationErrors: [] }));
    const reviewReason: BrandReasoner = async <T,>(call: BrandModelCall) => (call.step === 'post_review' ? { summary: 'Fixture factual review', issues: [] } : editorialFixture()) as T;
    const review = () => runPostRevision(pool, 'owner', revision.id, { reason: reviewReason, runs });
    return { pool, brandId, run: approvedRun, original, revision, input, after, save, store, selections, review, runs, reviewReason };
}
test('one approved channel has independent review/approval and atomic idempotent schedule replacement', async (t) => {
    const f = await fixture(t), old = await f.save(), before = (await f.store.listSchedules({ ownerId: 'owner', brandId: f.brandId }));
    await assert.rejects(async () => materializePostRevision(f.revision), /დამტკიცება/);
    await f.review();
    let revision = (await readPostRevision(f.pool, 'owner', f.revision.id))!;
    assert.equal(revision.status, 'ready', revision.error ?? '');
    assert.deepEqual(revision.batch.payload.copies.p2, f.original.payload.copies.p2);
    assert.deepEqual(revision.batch.payload.copies.p1!.variants[1], f.original.payload.copies.p1!.variants[1]);
    await assert.rejects(resolvePostRevision(f.pool, 'other', revision.id, 'approve', revision.updatedAt));
    await assert.rejects(resolvePostRevision(f.pool, 'owner', revision.id, 'approve', f.revision.updatedAt), /ვერსია შეიცვალა/);
    revision = await resolvePostRevision(f.pool, 'owner', revision.id, 'approve', revision.updatedAt);
    assert.notEqual(revision.batch.approvalEvidence!.id, f.original.approvalEvidence!.id);
    const unchanged = await readPlanningView(f.pool, 'owner', f.brandId, currentWeek());
    assert.deepEqual(unchanged.posts, f.original, 'original approval and every copy stay immutable');
    assert.deepEqual(await f.store.listSchedules({ ownerId: 'owner', brandId: f.brandId }), before, 'approval never silently replaces schedules');
    const selection = { ...f.selections[0]!, revisionId: revision.id }, p1 = old.find(s => s.postKey === 'p1')!, p2 = old.find(s => s.postKey === 'p2')!;
    await assert.rejects(f.save({ selections: [selection], revisions: [revision] }), /ვერსია შეიცვალა/);
    const [a, b] = await Promise.all([f.save({ selections: [selection], revisions: [revision], replaceInputIds: [p1.publicationInputId] }), f.save({ selections: [selection], revisions: [revision], replaceInputIds: [p1.publicationInputId] })]);
    assert.equal(a[0]!.schedule.id, b[0]!.schedule.id);
    assert.deepEqual((await f.store.listSchedules({ ownerId: 'owner', brandId: f.brandId })).find(s => s.schedule.id === p2.schedule.id), before.find(s => s.schedule.id === p2.schedule.id));
    const row = (await f.pool.query('SELECT bundle_version,bundle FROM social_publication_inputs WHERE id=$1', [a[0]!.publicationInputId])).rows[0];
    assert.equal(row.bundle_version, 4);
    const decoded = decodeSocialPublicationBundle('unda.social-publication-input', 4, row.bundle);
    assert.equal(decoded.draft.version, 2);
    const forged = structuredClone(row.bundle);
    forged.postRevision.channel = 'instagram';
    assert.throws(() => decodeSocialPublicationBundle('unda.social-publication-input', 4, forged));
    assert.equal((await f.pool.query('SELECT count(*)::int n FROM post_revisions')).rows[0].n, 1);
    await executeNote(f.pool, 'owner', f.input.id);
    assert.equal((await f.pool.query('SELECT count(*)::int n FROM post_revisions')).rows[0].n, 1);
});
test('expired revision reviewers are fenced and dismissal wins against late model completion', async (t) => {
    const f = await fixture(t), old = (await claimPostRevision(f.pool, 'owner', f.revision.id))!;
    assert.equal(await claimPostRevision(f.pool, 'owner', f.revision.id), null);
    await f.pool.query("UPDATE post_revisions SET lease_until=now()-interval '1 second' WHERE id=$1", [f.revision.id]);
    await f.review();
    const ready = (await readPostRevision(f.pool, 'owner', f.revision.id))!;
    assert.equal(ready.status, 'ready');
    assert.equal(await finishPostRevision(f.pool, f.revision.id, old.token, old.revision.batch.payload), false);
    const discarded = await resolvePostRevision(f.pool, 'owner', ready.id, 'discard', ready.updatedAt);
    assert.equal(discarded.status, 'discarded');
    await assert.rejects(resolvePostRevision(f.pool, 'owner', ready.id, 'approve', discarded.updatedAt));
});
test('changed selected text after acceptance is rejected before model work', async (t) => {
    const f = await fixture(t);
    const id = randomUUID();
    await enqueueNote(f.pool, 'owner', { ...f.input, id });
    await f.pool.query('UPDATE weekly_post_batches SET updated_at=now() WHERE run_id=$1', [f.run.id]);
    let calls = 0;
    const note = await executeNote(f.pool, 'owner', id, async <T,>() => { calls++; return {} as T; });
    assert.equal(note.status, 'failed');
    assert.equal(calls, 0);
});
test('a started attempt and unknown outcome preserve history and prohibit revision replacement', async (t) => {
    const f = await fixture(t), old = await f.save();
    await f.review();
    let revision = (await readPostRevision(f.pool, 'owner', f.revision.id))!;
    revision = await resolvePostRevision(f.pool, 'owner', revision.id, 'approve', revision.updatedAt);
    const now = '2030-01-07T08:01:00.000Z', due = (await f.store.claimDue(now, 3)).find(r => r.postKey === 'p1')!;
    const { resolveSocialContentPublishEligibility } = await import('../src/blueprints/social/content-publish-eligibility');
    const { assembleSocialContentPublishAttempt } = await import('../src/blueprints/social/content-publish-attempt');
    const { createIsoDateTime } = await import('../src/core/domain/primitives');
    const { PostgresSocialPublishStore } = await import('../src/infrastructure/postgres/social-publish-store');
    const { unknownResult } = await import('./social-delivery-fixture');
    const eligibility = resolveSocialContentPublishEligibility({ draft: due.bundle.draft, contentExecutionSpec: due.bundle.contentExecutionSpec, schedule: due.schedule, scheduleState: due.lifecycle, publishingAccount: due.publishingAccount, now: createIsoDateTime(now) });
    assert.equal(eligibility.eligible, true);
    if (!eligibility.eligible)
        throw Error('Fixture not eligible');
    const attempt = assembleSocialContentPublishAttempt({ id: due.attemptId, attemptNumber: due.attemptNumber, eligibility, attemptedAt: createIsoDateTime(now) }), publisher = new PostgresSocialPublishStore(f.pool);
    await publisher.claimAttempt(attempt);
    const replace = () => f.save({ selections: [{ ...f.selections[0]!, revisionId: revision.id }], revisions: [revision], replaceInputIds: [old.find(s => s.postKey === 'p1')!.publicationInputId] });
    await assert.rejects(replace(), /მცდელობა უკვე დაწყებულია/);
    await publisher.recordResult({ ...unknownResult(attempt), recordedAt: now } as never);
    await assert.rejects(replace(), /მცდელობა უკვე დაწყებულია/);
    const schedules = await f.store.listSchedules({ ownerId: 'owner', brandId: f.brandId });
    assert.equal(schedules.find(s => s.postKey === 'p1')!.delivery!.state, 'unknown');
    assert.equal((await f.pool.query('SELECT count(*)::int n FROM social_publication_inputs WHERE superseded_by_input_id IS NOT NULL')).rows[0].n, 0);
});
test('cancel/replacement races preserve one canonical outcome and stale queued publication cannot send', async (t) => {
    const f = await fixture(t), old = (await f.save()).find(s => s.postKey === 'p1')!;
    await f.review();
    let revision = (await readPostRevision(f.pool, 'owner', f.revision.id))!;
    revision = await resolvePostRevision(f.pool, 'owner', revision.id, 'approve', revision.updatedAt);
    const due = (await f.store.claimDue('2030-01-07T08:01:00.000Z', 3)).find(r => r.postKey === 'p1')!;
    await Promise.allSettled([f.store.changeSchedule({ ownerId: 'owner', brandId: f.brandId, scheduleId: old.schedule.id, operationId: 'op:revision-race', expectedRevision: 0, action: 'cancel', now: new Date().toISOString() }), f.save({ selections: [{ ...f.selections[0]!, revisionId: revision.id }], revisions: [revision], replaceInputIds: [old.publicationInputId] })]);
    const rows = await f.store.listSchedules({ ownerId: 'owner', brandId: f.brandId });
    assert.equal(rows.find(s => s.schedule.id === old.schedule.id)!.lifecycle.status, 'cancelled');
    assert.equal(rows.filter(s => s.postKey === 'p1' && s.lifecycle.status === 'scheduled').length, 1);
    const { runSocialPublishQueue } = await import('../src/application/publishing/run-publish-queue'), { PostgresSocialPublishStore } = await import('../src/infrastructure/postgres/social-publish-store'), { createIsoDateTime } = await import('../src/core/domain/primitives');
    let calls = 0;
    await runSocialPublishQueue({ publications: { claimDue: async () => [due] } as never, attempts: new PostgresSocialPublishStore(f.pool), publisherFor: () => async () => { calls++; throw Error('Unexpected send'); }, now: () => createIsoDateTime('2030-01-07T08:01:00.000Z'), maxAttempts: 3, unresolvedAttemptGraceMs: 60000 });
    assert.equal(calls, 0);
});
test('review conflicts name affected siblings, block approval and never rewrite them', async (t) => {
    const f = await fixture(t);
    const reason: BrandReasoner = async <T,>(call: BrandModelCall) => (call.step === 'post_review' ? { summary: 'Overlapping contribution', issues: [{ postKey: 'p2', severity: 'blocking', message: 'The new p1 text duplicates p2.' }] } : editorialFixture()) as T;
    await runPostRevision(f.pool, 'owner', f.revision.id, { reason, runs: f.runs });
    const revision = (await readPostRevision(f.pool, 'owner', f.revision.id))!;
    assert.equal(revision.status, 'needsChanges');
    assert.equal(revision.batch.payload.review!.issues[0]!.postKey, 'p2');
    await assert.rejects(resolvePostRevision(f.pool, 'owner', revision.id, 'approve', revision.updatedAt));
    assert.deepEqual(revision.batch.payload.copies.p2, f.original.payload.copies.p2);
    assert.deepEqual((await readPlanningView(f.pool, 'owner', f.brandId, currentWeek())).posts, f.original);
});
test('subsequent revisions inherit explicit post identity and preserve the original approval', async (t) => {
    const f = await fixture(t);
    await f.review();
    let first = (await readPostRevision(f.pool, 'owner', f.revision.id))!;
    first = await resolvePostRevision(f.pool, 'owner', first.id, 'approve', first.updatedAt);
    const input = { ...f.input, id: randomUUID(), context: { ...f.input.context, postRevisionId: first.id, postVersion: first.updatedAt, target: { ...f.input.context.target!, version: first.updatedAt } } };
    const after = structuredClone(first.batch.payload.copies.p1!);
    after.variants[0]!.caption = 'დაზიანების დეტალი მკაფიოდ გადაიღეთ და სრული ხედიც დაურთეთ.';
    const meaning: Interpretation = { statements: [{ quote: 'შეამოკლე.', meaning: 'ამ ვერსიის შესწორება', kind: 'draft_correction', scope: 'post', actionable: true }], response: 'მოვამზადებ.', clarification: '', action: 'revise_post', instruction: 'კიდევ შეამოკლე მხოლოდ არჩეული არხის ტექსტი.', ambiguous: false };
    const reason: BrandReasoner = async <T,>(call: BrandModelCall) => (call.step === 'contextual_notes' ? meaning : after) as T;
    await enqueueNote(f.pool, 'owner', input);
    await executeNote(f.pool, 'owner', input.id, reason);
    await executeNote(f.pool, 'owner', input.id);
    const second = (await readPostRevision(f.pool, 'owner', input.id))!;
    assert.ok(second, (await readNote(f.pool, 'owner', input.id)).message);
    assert.equal(second.stablePostId, first.stablePostId);
    assert.equal(second.parentRevisionId, first.id);
    assert.equal(second.version, 3);
    assert.equal(second.baseApprovalId, f.original.approvalEvidence!.id);
    assert.deepEqual(second.before, first.batch.payload);
    const stale = await enqueueNote(f.pool, 'owner', { ...f.input, id: randomUUID() });
    let calls = 0;
    await executeNote(f.pool, 'owner', stale.id, async <T,>() => { calls++; return {} as T; });
    assert.equal(calls, 0);
});

test('the bounded revision view retains current approved text beyond recent failures and isolates owners',async t=>{
 const f=await fixture(t);await f.review();let revision=(await readPostRevision(f.pool,'owner',f.revision.id))!;revision=await resolvePostRevision(f.pool,'owner',revision.id,'approve',revision.updatedAt)
 for(let i=0;i<25;i++){
  const id=randomUUID();await f.pool.query("INSERT INTO contextual_notes(id,owner_user_id,brand_id,context,raw_text,input_source,status) VALUES($1,'owner',$2,'{}','Fixture failure','text','answered')",[id,f.brandId])
  await f.pool.query(`INSERT INTO post_revisions(id,note_id,owner_user_id,brand_id,run_id,post_key,channel,stable_post_id,version,parent_revision_id,base_approval_id,base_digest,status,run_snapshot,before_payload,payload)
   SELECT $1,$1,owner_user_id,brand_id,run_id,post_key,channel,stable_post_id,$2,id,base_approval_id,base_digest,'failed',run_snapshot,before_payload,payload FROM post_revisions WHERE id=$3`,[id,i+3,revision.id])
 }
 const view=await listPostRevisions(f.pool,'owner',f.brandId,f.run.id);assert.equal(view.length,21);assert.ok(view.some(r=>r.id===revision.id&&r.status==='approved'))
 assert.deepEqual(await listPostRevisions(f.pool,'other',f.brandId,f.run.id),[])
})
