"use client"

import Link from "next/link"
import { useCallback, useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { BrandDossierView } from "./brand-dossier"
import { DISCOVERY_STEPS, type DiscoveryInput, type DiscoverySession } from "../blueprints/social/brand-discovery/model"

const stepLabels = { sources: "ვკითხულობთ ბიზნესის წყაროებს", understanding: "ვარკვევთ, როგორ მუშაობს თქვენი ბიზნესი", audiences: "ვპოულობთ მნიშვნელოვან აუდიტორიებს", profiles: "ვითვალისწინებთ აუდიტორიების განსხვავებებს", envelope: "ვაყალიბებთ თქვენი კომუნიკაციის ჩარჩოს", goals: "ვარჩევთ საწყის საკომუნიკაციო მიზნებს", ready: "ბრენდის პირველი სურათი მზადაა" }

async function requestAction(body: Record<string, unknown>) {
  const response = await fetch("/api/brand-discovery", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) })
  const data = await response.json() as { session?: DiscoverySession; message?: string; redirect?: string }
  if (!response.ok) throw new Error(data.message ?? "ცვლილება ვერ შეინახა. სცადეთ ხელახლა.")
  return data
}

export function DiscoveryClient({ initialSession, initialInput, brandId, ownerId }: { initialSession: DiscoverySession | null; initialInput: DiscoveryInput; brandId: string | null; ownerId: string }) {
  const router = useRouter()
  const [session, setSession] = useState(initialSession)
  const [id, setId] = useState(() => initialSession?.id ?? crypto.randomUUID())
  const [input, setInput] = useState(initialSession?.payload.input ?? initialInput)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [draftMessage, setDraftMessage] = useState("")
  const [restored, setRestored] = useState(false)
  const draftWrites = useRef<Promise<unknown>>(Promise.resolve())
  const lastWake = useRef(0)
  const storageKey = `unda-brand-draft-v1:${ownerId}:${brandId ?? "new"}`
  const sessionId = session?.id
  const working = session?.status === "queued" || session?.status === "running"
  const sourceForm = !session || session.status === "draft"

  useEffect(() => {
    let active = true
    queueMicrotask(() => {
    if (!active) return
    try {
      const text = localStorage.getItem(storageKey)
      if (text && (!initialSession || initialSession.status === "draft")) {
        const saved = JSON.parse(text) as { input?: DiscoveryInput; savedAt?: number }
        if (saved.input && typeof saved.input.website === "string" && typeof saved.input.notes === "string" && ["ka", "en"].includes(saved.input.language) && saved.input.notes.length <= 8000 && saved.input.website.length <= 500 && (saved.savedAt ?? 0) > Date.parse(initialSession?.updatedAt ?? "1970-01-01")) setInput(saved.input)
      }
    } catch { /* Storage may be disabled; server drafts still work. */ }
    setRestored(true)
    })
    return () => { active = false }
  }, [storageKey, initialSession])

  useEffect(() => {
    if (!sourceForm || !restored || busy) return
    try { localStorage.setItem(storageKey, JSON.stringify({ input, savedAt: Date.now() })) } catch { /* Server persistence is the primary copy. */ }
    const timer = setTimeout(() => {
      setDraftMessage("ინახება…")
      draftWrites.current = draftWrites.current.catch(() => {}).then(async () => {
        try {
          const data = await requestAction({ action: "draft", id, input, brandId })
          if (data.session) { setSession(data.session); setId(data.session.id) }
          setDraftMessage("მონახაზი შენახულია")
        } catch { setDraftMessage("სერვერთან კავშირი ვერ დამყარდა; ტექსტი ამ მოწყობილობაზე შენახულია.") }
      })
    }, 700)
    return () => clearTimeout(timer)
  }, [sourceForm, restored, busy, input, id, brandId, storageKey])

  useEffect(() => {
    if (!working || !sessionId) return
    let active = true
    let timer: ReturnType<typeof setTimeout>
    const poll = async () => {
      try {
        const response = await fetch(`/api/brand-discovery?id=${sessionId}`, { cache: "no-store" })
        const data = await response.json() as { session: DiscoverySession | null }
        if (!response.ok || !data.session) throw new Error()
        if (!active) return
        setSession(data.session)
        setError("")
        const runnable = data.session.status === "queued" || (data.session.status === "running" && !!data.session.leaseUntil && Date.parse(data.session.leaseUntil) < Date.now())
        if (runnable && Date.now() - lastWake.current > 12_000) {
          lastWake.current = Date.now()
          await requestAction({ action: "resume", id: data.session.id, revision: data.session.revision })
        }
      } catch { if (active) setError("კავშირი დროებით გაწყდა. ანალიზის შენახულ მდგომარეობას ხელახლა შევამოწმებთ.") }
      if (active) timer = setTimeout(poll, 2200)
    }
    void poll()
    return () => { active = false; clearTimeout(timer) }
  }, [working, sessionId]) // A single polling loop reads subsequent revisions from the server.

  const runAction = useCallback(async (action: string, changes: Record<string, unknown> = {}) => {
    if (!session) return
    setBusy(true); setError("")
    try {
      const data = await requestAction({ action, id: session.id, revision: session.revision, ...changes })
      if (data.redirect) { try { localStorage.removeItem(`${storageKey}:${session.id}:${session.revision}`); localStorage.removeItem(storageKey) } catch {} router.push(data.redirect); router.refresh() }
      else if (data.session) { try { localStorage.removeItem(`${storageKey}:${session.id}:${session.revision}`) } catch {} setSession(data.session); window.scrollTo({ top: 0 }) }
    } catch (e) { setError(e instanceof Error ? e.message : "მოქმედება ვერ დასრულდა.") }
    finally { setBusy(false) }
  }, [session, router, storageKey])

  async function start() {
    setBusy(true); setError("")
    try {
      await draftWrites.current
      const saved = await requestAction({ action: "draft", id, input, brandId })
      if (!saved.session) throw new Error("მონახაზი ვერ შეინახა.")
      setId(saved.session.id)
      const data = await requestAction({ action: "start", id: saved.session.id, revision: saved.session.revision, input })
      if (data.session) setSession(data.session)
    } catch (e) { setError(e instanceof Error ? e.message : "ანალიზი ვერ დაიწყო.") }
    finally { setBusy(false) }
  }

  return <div className="bd-app">
    {error ? <div className="bd-error" role="alert">{error}</div> : null}
    {sourceForm ? <div className="bd-start"><div className="bd-start-copy"><p className="bd-eyebrow">პირველი შეხვედრა თქვენს ბრენდთან</p><h1>მოგვიყევით საიდან დავიწყოთ.<br /><em>დანარჩენს ჩვენ გავარკვევთ.</em></h1><p>ვინ ხართ, ვისთვის ხდებით მნიშვნელოვანი და როგორ უნდა გაიჟღეროთ — პირველივე შეხვედრაზე შევქმნით თქვენს ბიზნესზე კონკრეტულ ხედვას.</p><ol className="bd-promise"><li><span>01</span><div><strong>თქვენი ბიზნესის ლოგიკა</strong><p>საქმიანობა, შეთავაზებები და ის, რაც გამოგარჩევთ.</p></div></li><li><span>02</span><div><strong>აუდიტორიები მათი საჭიროებებით</strong><p>ვინ არის გადაწყვეტილების წინაშე და რა უნდა გაიგოს.</p></div></li><li><span>03</span><div><strong>მიზნები და თქვენი ხმა</strong><p>რისთვის ვილაპარაკებთ და როგორ დარჩება ეს ხმა თქვენი.</p></div></li></ol></div>
      <form className="bd-source-card" onSubmit={(event) => { event.preventDefault(); void start() }}><span className="bd-source-symbol" aria-hidden="true">↗</span><h2>{brandId ? "ახალი ხედვა არსებულ ბრენდზე" : "თქვენი საწყისი წერტილი"}</h2><p>{brandId ? "მოქმედი ინფორმაცია შენარჩუნდება, სანამ ახალ ხედვას არ დაადასტურებთ." : "ვებსაიტი ან მოკლე აღწერა საკმარისია დასაწყებად."}</p><label htmlFor="bd-website">ვებსაიტი<input id="bd-website" name="website" inputMode="url" autoComplete="url" spellCheck={false} value={input.website} onChange={(e) => setInput({ ...input, website: e.target.value })} maxLength={500} placeholder="მაგ. yourbrand.ge…" /></label><span className="bd-field-hint">ავტომატურად ვკითხულობთ ვებსაიტს. სოციალური ანგარიშების დაკავშირება ცალკე ეტაპია.</span><label htmlFor="bd-notes">რა უნდა ვიცოდეთ დამატებით?<textarea id="bd-notes" name="notes" rows={5} value={input.notes} maxLength={8000} onChange={(e) => setInput({ ...input, notes: e.target.value })} placeholder="რას აკეთებთ, რით განსხვავდებით, რა შეიცვალა… თუ ვებსაიტი არ გაქვთ, თქვენი ბიზნესი აქ აღწერეთ." /></label><label htmlFor="bd-language">რომელ ენაზე უნდა შეიქმნას კონტენტი?<select id="bd-language" name="language" value={input.language} onChange={(e) => setInput({ ...input, language: e.target.value as "ka" | "en" })}><option value="ka">ქართული</option><option value="en">English</option></select></label><button className="bd-button bd-start-button" disabled={busy}>{busy ? "ვიწყებთ…" : "გაიცანით ჩემი ბიზნესი →"}</button><p className="bd-draft-message" role="status">{draftMessage || "საბოლოო სიტყვა თქვენ გეკუთვნით."}</p></form>
    </div> : working ? <section className="bd-progress" aria-live="polite"><p className="bd-eyebrow">თქვენი ბრენდის გაცნობა</p><div className="bd-progress-title"><h1>{session.payload.understanding?.name ?? "ვიკვლევთ თქვენს ბიზნესს."}</h1><span className="bd-processing-mark" aria-hidden="true">✳</span></div><p className="bd-progress-description">{session.payload.understanding?.summary ?? "წყაროებიდან ვაგროვებთ სურათს, რომელსაც შემდეგ აუდიტორიასა და კომუნიკაციაში გამოვიყენებთ."}</p><ol className="bd-progress-steps">{DISCOVERY_STEPS.filter((step) => step !== "ready").map((step, i) => { const current = DISCOVERY_STEPS.indexOf(session.step); return <li key={step} className={i < current ? "is-complete" : i === current ? "is-running" : ""}><span>{i < current ? "✓" : String(i + 1).padStart(2, "0")}</span><div><strong>{stepLabels[step]}</strong><small>{i < current ? "დასრულებულია" : i === current ? "მიმდინარეობს…" : "შემდეგი ეტაპი"}</small></div></li> })}</ol><p className="bd-progress-footnote">თითოეული დასრულებული ეტაპი ინახება. ამ გვერდზე დაბრუნებისას ანალიზს იმავე ადგილიდან გააგრძელებთ.</p><Link href="/workspace" className="bd-text-button">სამუშაო სივრცეში დაბრუნება ↗</Link></section> : session?.status === "failed" ? <section className="bd-failed"><p className="bd-eyebrow">შენახული ანალიზი</p><h1>გაგრძელება ამ ეტაპიდან შეგვიძლია.</h1><p>{session.error}</p><p>ეტაპი: {stepLabels[session.step]}</p><button className="bd-button" disabled={busy} onClick={() => void runAction("retry")}>ეტაპის ხელახლა ცდა</button><form className="bd-failure-note" onSubmit={(event) => { event.preventDefault(); const note = new FormData(event.currentTarget).get("note"); void runAction("revise", { kind: "business", note }) }}><label htmlFor="bd-failure-note">ან დაამატეთ ის ინფორმაცია, რაც წყაროს აკლია<textarea id="bd-failure-note" name="note" minLength={10} maxLength={4000} required rows={4} /></label><button className="bd-button bd-button-outline" disabled={busy}>ინფორმაციის დამატება და გაგრძელება</button></form></section> : session?.status === "confirmed" ? <section className="bd-failed"><h1>ბრენდის საფუძველი შენახულია.</h1><Link href="/workspace/brand" className="bd-button">ბრენდის ნახვა →</Link></section> : session?.payload.understanding ? <BrandDossierView draftKey={`${storageKey}:${session.id}:${session.revision}`} key={`${session.id}:${session.revision}`} payload={session.payload} busy={busy} onFeedback={(changes) => runAction("revise", changes)} onConfirm={(selectedGoalIds, language) => runAction("confirm", { selectedGoalIds, language })} /> : null}
  </div>
}
