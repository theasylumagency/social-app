import {createIsoDateTime} from "../src/core/domain/primitives"
import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { socialDeliveryFixture } from './social-delivery-fixture';
import { subscribeFixture, strategicBrandFixture } from './strategic-integration-fixture';
import { currentWeek } from '../src/application/dashboard/model';
import { enqueueNote, executeNote, claimNote, retryNote, readNote } from '../src/infrastructure/postgres/contextual-notes-store';
import type { Interpretation, NoteContext } from '../src/application/contextual-notes/model';
import type { BrandReasoner } from '../src/infrastructure/models/brand-reasoning';
const meaning: Interpretation = { statements: [{ quote: 'რატომ?', meaning: 'მომხმარებელს განმარტება სურს', kind: 'question', scope: 'screen', actionable: false }], response: 'შენიშვნა შენახულია და განმარტება მომზადებულია.', clarification: '', action: 'none', instruction: '', ambiguous: false };
test('accepted notes survive lost replies and expired workers without duplicate execution', async (t) => {
    const { pool } = await socialDeliveryFixture(t);
    await subscribeFixture(pool, 'owner');
    const brandId = await strategicBrandFixture(pool);
    const context: NoteContext = { brandId, section: 'overview', week: currentWeek(), postKey: null, channel: null, runId: null };
    const input = { id: randomUUID(), text: 'რატომ?', source: 'text' as const, context };
    const note = await enqueueNote(pool, 'owner', input);
    assert.equal(note.status, 'queued');
    assert.equal((await enqueueNote(pool, 'owner', input)).id, note.id);
    await assert.rejects(enqueueNote(pool, 'owner', { ...input, text: 'სხვა ტექსტი' }), /სხვა ტექსტით/);
    await assert.rejects(enqueueNote(pool, 'other', input));
    let calls = 0, started!: () => void, release!: () => void;
    const began = new Promise<void>(resolve => { started = resolve; }), hold = new Promise<void>(resolve => { release = resolve; });
    const slow: BrandReasoner = async <T,>() => { calls++; started(); await hold; return meaning as T; };
    const stale = executeNote(pool, 'owner', input.id, slow);
    await began;
    assert.equal(await claimNote(pool, 'owner', input.id), null, 'a current worker cannot be stolen');
    await pool.query("UPDATE contextual_notes SET lease_until=now()-interval '1 second' WHERE id=$1", [input.id]);
    const recovered = await executeNote(pool, 'owner', input.id, async <T,>() => { calls++; return meaning as T; });
    assert.equal(recovered.status, 'answered');
    release();
    await stale;
    assert.equal((await readNote(pool, 'owner', input.id)).status, 'answered');
    assert.equal(calls, 2);
    await executeNote(pool, 'owner', input.id, slow);
    assert.equal(calls, 2, 'a completed request never reruns');
    const failed = await enqueueNote(pool, 'owner', { ...input, id: randomUUID() });
    await executeNote(pool, 'owner', failed.id, async () => { throw Error('offline'); });
    assert.equal((await readNote(pool, 'owner', failed.id)).status, 'failed');
    assert.equal((await retryNote(pool, 'owner', failed.id)).id, failed.id);
    assert.equal((await executeNote(pool, 'owner', failed.id, async <T,>() => meaning as T)).status, 'answered');
    await pool.query('UPDATE contextual_notes SET attempts=3 WHERE id=$1', [input.id]);
    assert.equal((await readNote(pool, 'owner', input.id)).status, 'answered', 'history is never fabricated as failed by elapsed time');
});

test('same-request retries are bounded and never create a new ledger entry',async t=>{
 const {pool}=await socialDeliveryFixture(t);await subscribeFixture(pool,'owner');const brandId=await strategicBrandFixture(pool)
 const input={id:randomUUID(),text:'რატომ?',source:'text' as const,context:{brandId,section:'overview' as const,week:currentWeek(),postKey:null,channel:null,runId:null}}
 await enqueueNote(pool,'owner',input);const fail:BrandReasoner=async()=>{throw Error('offline')};await executeNote(pool,'owner',input.id,fail)
 for(let i=0;i<3;i++){await retryNote(pool,'owner',input.id);await executeNote(pool,'owner',input.id,fail)}
 await assert.rejects(retryNote(pool,'owner',input.id),/ლიმიტი ამოიწურა/)
 assert.equal((await pool.query('SELECT count(*)::int n FROM contextual_notes')).rows[0].n,1)
})

test('channel policy cancels only unsent schedules and preserves a known published attempt',async t=>{
 const {pool}=await socialDeliveryFixture(t);await subscribeFixture(pool,'owner')
 const {attempt,prepareSchedule,unknownResult}=await import('./social-delivery-fixture'),{PostgresSocialPublishStore}=await import('../src/infrastructure/postgres/social-publish-store')
 const sent={...attempt(),publishAt:createIsoDateTime('2030-01-07T08:00:00.000Z'),attemptedAt:createIsoDateTime('2030-01-07T08:01:00.000Z')},unsent={...attempt(),publishAt:createIsoDateTime('2030-01-08T08:00:00.000Z'),attemptedAt:createIsoDateTime('2030-01-08T08:01:00.000Z')}
 await prepareSchedule(pool,sent);await prepareSchedule(pool,unsent)
 const store=new PostgresSocialPublishStore(pool);await store.claimAttempt(sent)
 const outcome=unknownResult(sent);if(outcome.status==='published')throw Error('Unexpected fixture outcome')
 const {errorCode,...base}=outcome;void errorCode
 await store.recordResult({...base,status:'published',providerPublicationRef:'fixture-publication',publishedAt:sent.attemptedAt,recordedAt:sent.attemptedAt} as never)
 const text='Facebook ამოვიღოთ.',interpretation:Interpretation={statements:[{quote:text,meaning:'Facebook აღარ არის სამუშაო არხი',kind:'channel_policy',scope:'channel',actionable:true}],response:'შედეგს გადავამოწმებთ.',clarification:'',action:'set_channel_policy',instruction:'Facebook აღარ გამოვიყენოთ.',ambiguous:false}
 const input={id:randomUUID(),text,source:'text' as const,context:{brandId:'brand',section:'connections' as const,week:currentWeek(),postKey:null,channel:null,runId:null}}
 await enqueueNote(pool,'owner',input);await executeNote(pool,'owner',input.id,async<T,>()=>interpretation as T)
 const {applyNote}=await import('../src/infrastructure/postgres/contextual-notes-store')
 const applied=await applyNote(pool,'owner',input.id,true);assert.equal(applied.status,'applied')
 const events=(await pool.query('SELECT schedule_id FROM social_content_schedule_events')).rows;assert.deepEqual(events.map(row=>row.schedule_id),[unsent.scheduleId])
 assert.equal((await pool.query('SELECT status FROM social_publish_results')).rows[0].status,'published')
 assert.match(applied.message,/დაწყებული გაგზავნის ჩანაწერი ისტორიაში/)
})
