"use client"

import Link from "next/link"
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react"
import { useRouter } from "next/navigation"
import type { DashboardSection } from "../../application/dashboard/model"
import { targetHash, type NoteContext, type NoteEntry, type NoteTarget } from "../../application/contextual-notes/model"
import { clearAcceptedNoteDraft, browserDraftStorage, noteDraftKey, readNoteDraft, saveNoteDraft, type NoteDraftSelection } from "./note-draft"
import { VoiceNoteInput } from "./voice-note-input"
import { operatingRuleScopeLabel, type ChannelOperatingPolicy, type OperatingRule } from "../../core/domain/operating-policy"

type Selection = NoteDraftSelection
type PostSelectionProps = { postKey: string; channel: "facebook" | "instagram"; runId: string; title: string; postVersion: string; postRevisionId?:string }
const NotesContext = createContext<((selection: Selection) => void) | null>(null)
const examples: Record<DashboardSection, string[]> = {
  overview: ["როგორ გვეხმარება ეს გეგმა გაყიდვებში?"], week: ["ამ კვირაში ვიდეოს ვერ გადავიღებთ.", "რატომ ავირჩიეთ ეს მიმართულებები?"],
  content: ["ტექსტი უფრო მოკლე მინდა.", "ძალიან ოფიციალურია."], brand: ["ჩვენი პროდუქტის შესახებ ინფორმაცია დასაზუსტებელია."],
  strategy: ["ამ მიდგომას როგორ უკავშირებთ ბიზნესის მიზანს?"], results: ["ამ შედეგებიდან რა შეგვიძლია დავასკვნათ?"], connections: ["ამ არხთან დაკავშირებით კითხვა მაქვს."], settings: ["სამუშაო პროცესზე შენიშვნა მაქვს."],
}
const statusLabels: Record<NoteEntry["status"], string> = { queued: "შენახულია · რიგშია", processing: "ვამუშავებთ", answered: "პასუხი", clarification: "დასაზუსტებელია", proposed: "თქვენი გადაწყვეტილება", applied: "შესრულებულია", dismissed: "არ შესრულდა", reverted: "დაბრუნებულია", failed: "საჭიროა ხელახლა ცდა" }

export function PostNoteButton({ runId, postKey, channel, title, postVersion, postRevisionId }: PostSelectionProps) {
  const select = useContext(NotesContext)
  const data = { postKey, channel, title }
  return select ? <button type="button" className="cn-post-button" onClick={() => select({ runId, postKey, channel, title, postVersion, ...(postRevisionId?{postRevisionId}:{}), target: { type: "post", id: `${postKey}:${channel}`, label: title, version: postVersion, hash: targetHash(data), data } })}>✎ ამ პოსტზე შენიშვნა</button> : null
}

export function ContextNoteButton({ type, id, label, version, data, runId = null }: { type: Exclude<NoteTarget["type"], "post">; id: string; label: string; version: string; data: Record<string, unknown>; runId?: string | null }) {
  const select = useContext(NotesContext)
  return select ? <button type="button" className="cn-target-button" onClick={() => select({ title: label, target: { type, id, label, version, hash: targetHash(data), data }, runId, postKey: null, channel: null, postVersion: null })}>✎ ამ ნაწილზე შენიშვნა</button> : null
}

