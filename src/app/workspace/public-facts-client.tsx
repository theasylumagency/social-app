"use client"
import { useId, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { factBlocker, PUBLIC_FACT_KINDS, type PublicFactKind, type RegisteredFact } from "../../blueprints/social/public-knowledge"
import type { GenerationPermission } from "../../core/domain/primitives"
import type { PublicKnowledgeView, SavePublicFact } from "../../infrastructure/postgres/public-knowledge-store"
import "./public-facts.css"
const kinds: Record<PublicFactKind, string> = { offer: "შეთავაზება", price: "ფასი", contact: "კონტაქტი", hours: "სამუშაო საათები", availability: "ხელმისაწვდომობა" }
const permissions: Record<GenerationPermission, string> = { publicUse: "საჯარო ტექსტში გამოყენება", publicUseWithProof: "საჯარო გამოყენება წყაროს დასტურით", internalGuidance: "მხოლოდ შიდა დაგეგმვა", blocked: "გამოყენება შეჩერებულია" }
const localTime = (value: string) => new Date(Date.parse(value) + 4 * 3600000).toISOString().slice(0, 16)
export function PublicFactsClient({ brandId, initial }: { brandId: string; initial: PublicKnowledgeView }) {
  const router = useRouter(), prefix = useId(), request = useRef<{ body: string; id: string } | null>(null)
  const [view, setView] = useState(initial), [editing, setEditing] = useState<RegisteredFact | null>(null)
  const [kind, setKind] = useState<PublicFactKind>("offer"), [subject, setSubject] = useState(""), [statement, setStatement] = useState("")
  const [permission, setPermission] = useState<GenerationPermission>("internalGuidance"), [until, setUntil] = useState(""), [evidenceId, setEvidenceId] = useState("")
  const [confirmed, setConfirmed] = useState(false), [sourceConfirmed, setSourceConfirmed] = useState(false), [busy, setBusy] = useState(false), [message, setMessage] = useState("")
  function edit(f: RegisteredFact | null) {
    setEditing(f); setKind(f?.kind ?? "offer"); setSubject(f?.subject ?? ""); setStatement(f?.statement ?? ""); setPermission(f?.permission === "blocked" ? "internalGuidance" : f?.permission ?? "internalGuidance")
    setUntil(f?.fact.validUntil ? localTime(f.fact.validUntil) : ""); setEvidenceId(view.snapshot.proofs.find(p => p.factKey === f?.key)?.source.evidenceId ?? "")
    setConfirmed(false); setSourceConfirmed(false); setMessage(""); request.current = null
  }
  async function save(withdraw?: RegisteredFact) {
    setBusy(true); setMessage("")
    try {
      const body = withdraw ? { brandId, id: withdraw.key, revision: withdraw.revision, kind: withdraw.kind, subject: withdraw.subject, statement: withdraw.statement, permission: "blocked", validUntil: withdraw.fact.validUntil, confirmed: true } : { brandId, id: editing?.key ?? "new", revision: editing?.revision ?? 0, kind, subject, statement, permission, validUntil: new Date(`${until}:00+04:00`).toISOString(), confirmed, evidenceId, sourcePublicConfirmed: sourceConfirmed }
      const signature = JSON.stringify(body)
      if (request.current?.body !== signature) request.current = { body: signature, id: crypto.randomUUID() }
      const input = { ...body, id: body.id === "new" ? request.current.id : body.id, requestId: request.current.id } as SavePublicFact
      const response = await fetch("/api/public-facts", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(input) })
      if (response.status === 402) { router.push("/subscription"); return }
      const result = await response.json(); if (!response.ok) throw Error(result.message)
      setView(result); edit(null); setMessage(withdraw ? "ფაქტის გამოყენება შეჩერებულია." : "ფაქტი შენახულია. ახალი გეგმა ამ ვერსიას გამოიყენებს. უკვე შექმნილ პოსტს განახლება და ხელახალი დამტკიცება შეიძლება დასჭირდეს."); router.refresh()
    } catch (error) { setMessage(error instanceof Error ? error.message : "შენახვა ვერ დასრულდა.") } finally { setBusy(false) }
  }
  async function refresh() {
    setBusy(true); setMessage("")
    try {
      const response = await fetch(`/api/public-facts?brand=${encodeURIComponent(brandId)}`, { cache: "no-store" })
      if (response.status === 402) { router.push("/subscription"); return }
      const result = await response.json(); if (!response.ok) throw Error(result.message)
      setView(result); edit(null); setMessage("ფაქტების მიმდინარე მდგომარეობა გადამოწმებულია.")
    } catch (error) { setMessage(error instanceof Error ? error.message : "განახლება ვერ დასრულდა.") } finally { setBusy(false) }
  }
  return <section className="ws-card brief-panel public-facts" aria-labelledby={`${prefix}-title`}>
    <h2 id={`${prefix}-title`}>დადასტურებული ფაქტები</h2><p>შეინახეთ ზუსტი შეთავაზება, ფასი, კონტაქტი ან სამუშაო საათები. ბრენდის ზოგადი აღწერა საჯარო ფაქტის ნებართვას თავისთავად არ იძლევა.</p><button type="button" disabled={busy} onClick={() => void refresh()}>ფაქტების გადამოწმება</button>
    <ul className="public-facts-list">{view.snapshot.facts.map(f => <li key={f.key}><strong>{kinds[f.kind]} · {f.subject}</strong><p>{f.statement}</p><small>{permissions[f.permission]} · მოქმედებს {new Intl.DateTimeFormat("ka", { timeZone: "Asia/Tbilisi", dateStyle: "medium", timeStyle: "short" }).format(new Date(f.fact.validUntil!))}-მდე</small><p>{factBlocker(f, view.snapshot, view.snapshot.capturedAt) ?? "საჯარო გამოყენება დაშვებულია."}</p><details><summary>დადასტურების წყარო</summary><p>თქვენი დადასტურება · {new Intl.DateTimeFormat("ka", { timeZone: "Asia/Tbilisi", dateStyle: "medium", timeStyle: "short" }).format(new Date(f.updatedAt))}</p>{view.snapshot.proofs.filter(p => p.factKey === f.key).map(p => <blockquote key={p.key}>{p.source.excerpt}<footer>წყარო შენახულია {new Intl.DateTimeFormat("ka", { timeZone: "Asia/Tbilisi", dateStyle: "medium" }).format(new Date(p.source.capturedAt))}</footer></blockquote>)}</details><button type="button" disabled={busy} onClick={() => edit(f)}>განახლება</button>{f.permission !== "blocked" ? <button type="button" disabled={busy} onClick={() => void save(f)}>გამოყენების შეჩერება</button> : null}</li>)}</ul>
    {!view.snapshot.facts.length ? <p>დადასტურებული ფაქტები ჯერ არ არის. სისტემა გამოტოვებულ დეტალებს თვითონ არ შეავსებს.</p> : null}
    <form onSubmit={e => { e.preventDefault(); void save() }}><h3>{editing ? "ფაქტის განახლება" : "ახალი ფაქტი"}</h3><fieldset disabled={busy}>
      <label htmlFor={`${prefix}-kind`}>ინფორმაციის ტიპი</label><select id={`${prefix}-kind`} value={kind} onChange={e => setKind(e.target.value as PublicFactKind)}>{PUBLIC_FACT_KINDS.map(k => <option key={k} value={k}>{kinds[k]}</option>)}</select>
      <label htmlFor={`${prefix}-subject`}>რომელ პროდუქტს, სერვისს ან ადგილს ეხება?</label><input id={`${prefix}-subject`} value={subject} onChange={e => setSubject(e.target.value)} required minLength={2} maxLength={120} />
      <label htmlFor={`${prefix}-statement`}>ზუსტი ფაქტი, პირობების ჩათვლით</label><textarea id={`${prefix}-statement`} rows={3} value={statement} onChange={e => setStatement(e.target.value)} required minLength={10} maxLength={1500} />
      <label htmlFor={`${prefix}-permission`}>როგორ შეიძლება გამოყენება?</label><select id={`${prefix}-permission`} value={permission} onChange={e => setPermission(e.target.value as GenerationPermission)}>{Object.entries(permissions).filter(([p]) => p !== "blocked").map(([p, label]) => <option key={p} value={p}>{label}</option>)}</select>
      <label htmlFor={`${prefix}-until`}>მოქმედების ბოლო დრო (თბილისი)</label><input id={`${prefix}-until`} type="datetime-local" value={until} onChange={e => setUntil(e.target.value)} required /><small>ფასი, საათები და ხელმისაწვდომობა — მაქსიმუმ 90 დღე; შეთავაზება და კონტაქტი — 365 დღე.</small>
      {permission === "publicUseWithProof" ? <><label htmlFor={`${prefix}-source`}>დამადასტურებელი წყარო</label><select id={`${prefix}-source`} value={evidenceId} onChange={e => { setEvidenceId(e.target.value); setSourceConfirmed(false) }} required><option value="">აირჩიეთ შენახული ციტატა</option>{view.sources.map(s => <option key={s.id} value={s.id}>{s.excerpt.slice(0, 100)}</option>)}</select><blockquote>{view.sources.find(s => s.id === evidenceId)?.excerpt ?? "ფაქტი წყაროს ზუსტ ციტატას უნდა ემთხვეოდეს."}</blockquote><label className="public-facts-check"><input type="checkbox" checked={sourceConfirmed} onChange={e => setSourceConfirmed(e.target.checked)} required />ვადასტურებ წყაროს აქტუალურობას და ამ ციტატის საჯარო გამოყენების უფლებას.</label></> : null}
      <label className="public-facts-check"><input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} required />ვადასტურებ ფაქტის სისწორეს, მოქმედების ვადასა და გამოყენების ნებართვას.</label>
    </fieldset><div><button type="submit" disabled={busy || !confirmed}>{busy ? "ინახება…" : "ფაქტის შენახვა"}</button>{editing ? <button type="button" disabled={busy} onClick={() => edit(null)}>გაუქმება</button> : null}</div></form><p role="status" aria-live="polite">{message}</p>
  </section>
}
