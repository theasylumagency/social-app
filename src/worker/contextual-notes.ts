import type { Pool } from 'pg';
import { executeNote } from '../infrastructure/postgres/contextual-notes-store';
export async function runContextualNote(pool: Pool, ownerId: string, id: string) {
    return executeNote(pool, ownerId, id);
}