export function ContextualNotes({ ownerId, brandId, brandName, section, sectionLabel, week, voiceAvailable, children }: {
  ownerId: string; brandId: string; brandName: string; section: DashboardSection; sectionLabel: string; week: string; voiceAvailable: boolean; children: ReactNode
}) {
  const router = useRouter()
  const [text, setText] = useState("")
  const [source, setSource] = useState<"text" | "voice">("text")
  const [selection, setSelection] = useState<Selection | null>(null)
  const [notes, setNotes] = useState<NoteEntry[]>([])
  const [rules, setRules] = useState<OperatingRule[]>([])
  const [channels, setChannels] = useState<ChannelOperatingPolicy[]>([])
  const [busy, setBusy] = useState(false)
  const [voiceBusy, setVoiceBusy] = useState(false)
  const [hasVoiceDraft, setHasVoiceDraft] = useState(false)
  const [error, setError] = useState("")
  const [historyError, setHistoryError] = useState("")
  const [loading, setLoading] = useState(true)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const [reload, setReload] = useState(0)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const requestId = useRef<string | null>(null)
  const [restoredDraftKey, setRestoredDraftKey] = useState<string | null>(null)
  const draftKey = noteDraftKey({ ownerId, brandId, section, week })
  const scope = useRef(draftKey)
  const activeRequest = useRef<AbortController | null>(null)
  const busyRef = useRef(false)
  const observed = useRef(new Map<string, NoteEntry["status"]>())
  useEffect(() => {
    scope.current = draftKey
    activeRequest.current?.abort()
    let active = true
    queueMicrotask(() => {
      if (!active) return
      const draft = readNoteDraft(browserDraftStorage(), { ownerId, brandId, section, week })
      activeRequest.current?.abort(); busyRef.current = false; setBusy(false); setError(""); setNotes([]); observed.current.clear()
      if (!draft) { setText(""); setSource("text"); setSelection(null); requestId.current = null; setHasVoiceDraft(false) }
      if (draft) { setText(draft.text); setSource(draft.source); setSelection(draft.selection); requestId.current = draft.requestId; setHasVoiceDraft(draft.source === "voice") }
      setRestoredDraftKey(draftKey)
    })
    return () => { active = false }
  }, [ownerId, brandId, section, week, draftKey])
  useEffect(() => {
    if (restoredDraftKey !== draftKey) return
    saveNoteDraft(browserDraftStorage(), { version: 1, ownerId, brandId, section, week, text, source, selection, requestId: requestId.current, updatedAt: Date.now() })
  }, [restoredDraftKey, draftKey, ownerId, brandId, section, week, text, source, selection])
  const pending = notes.some(n => n.status === "processing" || n.status === "queued")
  const context: NoteContext = { brandId, section, week, postKey: selection?.postKey ?? null, channel: selection?.channel ?? null, runId: selection?.runId ?? null, postVersion: selection?.postVersion ?? null, postRevisionId: selection?.postRevisionId ?? null, target: selection?.target ?? null }
  const query = new URLSearchParams({ brandId, section, week }).toString()
  useEffect(() => {
    const controller = new AbortController()
    let timer: ReturnType<typeof setTimeout>
    async function load() {
      try {
        const response = await fetch(`/api/contextual-notes?${query}`, { cache: "no-store", signal: controller.signal })
        const data = await response.json()
        if (!response.ok) throw Error(data.message)
        if (!controller.signal.aborted) {
          const completed = (data.notes as NoteEntry[]).some(note => ["queued","processing"].includes(observed.current.get(note.id) ?? "") && ["applied","reverted"].includes(note.status))
          for (const note of data.notes as NoteEntry[]) observed.current.set(note.id,note.status)
          if (completed) { router.refresh(); window.dispatchEvent(new Event("unda:notes-changed")) }
          setNotes(data.notes); setRules(data.rules ?? []); setChannels(data.channels ?? []); setLoading(false) }
      } catch { if (!controller.signal.aborted) { setHistoryError("შენიშვნების ისტორია ვერ ჩაიტვირთა. ხელახლა სცადეთ."); setLoading(false) } }
      if (!controller.signal.aborted && pending) timer = setTimeout(load, 4000)
    }
    void load()
    return () => { controller.abort(); clearTimeout(timer) }
  }, [query, pending, reload, router])
  useEffect(() => () => activeRequest.current?.abort(), [])
  function reveal() {
    setCollapsed(false)
    requestAnimationFrame(() => { document.getElementById("contextual-notes")?.scrollIntoView({ behavior: "smooth", block: "start" }); inputRef.current?.focus({ preventScroll: true }) })
  }
  function selectPost(next: Selection) {
    if (busyRef.current || voiceBusy) return
    if (text.trim() && selection && (selection.runId !== next.runId || selection.postKey !== next.postKey || selection.channel !== next.channel || selection.postVersion !== next.postVersion || selection.postRevisionId !== next.postRevisionId)) {
      setError("ჯერ გაგზავნეთ ან გაასუფთავეთ მიმდინარე ტექსტი, შემდეგ აირჩიეთ სხვა პოსტი."); reveal(); return
    }
    requestId.current = null; setSelection(next); setError(""); reveal()
  }
  async function action(kind: "submit" | "confirm" | "dismiss" | "undo" | "retry", note?: NoteEntry) {
    if (busyRef.current || voiceBusy) return
    busyRef.current = true; setBusy(true); setError("")
    const submittedScope = draftKey
    const controller = new AbortController(); activeRequest.current = controller
    try {
      const id = note?.id ?? (requestId.current ??= crypto.randomUUID())
      if (kind === "submit") saveNoteDraft(browserDraftStorage(), { version: 1, ownerId, brandId, section, week, text, source, selection, requestId: id, updatedAt: Date.now() })
      const response = await fetch("/api/contextual-notes", { method: "POST", headers: { "content-type": "application/json" }, signal: controller.signal, body: JSON.stringify(kind === "submit" ? { action: kind, id, text, source, context } : { action: kind, id }) })
      const data = await response.json() as { note?: NoteEntry; message?: string }
      if (!response.ok || !data.note) throw Error(data.message ?? "შენიშვნა ვერ დამუშავდა.")
      if (controller.signal.aborted || scope.current !== submittedScope) return
      const next = data.note
      observed.current.set(next.id,next.status)
      setNotes(previous => [next, ...previous.filter(n => n.id !== next.id)].sort((a, b) => b.createdAt.localeCompare(a.createdAt)))
      if (kind === "submit") {
        clearAcceptedNoteDraft(browserDraftStorage(),{ownerId,brandId,section,week},next.id)
        setText(""); setSource("text"); setHasVoiceDraft(false); requestId.current = null }
      if (next.status === "applied" || next.status === "reverted") { setReload(value => value + 1); router.refresh(); window.dispatchEvent(new Event("unda:notes-changed")) }
    } catch (e) { if (!controller.signal.aborted) setError(e instanceof Error ? e.message : "მოქმედება ვერ დასრულდა. ტექსტი შენარჩუნებულია.") }
    finally { busyRef.current = false; if (!controller.signal.aborted) setBusy(false) }
  }
  const shown = historyOpen ? notes : notes.slice(0, 2)
  return <NotesContext.Provider value={selectPost}>
    <section className={`cn-panel ${collapsed ? "is-collapsed" : ""}`} id="contextual-notes" aria-labelledby="cn-title">
      <header className="cn-heading"><span className="cn-mark" aria-hidden="true">✎</span><div><h2 id="cn-title">შენიშვნები</h2><p>უთხარით გუნდს, რას ფიქრობთ.</p></div><button type="button" className="cn-toggle" aria-expanded={!collapsed} aria-controls="cn-body" onClick={() => setCollapsed(!collapsed)} disabled={voiceBusy}>{collapsed ? "გახსნა +" : "ჩაკეცვა −"}</button></header>
      <div id="cn-body" hidden={collapsed}>
        <div className="cn-context"><span>{brandName}</span><span aria-hidden="true">/</span><strong>{sectionLabel}</strong>{section === "week" || section === "content" ? <span>· {week}</span> : null}</div>
        {selection ? <div className="cn-selection"><span><strong>{selection.title}</strong>{selection.channel ? ` · ${selection.channel === "facebook" ? "Facebook" : "Instagram"}` : ""}</span><button type="button" disabled={busy || voiceBusy || !!text.trim()} onClick={() => { setSelection(null); requestId.current = null }} aria-label="არჩეული ნაწილის გაუქმება">×</button></div> : null}
        <form onSubmit={e => { e.preventDefault(); void action("submit") }}>
          <div className="cn-input-heading"><label className="cn-input-label" htmlFor="cn-input">რა გსურთ დავაზუსტოთ?</label><VoiceNoteInput available={voiceAvailable} disabled={busy} hasVoiceDraft={hasVoiceDraft} onBusy={setVoiceBusy} onError={setError} onTranscript={transcript => { setText(old => `${old}${old ? "\n" : ""}${transcript}`.slice(0, 8000)); setSource("voice"); setHasVoiceDraft(true); requestId.current = null; inputRef.current?.focus() }} /></div>
          <textarea id="cn-input" ref={inputRef} rows={3} maxLength={8000} value={text} disabled={busy} placeholder={selection ? "ან დაწერეთ, მაგალითად: ძალიან ოფიციალურია, უფრო ბუნებრივად ვთქვათ…" : "ან დაწერეთ კითხვა, შესწორება ან იდეა — როგორც თქვენს გუნდს ეტყოდით…"} onChange={e => { setText(e.target.value); if (!e.target.value) setHasVoiceDraft(false); requestId.current = null }} />
          <div className="cn-composer-actions"><span className="cn-count">{text.length ? `${text.length} / 8000` : "ტექსტით ან ხმით"}</span><button className="cn-send" type="submit" disabled={busy || voiceBusy || !text.trim()}>{busy ? "ვინახავთ…" : "გაგზავნა ↑"}</button></div>
        </form>
        {!text && !selection ? <div className="cn-examples" aria-label="შენიშვნის მაგალითები">{examples[section].map(example => <button key={example} disabled={busy || voiceBusy} type="button" onClick={() => { setText(example); requestId.current = null; inputRef.current?.focus() }}>{example}</button>)}</div> : null}
        {section === "content" && !selection ? <p className="cn-hint">კონკრეტული ტექსტის შესაცვლელად პოსტთან აირჩიეთ „ამ პოსტზე შენიშვნა“.</p> : null}
        <p className="cn-hint">შენიშვნა ამ გვერდის კონტექსტს უკავშირდება. ფართო ცვლილებამდე შედეგს გაჩვენებთ.</p>
        {(rules.length || channels.some(channel => !channel.active)) ? <details className="cn-policies"><summary>მოქმედი წესები და არხები</summary>{rules.length ? <ul>{rules.map(rule => <li key={rule.id}>{rule.directive} <small>{operatingRuleScopeLabel(rule.scope)}</small></li>)}</ul> : <p>მუდმივი წესი ჯერ არ არის.</p>}<p>{channels.map(channel => `${channel.channel === "instagram" ? "Instagram" : "Facebook"}: ${channel.active ? "აქტიური" : "შეჩერებული"}`).join(" · ")}</p></details> : null}
        {busy ? <p className="cn-working" role="status">ვინახავთ შენიშვნას…</p> : null}
        {error ? <div className="cn-error" role="alert">{error}</div> : null}
        {historyError ? <div className="cn-error" role="alert">{historyError} <button type="button" onClick={() => { setHistoryError(""); setReload(n => n + 1) }}>ისტორიის განახლება</button></div> : null}
        <div className="cn-history" aria-live="polite" aria-busy={loading}>
          {loading ? <p className="cn-hint">ისტორია იტვირთება…</p> : shown.map(note => <article key={note.id} className={`cn-entry cn-${note.status}`}>
            <div className="cn-entry-meta"><strong>{statusLabels[note.status]}</strong><time dateTime={note.createdAt}>{new Date(note.createdAt).toLocaleString("ka-GE", { timeZone: "Asia/Tbilisi", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</time>{note.source === "voice" ? <span>ხმით</span> : null}{note.context.postKey ? <span>პოსტი {note.context.postKey.slice(1)} · {note.context.channel}</span> : null}</div>
            <blockquote>{note.text}</blockquote><p>{note.message || "შენიშვნა მუშავდება…"}</p>
            {note.meanings.length > 1 ? <details><summary>როგორ გავიგეთ თქვენი შენიშვნა</summary><ul>{note.meanings.map((meaning, index) => <li key={index}>{meaning}</li>)}</ul></details> : null}
            <div className="cn-entry-actions">{note.status === "proposed" ? <><button className="cn-send" disabled={busy || voiceBusy} onClick={() => void action("confirm", note)}>დიახ, ასე გავაგრძელოთ</button><button disabled={busy || voiceBusy} onClick={() => void action("dismiss", note)}>არა, არ შეცვალოთ</button></> : null}{note.canUndo ? <button disabled={busy || voiceBusy} onClick={() => void action("undo", note)}>ცვლილების დაბრუნება ↶</button> : null}{note.targetUrl ? <Link href={note.targetUrl}>შედეგის ნახვა →</Link> : null}{note.status === "failed" ? <button disabled={busy || voiceBusy} onClick={() => void action("retry", note)}>შენიშვნის ხელახლა ცდა</button> : null}</div>
          </article>)}
          {notes.length > 2 ? <button type="button" className="cn-history-toggle" aria-expanded={historyOpen} onClick={() => setHistoryOpen(!historyOpen)}>{historyOpen ? "ისტორიის ჩაკეცვა" : `ისტორია · ${notes.length} შენიშვნა`}</button> : null}
        </div>
      </div>
    </section>
    {children}
    <button type="button" className="cn-launcher" onClick={reveal} aria-label="შენიშვნის ბლოკზე გადასვლა">✎ <span>შენიშვნები</span></button>
  </NotesContext.Provider>
}
