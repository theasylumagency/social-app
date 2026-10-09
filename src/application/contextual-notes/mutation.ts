import type { Decision, Interpretation, NoteEntry } from './model';
import type { NoteSnapshot } from './workflow';
export type PreparedNoteMutation = {
    status: NoteEntry['status'];
    decision: Decision | null;
    snapshot: NoteSnapshot | null;
    interpretation: Interpretation | null;
};
export type NoteMutationCommand = {
    action: Exclude<Decision['action'], 'none' | 'unsupported'>;
    snapshot: NoteSnapshot;
    instruction: string;
};
/** Application policy owns which effect is allowed; adapters commit that effect and its ledger atomically. */
export async function applyPreparedNote<T>(note: PreparedNoteMutation, authorization: {
    confirmed: boolean;
    leasedAutomatic: boolean;
}, commit: (command: NoteMutationCommand) => Promise<T>) {
    if (note.status !== (authorization.leasedAutomatic ? 'processing' : 'proposed') || !note.decision || !note.snapshot || !note.interpretation)
        throw Error('ამ შენიშვნას დასადასტურებელი ცვლილება არ აქვს.');
    if (note.decision.mode === 'confirm' && !authorization.confirmed)
        throw Error('ჯერ გადაამოწმეთ და დაადასტურეთ ცვლილების შედეგი.');
    if (!['apply', 'confirm'].includes(note.decision.mode) || note.decision.action === 'none' || note.decision.action === 'unsupported')
        throw Error('ცვლილება არ არის დაშვებული.');
    return commit({ action: note.decision.action, snapshot: note.snapshot, instruction: note.interpretation.instruction });
}
