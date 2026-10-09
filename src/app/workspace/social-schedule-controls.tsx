"use client"
import {PostRevisionPanel} from "./post-revision-panel"
import {approvedTargetRevision} from "./social-schedule-model"


import { useEffect, useRef, useState } from "react"
import type { PlanningRun } from "../../blueprints/social/weekly-planning/model"
import type { PostsBatch, PostAsset } from "../../blueprints/social/weekly-planning/posts"
import { localScheduleTime, resolveScheduleTime, scheduleTimeCandidates, suggestedScheduleTime, type ScheduleTimeContext } from "../../application/publishing/schedule-time"
import { replacementInputs, scheduleMutable, scheduleRows, scheduleStatus, type SavedSchedule, type ScheduleSnapshot } from "./social-schedule-model"

type Draft = { selected: boolean; accountId: string; local: string; disambiguation: "earlier" | "later" | null }
const names = { facebook: "Facebook", instagram: "Instagram" }
async function snapshot(brandId: string, runId: string, signal?: AbortSignal): Promise<ScheduleSnapshot> {
  const response = await fetch(`/api/social/schedules?brandId=${encodeURIComponent(brandId)}&runId=${encodeURIComponent(runId)}`, { cache: "no-store", ...(signal ? { signal } : {}) })
  const data = await response.json()
  if (!response.ok) throw Error(data.message ?? "განრიგის მონაცემები დროებით ვერ ჩაიტვირთა.")
  return data
}
function TimeChoice({ value, zone, disabled, onChange }: { value: Draft; zone: string; disabled: boolean; onChange: (update: Partial<Draft>) => void }) {
  let candidates: string[] = [], error = ""
  try { candidates = scheduleTimeCandidates(value.local, zone); if (!candidates.length) error = "ეს საათი ამ სარტყელში არ არსებობს; აირჩიეთ სხვა დრო." }
  catch (e) { error = e instanceof Error ? e.message : "დრო არასწორია." }
  return <><label>თარიღი და დრო · {zone}<input type="datetime-local" value={value.local} disabled={disabled} onInput={e => onChange({ local: e.currentTarget.value, disambiguation: null })} onChange={e => onChange({ local: e.target.value, disambiguation: null })} /></label>
    {candidates.length > 1 ? <label>ეს საათი ორჯერ გვხვდება<select value={value.disambiguation ?? ""} disabled={disabled} onChange={e => onChange({ disambiguation: e.target.value ? e.target.value as "earlier" | "later" : null })}><option value="">აირჩიეთ რომელი</option><option value="earlier">პირველი · {candidates[0]?.slice(11, 16)} UTC</option><option value="later">მეორე · {candidates.at(-1)?.slice(11, 16)} UTC</option></select></label> : null}
    {error ? <small className="ws-blocker">{error}</small> : null}</>
}
function SavedRow({ item, title, account, zone, busy, readOnly, onChange }: { item: SavedSchedule; title: string; account: string; zone: string; busy: boolean; readOnly: boolean;
  onChange: (item: SavedSchedule, context?: ScheduleTimeContext) => Promise<void> }) {
  const instant = item.lifecycle.publishAt ?? item.lifecycle.lastPublishAt ?? item.schedule.publishAt
  const [draft, setDraft] = useState<Draft>(() => ({ selected: false, accountId: account, local: localScheduleTime(instant, zone), disambiguation: null }))
  const [confirmCancel, setConfirmCancel] = useState(false)
  const mutable = !readOnly && scheduleMutable(item)
  return <article className="ws-saved-row"><div><strong>{title}</strong><p>{names[item.schedule.channel]} · {account} · ტექსტის ვერსია {item.schedule.draftVersion}</p><p><time dateTime={instant}>{localScheduleTime(instant, zone).replace("T", " · ")}</time> · {zone}</p>
    <span className="ws-status">{scheduleStatus(item)}</span>{item.timeContext ? <small>შენახული სარტყელი: {item.timeContext.timeZone}</small> : <small>ძველ ჩანაწერში საწყისი სარტყელი არ არის შენახული.</small>}
    {(item.delivery?.attemptCount ?? 0) > 0 ? <small>დროის შეცვლა და გაუქმება მიუწვდომელია გაგზავნის დაწყების შემდეგ. შედეგი ნახეთ გამოქვეყნების სტატუსში.</small> : null}</div>
    {mutable ? <details><summary>დროის შეცვლა ან გაუქმება</summary><div className="ws-change"><TimeChoice value={draft} zone={zone} disabled={busy} onChange={u => setDraft(d => ({ ...d, ...u }))} />
      <button type="button" className="wp-button wp-button--secondary" disabled={busy} onClick={() => void onChange(item, { timeZone: zone, localDateTime: draft.local, disambiguation: draft.disambiguation })}>დროის ცვლილების შენახვა</button>
      {confirmCancel ? <div className="ws-cancel"><p>ამ ჩანაწერის დაგეგმილი გაგზავნა გაუქმდება.</p><button type="button" disabled={busy} onClick={() => void onChange(item)}>გაუქმების დადასტურება</button><button type="button" disabled={busy} onClick={() => setConfirmCancel(false)}>დატოვება</button></div> : <button type="button" className="ws-link" disabled={busy} onClick={() => setConfirmCancel(true)}>განრიგიდან გაუქმება</button>}
    </div></details> : null}</article>
}
export function SocialScheduleControls({ run, batch, assets, readOnly = false }: { run: PlanningRun; batch: PostsBatch; assets: PostAsset[]; readOnly?: boolean }) {
  const approvalId = batch.approvalEvidence?.id, outline = batch.payload.outline
  const [data, setData] = useState<ScheduleSnapshot | null>(null)
  const [zone, setZone] = useState("Asia/Tbilisi"), [zoneInput, setZoneInput] = useState("Asia/Tbilisi")
  const [drafts, setDrafts] = useState<Record<string, Draft>>({})
  const [loading, setLoading] = useState(true), [busy, setBusy] = useState(false), [reviewing, setReviewing] = useState(false)
  const [message, setMessage] = useState(""), [conflict, setConflict] = useState(false)
  const pending = useRef(false), operation = useRef<{ signature: string; id: string } | null>(null)
  useEffect(() => {
    const controller = new AbortController()
    snapshot(run.brandId, run.id, controller.signal).then(value => {
      setData(value); setLoading(false); setDrafts({}); setReviewing(false); setConflict(false)
    }).catch(e => { if (!controller.signal.aborted) { setLoading(false); setMessage(e instanceof Error ? e.message : "განრიგი ვერ ჩაიტვირთა.") } })
    return () => controller.abort()
  }, [run.brandId, run.id, approvalId])
  const approved = run.status === "approved" && batch.status === "ready" && Boolean(batch.approvedAt && approvalId)
  const rows = scheduleRows(batch, assets, approved)
  const revisions=data?.revisions??[]
  const revisionPending=revisions.some(r=>r.status==='queued'||r.status==='running')
  useEffect(()=>{
    const controller=new AbortController()
    const refresh=()=>{snapshot(run.brandId,run.id,controller.signal).then(value=>{if(!controller.signal.aborted)setData(value)}).catch(()=>{})}
    window.addEventListener('unda:notes-changed',refresh)
    const timer=revisionPending?setInterval(refresh,document.visibilityState==='hidden'?10000:4000):undefined
    return()=>{controller.abort();window.removeEventListener('unda:notes-changed',refresh);clearInterval(timer)}
  },[run.brandId,run.id,revisionPending])
  function rowApproval(row:{postKey:string;channel:'facebook'|'instagram'}) {return approvedTargetRevision(revisions,row.postKey,row.channel)?.approvalId??approvalId}
  function draftFor(row: typeof rows[number]): Draft {
    return drafts[row.key] ?? { selected: false, accountId: "", local: suggestedScheduleTime(run.week, row.post.dayOffset, zone, data?.capturedAt ?? run.updatedAt), disambiguation: null }
  }
  function update(row: typeof rows[number], change: Partial<Draft>) {
    setDrafts(prev => ({ ...prev, [row.key]: { ...(prev[row.key] ?? draftFor(row)), ...change } })); setReviewing(false)
  }
  function blockers(row: typeof rows[number], d: Draft) {
    const reasons = [...row.reasons]
    if (!data?.accounts.some(a => a.id === d.accountId && a.channel === row.channel && a.connected && a.canPublish)) reasons.push("აირჩიეთ დაკავშირებული ანგარიში.")
    if (data?.schedules.some(s => !s.supersededByInputId && s.approvalId === rowApproval(row) && s.postKey === row.postKey && s.schedule.channel === row.channel && s.publishingAccountId === d.accountId)) reasons.push("ამ ანგარიშის განრიგი უკვე არსებობს; გამოიყენეთ შენახული ჩანაწერი.")
    if (data?.schedules.some(s => !s.supersededByInputId && s.approvalId !== rowApproval(row) && s.postKey === row.postKey && s.schedule.channel === row.channel && (s.delivery?.attemptCount ?? 0) > 0)) reasons.push("წინა ვერსიის გაგზავნა უკვე დაწყებულია; მისი ჩანაცვლება შეუძლებელია.")
    try { if (Date.parse(resolveScheduleTime({ timeZone: zone, localDateTime: d.local, disambiguation: d.disambiguation })) <= Date.parse(data?.capturedAt ?? run.updatedAt)) reasons.push("აირჩიეთ მომავალი დრო.") }
    catch (e) { reasons.push(e instanceof Error ? e.message : "მიუთითეთ დრო.") }
    return reasons
  }
  const selected = rows.filter(r => draftFor(r).selected)
  const replacements = [...new Set(selected.flatMap(row=>replacementInputs(data?.schedules??[],rowApproval(row)??"",[row])))]
  async function reload() {
    setLoading(true)
    try { setData(await snapshot(run.brandId, run.id)); setConflict(false) }
    finally { setLoading(false) }
  }
  async function refresh() { try { await reload(); setReviewing(false); setMessage("განრიგის მიმდინარე სტატუსი განახლებულია. გადაამოწმეთ არჩევანი.") } catch { setMessage("განრიგის სტატუსი დროებით ვერ განახლდა.") } }
  async function send(method: "POST" | "PATCH" | "DELETE", payload: Record<string, unknown>) {
    if (pending.current) return
    pending.current = true; setBusy(true); setMessage(""); setConflict(false)
    let confirmed = false, received = false
    try {
      const response = await fetch("/api/social/schedules", { method, headers: { "content-type": "application/json" }, body: JSON.stringify(payload) })
      received = true
      if (!response.ok) { setConflict(response.status === 409); const error = await response.json().catch(() => ({ message: "სერვერის პასუხი დროებით მიუწვდომელია. განაახლეთ სტატუსი." })); throw Error(error.message ?? "განრიგი ვერ შეინახა.") }
      confirmed = true
      await reload(); setReviewing(false)
      if (method === "POST") setDrafts({})
      setMessage(method === "POST" ? "არჩეული ჯგუფის განრიგი შენახულია." : method === "DELETE" ? "დაგეგმილი გაგზავნა გაუქმებულია." : "გამოქვეყნების ახალი დრო შენახულია.")
    } catch (e) { setMessage(confirmed ? "ცვლილება შენახულია, მაგრამ სტატუსი ვერ განახლდა. განაახლეთ განრიგი." : !received ? "სერვერის პასუხი ვერ მივიღეთ. განაახლეთ სტატუსი ან გაიმეორეთ იგივე მოთხოვნა." : e instanceof Error ? e.message : "განრიგი ვერ შეინახა.") }
    finally { pending.current = false; setBusy(false) }
  }
  async function save() {
    if (!data || !approvalId || !selected.length || pending.current) return
    const invalid = selected.flatMap(r => blockers(r, draftFor(r)))
    if (invalid.length) { setMessage(invalid[0]!); setReviewing(false); return }
    const selections = selected.map(r => ({ ...(approvedTargetRevision(revisions,r.postKey,r.channel)?{revisionId:approvedTargetRevision(revisions,r.postKey,r.channel)!.id}:{}),postKey: r.postKey, channel: r.channel, publishingAccountId: draftFor(r).accountId,
      timeContext: { timeZone: zone, localDateTime: draftFor(r).local, disambiguation: draftFor(r).disambiguation } }))
    await send("POST", { brandId: run.brandId, runId: run.id, approvalId, selections, replaceInputIds: replacements })
  }
  async function change(item: SavedSchedule, timeContext?: ScheduleTimeContext) {
    if (pending.current) return
    if (timeContext) { try { if (Date.parse(resolveScheduleTime(timeContext)) <= Date.parse(data?.capturedAt ?? run.updatedAt)) throw Error("აირჩიეთ მომავალი დრო.") } catch (e) { setMessage(e instanceof Error ? e.message : "დრო არასწორია."); return } }
    const payload = { brandId: run.brandId, scheduleId: item.schedule.id, expectedRevision: item.lifecycle.revision, ...(timeContext ? { timeContext } : {}) }
    const signature = JSON.stringify(payload)
    if (operation.current?.signature !== signature) operation.current = { signature, id: crypto.randomUUID() }
    await send(timeContext ? "PATCH" : "DELETE", { ...payload, operationId: operation.current.id })
  }
  function applyZone() {
    try { localScheduleTime(data?.capturedAt ?? run.updatedAt, zoneInput); setZone(zoneInput); setDrafts({}); setReviewing(false); setMessage("სარტყელი შეიცვალა. შეთავაზებული დროები თავიდან გადაამოწმეთ.") }
    catch (e) { setMessage(e instanceof Error ? e.message : "სარტყელი არასწორია.") }
  }
  if (!outline) return null
  return <section className="ws-panel" aria-label="კვირის გამოქვეყნების განრიგი" aria-busy={busy || loading}><div className="ws-heading"><div><h2>კვირის განრიგი</h2><p>პოსტები, ანგარიშები და ზუსტი დრო ერთ სივრცეში.</p></div><button type="button" className="ws-link" disabled={busy || loading} onClick={() => void refresh()}>სტატუსის განახლება</button></div>
    <PostRevisionPanel run={run} revisions={revisions} readOnly={readOnly} onChanged={reload} />
    <div className="ws-zone"><label>დროის სარტყელი<input list={`zones-${run.id}`} value={zoneInput} disabled={busy} onChange={e => setZoneInput(e.target.value)} /></label><datalist id={`zones-${run.id}`}><option value="Asia/Tbilisi" /><option value="Europe/Berlin" /><option value="America/New_York" /><option value="UTC" /></datalist><button type="button" disabled={busy || zoneInput === zone} onClick={applyZone}>სარტყლის გამოყენება</button></div>
    {loading ? <p role="status">განრიგის მონაცემები იტვირთება…</p> : null}
    {message ? <p className="ws-message" role={conflict ? "alert" : "status"}>{message}</p> : null}
    {!readOnly ? <><p className="ws-note">12:00 საწყისი შეთავაზებაა. დრო გადაამოწმეთ და თავად აირჩიეთ გამოსაქვეყნებელი პოსტები. არჩეული ჯგუფი მთლიანად შეინახება ან არცერთი ახალი ჩანაწერი არ დაემატება.</p><p className="ws-version">გეგმის ვერსია {run.version} · {batch.approvedAt ? `დამტკიცებულია ${localScheduleTime(batch.approvedAt, zone).replace("T", " · ")} (${zone})` : "ტექსტები ჯერ არ არის დამტკიცებული"}</p>
      <div className="ws-rows">{rows.map(row => {
        const d = draftFor(row), choices = (data?.accounts ?? []).filter(a => a.channel === row.channel && a.connected && a.canPublish), reasons = blockers(row, d)
        return <article className="ws-row" key={row.key}><div className="ws-post"><label className="ws-select"><input type="checkbox" checked={d.selected} disabled={busy || loading || readOnly || !data || (!d.selected && reasons.length > 0)} onChange={e => update(row, { selected: e.target.checked })} /><strong>{row.post.title}</strong></label><span>{names[row.channel]} · {row.postKey.toUpperCase()}</span><small>ვიზუალი: {row.post.format === "text" ? "არ სჭირდება" : row.media}</small>{approvedTargetRevision(revisions,row.postKey,row.channel) ? <a href={`#post-revision-${approvedTargetRevision(revisions,row.postKey,row.channel)!.id}`}>ახალი ტექსტი · ვერსია {approvedTargetRevision(revisions,row.postKey,row.channel)!.version}</a> : <a href={`#post-${row.postKey.slice(1)}`}>ტექსტის ნახვა</a>}</div>
          <div className="ws-fields"><label>ანგარიში<select value={d.accountId} disabled={busy || loading || !data} onChange={e => update(row, { accountId: e.target.value, selected: false })}><option value="">აირჩიეთ ანგარიში</option>{choices.map(a => <option value={a.id} key={a.id}>{a.name}</option>)}</select></label><TimeChoice value={d} zone={zone} disabled={busy || loading || !data} onChange={u => update(row, u)} /></div>
          {reasons.length ? <div className="ws-blockers">{[...new Set(reasons)].map(r => <small key={r}>{r}</small>)}</div> : <small className="ws-ready">მზადაა ასარჩევად</small>}
        </article>
      })}</div>
      {selected.length ? <div className="ws-review"><p>არჩეულია {selected.length} ჩანაწერი · დროის სარტყელი: {zone}</p>{replacements.length ? <p>ახალი დამტკიცების შენახვა არჩეულ პოსტებსა და არხებზე წინა ვერსიის განრიგს ჩაანაცვლებს.</p> : null}
        {reviewing ? <><ul>{selected.map(r => <li key={r.key}><strong>{r.post.title}</strong> · {names[r.channel]}{approvedTargetRevision(revisions,r.postKey,r.channel)?` · ტექსტის ვერსია ${approvedTargetRevision(revisions,r.postKey,r.channel)!.version}`:""} · {data?.accounts.find(a => a.id === draftFor(r).accountId)?.name} · {draftFor(r).local.replace("T", " · ")}{draftFor(r).disambiguation ? ` · ${draftFor(r).disambiguation === "earlier" ? "პირველი საათი" : "მეორე საათი"}` : ""}</li>)}</ul><button type="button" className="wp-button" disabled={busy || loading || conflict || selected.some(r => blockers(r, draftFor(r)).length > 0)} onClick={() => void save()}>{busy ? "ინახება…" : "ჯგუფის განრიგის დადასტურება"}</button></> : <button type="button" className="wp-button" disabled={busy || loading || conflict} onClick={() => setReviewing(true)}>არჩეული განრიგის გადამოწმება</button>}</div> : null}</> : null}
    {data?.schedules.length ? <div className="ws-saved"><h3>შენახული ჩანაწერები</h3>{data.schedules.map(item => <div key={item.schedule.id}><p className="ws-version">{item.approvalId === rowApproval({postKey:item.postKey,channel:item.schedule.channel}) ? "მიმდინარე ტექსტი" : "წინა ტექსტი"}</p><SavedRow key={`${item.schedule.id}:${item.lifecycle.revision}:${zone}`} item={item} title={outline.posts[Number(item.postKey.slice(1)) - 1]?.title ?? item.postKey} account={data.accounts.find(a => a.id === item.publishingAccountId)?.name ?? "ადრე დაკავშირებული ანგარიში"} zone={zone} busy={busy || loading || conflict} readOnly={readOnly} onChange={change} /></div>)}</div> : null}
  </section>
}
