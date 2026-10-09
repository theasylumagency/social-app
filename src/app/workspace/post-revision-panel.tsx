"use client";
import { useRef, useState } from 'react';
import type { PlanningRun } from '../../blueprints/social/weekly-planning/model';
import type { PostRevisionView } from '../../application/post-revisions/model';
import { PostNoteButton } from './contextual-notes';
import { approvedTargetRevision } from './social-schedule-model';
const labels: Record<PostRevisionView['status'], string> = { queued: 'შენახულია · შეფასების რიგშია', running: 'ტექსტს ვამოწმებთ', ready: 'შეფასებულია · დასამტკიცებელია', needsChanges: 'საჭიროა დაზუსტება', approved: 'დამტკიცებულია', discarded: 'არ გამოვიყენებთ', failed: 'შეფასება ვერ დასრულდა' };
const body = (variant: PostRevisionView['after']) => [variant.caption, ...variant.frames.map(f => [f.heading, f.body].filter(Boolean).join('\n')), variant.script, ...variant.onScreenText].filter(Boolean).join('\n\n');
export function PostRevisionPanel({ run, revisions, readOnly, onChanged }: {
    run: PlanningRun;
    revisions: PostRevisionView[];
    readOnly: boolean;
    onChanged: () => Promise<unknown>;
}) {
    const [busy, setBusy] = useState(false), [message, setMessage] = useState(''), [confirm, setConfirm] = useState<string | null>(null);
    const pending = useRef(false);
    async function decide(revision: PostRevisionView, action: 'approve' | 'discard' | 'retry') {
        if (pending.current)
            return;
        pending.current = true;
        setBusy(true);
        setMessage('');
        let saved = false;
        try {
            const result = await fetch('/api/post-revisions', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: revision.id, updatedAt: revision.updatedAt, action }) });
            if (!result.ok) {
                const data = await result.json();
                throw Error(data.message);
            }
            saved = true;
            await onChanged();
            setConfirm(null);
            setMessage(action === 'approve' ? 'ახალი ტექსტი დამტკიცებულია. განრიგში მისით ჩანაცვლება ცალკე გადაამოწმეთ.' : action === 'discard' ? 'ეს შესწორება არ შესრულდება.' : 'შეფასება ხელახლა დაიწყო.');
        }
        catch (e) {
            setMessage(saved ? 'მოქმედება შენახულია. განაახლეთ სტატუსი.' : e instanceof Error ? e.message : 'მოქმედება ვერ დასრულდა.');
        }
        finally {
            pending.current = false;
            setBusy(false);
        }
    }
    if (!revisions.length)
        return null;
    return <div className="pr-panel" aria-label="პოსტების შესწორებები"><h3>პოსტების ახალი ვერსიები</h3><p>იცვლება მხოლოდ არჩეული არხის ტექსტი. დამტკიცება განრიგს ავტომატურად არ ცვლის.</p>{message ? <p role="status">{message}</p> : null}
 {revisions.map(revision => <details key={revision.id} id={`post-revision-${revision.id}`} open={['ready', 'needsChanges', 'failed'].includes(revision.status)}><summary>პოსტი {revision.postKey.slice(1)} · {revision.channel === 'facebook' ? 'Facebook' : 'Instagram'} · ვერსია {revision.version} · {labels[revision.status]}</summary><div className="pr-diff"><div><h4>წინა ტექსტი</h4><p>{body(revision.before)}</p></div><div><h4>ახალი ტექსტი</h4><p>{body(revision.after)}</p></div></div>
 {revision.error ? <p role="alert">{revision.error}</p> : null}{revision.issues.length ? <ul>{revision.issues.map((issue, index) => <li key={index}>პოსტი {issue.postKey.slice(1)} · {issue.message}</li>)}</ul> : null}
 {!readOnly ? <div className="pr-actions">{revision.status === 'ready' ? (confirm === revision.id ? <><p>ამტკიცებთ ამ არხის ახალ ტექსტს. განრიგის ჩანაცვლებას შემდეგ ცალკე აირჩევთ.</p><button type="button" disabled={busy} onClick={() => void decide(revision, 'approve')}>ახალი ტექსტის დამტკიცების დადასტურება</button><button type="button" disabled={busy} onClick={() => setConfirm(null)}>ჯერ არა</button></> : <button type="button" disabled={busy} onClick={() => setConfirm(revision.id)}>ახალი ტექსტის დამტკიცება</button>) : null}
 {!['approved', 'discarded'].includes(revision.status) ? <button type="button" disabled={busy} onClick={() => void decide(revision, 'discard')}>ეს შესწორება არ გამოვიყენოთ</button> : null}
 {revision.status === 'failed' ? <button type="button" disabled={busy} onClick={() => void decide(revision, 'retry')}>შეფასების ხელახლა ცდა</button> : null}
 {revision.status === 'approved' && approvedTargetRevision(revisions, revision.postKey, revision.channel)?.id === revision.id ? <PostNoteButton runId={run.id} postKey={revision.postKey} channel={revision.channel} title={revision.batchTitle ?? `პოსტი ${revision.postKey.slice(1)}`} postVersion={revision.updatedAt} postRevisionId={revision.id}/> : null}</div> : null}</details>)}
 </div>;
}
