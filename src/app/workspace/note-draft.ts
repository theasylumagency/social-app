import type { DashboardSection } from "../../application/dashboard/model"
import type { NoteTarget } from "../../application/contextual-notes/model"

export type NoteDraftSelection = { title: string; target: NoteTarget; postKey: string | null; channel: "facebook" | "instagram" | null; runId: string | null; postVersion: string | null; postRevisionId?:string|null }
export type NoteDraftScope = { ownerId: string; brandId: string; section: DashboardSection; week: string }
export type NoteDraft = NoteDraftScope & { version: 1; text: string; source: "text" | "voice"; selection: NoteDraftSelection | null; requestId: string | null; updatedAt: number }
const prefix = "unda-note-draft-v1:"
export const noteDraftKey = (scope: NoteDraftScope) => prefix + [scope.ownerId, scope.brandId, scope.section, scope.week].map(encodeURIComponent).join(":")
export function browserDraftStorage(): Storage | null { try { return window.localStorage } catch { return null } }

/** Restoration carries the exact selected target and retry identity; the server rechecks authority. */
export function readNoteDraft(storage: Pick<Storage, "getItem"> | null, scope: NoteDraftScope, now = Date.now()): NoteDraft | null {
  if (!storage) return null
  try {
    const raw = storage.getItem(noteDraftKey(scope))
    if (!raw || raw.length > 40_000) return null
    const d = JSON.parse(raw) as NoteDraft
    if (d.version !== 1 || (["ownerId", "brandId", "section", "week"] as const).some(k => d[k] !== scope[k])
      || typeof d.text !== "string" || !d.text.trim() || d.text.length > 8000 || !["text", "voice"].includes(d.source)
      || typeof d.updatedAt !== "number" || !Number.isFinite(d.updatedAt) || d.updatedAt > now + 60_000 || now - d.updatedAt > 30 * 86400_000
      || (d.requestId !== null && (typeof d.requestId !== "string" || !/^[a-f0-9-]{36}$/iu.test(d.requestId)))) return null
    if (d.selection !== null) {
      const s = d.selection
      if(s.postRevisionId!=null&&(typeof s.postRevisionId!=="string"||! /^[a-f0-9-]{36}$/iu.test(s.postRevisionId)))return null
      if (!s || typeof s.title !== "string" || !s.target || typeof s.target.id !== "string" || typeof s.target.type !== "string" || typeof s.target.hash !== "string" || typeof s.target.version !== "string" || !s.target.data || typeof s.target.data !== "object"
        || [s.postKey, s.runId, s.postVersion].some(v => v !== null && typeof v !== "string") || (s.channel !== null && !["facebook", "instagram"].includes(s.channel))) return null
    }
    return d
  } catch { return null }
}
export function saveNoteDraft(storage: Pick<Storage, "setItem" | "removeItem"> | null, draft: NoteDraft) {
  if (!storage) return
  try {
    const key = noteDraftKey(draft)
    if (!draft.text.trim()) storage.removeItem(key)
    else storage.setItem(key, JSON.stringify(draft))
  } catch { /* Unavailable storage must never prevent entering or sending a note. */ }
}
export function clearWorkspaceDrafts(storage: Pick<Storage, "length" | "key" | "removeItem"> | null) {
  if (!storage) return
  try {
    for (let i = storage.length - 1; i >= 0; i--) {
      const key = storage.key(i)
      if (key?.startsWith(prefix) || key?.startsWith("unda-weekly-draft-v1:")) storage.removeItem(key)
    }
  } catch { /* Logout remains available when browser storage is restricted. */ }
}

export function clearAcceptedNoteDraft(storage:Pick<Storage,'getItem'|'removeItem'>|null,scope:NoteDraftScope,requestId:string) {try {if(readNoteDraft(storage,scope)?.requestId===requestId)storage?.removeItem(noteDraftKey(scope))}catch{/* A stored server acceptance remains successful when browser storage is unavailable. */}}
