import assert from "node:assert/strict"
import test from "node:test"
import { clearAcceptedNoteDraft, clearWorkspaceDrafts, noteDraftKey, readNoteDraft, saveNoteDraft, type NoteDraft } from "../src/app/workspace/note-draft"
function storage() {
  const data = new Map<string, string>()
  return { get length() { return data.size }, key: (i: number) => [...data.keys()][i] ?? null, getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => { data.set(key, value) }, removeItem: (key: string) => { data.delete(key) } }
}
const now = Date.now()
const draft: NoteDraft = { version: 1, ownerId: "owner", brandId: "brand", section: "content", week: "2026-10-05", text: "შერჩეული პოსტის შესწორება", source: "voice", selection: { title: "Post", target: { type: "post", id: "p1:facebook", label: "Post", version: "version-1", hash: "hash", data: { postKey: "p1" } }, postKey: "p1", channel: "facebook", runId: "run", postVersion: "version-1" }, requestId: "11111111-1111-4111-8111-111111111111", updatedAt: now }
test("draft restoration preserves transcript, selected version and retry identity with owner/context isolation", () => {
  const local = storage(); saveNoteDraft(local, draft)
  assert.deepEqual(readNoteDraft(local, draft, now), draft)
  for (const scope of [{ ...draft, ownerId: "other" }, { ...draft, brandId: "other" }, { ...draft, week: "2026-10-12" }, { ...draft, section: "week" as const }]) assert.equal(readNoteDraft(local, scope, now), null)
  // A copied value under a different owner's key is rejected too.
  local.setItem(noteDraftKey({ ...draft, ownerId: "other" }), JSON.stringify(draft))
  assert.equal(readNoteDraft(local, { ...draft, ownerId: "other" }, now), null)
  assert.equal(readNoteDraft(local, draft, now + 31 * 86400_000), null)
  saveNoteDraft(local, { ...draft, text: "" }); assert.equal(readNoteDraft(local, draft, now), null)
})
test("logout clears private workspace drafts, retains other settings, and storage denial is harmless", () => {
  const local = storage(); saveNoteDraft(local, draft)
  local.setItem("unda-weekly-draft-v1:owner:brand", "priority"); local.setItem("theme", "dark")
  clearWorkspaceDrafts(local)
  assert.equal(local.length, 1); assert.equal(local.getItem("theme"), "dark")
  const denied = { getItem() { throw Error("denied") }, setItem() { throw Error("denied") }, removeItem() { throw Error("denied") } }
  assert.equal(readNoteDraft(denied, draft), null)
  assert.doesNotThrow(() => saveNoteDraft(denied, draft))
})

test("acknowledgement clears only the accepted request, preserves another tab's newer draft and tolerates denied storage",()=>{
 const local=storage();saveNoteDraft(local,draft)
 clearAcceptedNoteDraft(local,draft,'22222222-2222-4222-8222-222222222222');assert.deepEqual(readNoteDraft(local,draft,now),draft)
 clearAcceptedNoteDraft(local,draft,draft.requestId!);assert.equal(readNoteDraft(local,draft,now),null)
 saveNoteDraft(local,draft)
 const denied={getItem:local.getItem,removeItem(){throw Error('denied')}}
 assert.doesNotThrow(()=>clearAcceptedNoteDraft(denied,draft,draft.requestId!))
})
