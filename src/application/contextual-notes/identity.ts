import { createHash } from 'node:crypto';
export const noteDigest = (value: unknown) => createHash('sha256').update(JSON.stringify(value, (_key, v: unknown) => v && typeof v === 'object' && !Array.isArray(v) ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)) : v) ?? 'undefined').digest('hex');
