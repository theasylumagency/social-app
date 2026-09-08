"use client"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { useEffect, useRef, useState } from "react"
import type { RevisionReason, SocialStrategy, StrategyView } from "../../blueprints/social/strategy/model"

const status = { active: "აქტიური", infrequent: "იშვიათი აქტივობა", empty: "ცარიელი", notFound: "ვერ მოიძებნა", unknown: "ვერ დავადგინეთ" }
const actions = { continue: "გაგრძელება", activate: "გააქტიურება", add: "დამატება", deprioritize: "დაბალი პრიორიტეტი", doNotUse: "არ გამოვიყენოთ" }
const reasons: Record<RevisionReason, string> = { founderFeedback: "არ ვეთანხმები რეკომენდაციას", performanceEvidence: "შედეგებიდან მიღებული მტკიცებულება", businessPriority: "შეიცვალა ბიზნესის პრიორიტეტი", marketChange: "ბაზრის ან არხის ცვლილება", brandEvidence: "ახალი ინფორმაცია ბრენდის შესახებ", approachFailure: "არსებული მიდგომა არ მუშაობს" }
const levels = { public: "საჯარო სიგნალი", connected: "დაკავშირებული ანგარიშის მონაცემი", downstream: "ვებსაიტის ან სხვა წყაროს მონაცემი" }
export function StrategyReport({ strategy }: { strategy: SocialStrategy }) {
  const p = strategy.payload.proposal
  if (!p) return null
  return <div className="strategy-report"><section className="ws-card strategy-objective"><p className="eyebrow">სოციალური სტრატეგიული მიზანი · ვერსია {strategy.revision}</p><h2>{p.objective}</h2><p>{p.rationale}</p><strong>{strategy.status === "approved" ? "დადასტურებულია" : "რეკომენდაცია — დასადასტურებელია"}</strong><p>სავარაუდო ჰორიზონტი: {p.horizon}</p><small>მიზანი ძალაში რჩება, სანამ ახალი მტკიცებულება ცვლილების საფუძველს არ მოგვცემს. ჰორიზონტი ვადა ან გარანტია არ არის.</small></section>
    <section className="ws-card"><h2>საიდან ვიწყებთ</h2><div className="strategy-grid">{p.reconnaissance.map((r) => <article key={r.channel}><h3>{r.channel} · {status[r.status]}</h3><p>{r.observation}</p>{r.sourceUrl ? <a href={r.sourceUrl} target="_blank" rel="noreferrer">შემოწმებული გვერდი ↗</a> : <small>საჯარო გვერდი ვერ დავადგინეთ; ეს მის არარსებობას არ ნიშნავს.</small>}{r.excerpt ? <blockquote>{r.excerpt}</blockquote> : null}</article>)}</div><p className="ws-muted">საჯარო დაკვირვება სრულ ანალიტიკას არ წარმოადგენს.</p></section>
    <section className="ws-card"><h2>სად და რატომ ვიმუშავებთ</h2><div className="strategy-grid">{p.channels.map((c) => <article key={c.channel}><h3>{c.channel} · {actions[c.action]}</h3><strong>{c.role}</strong><p>{c.reason}</p>{!["facebook", "instagram"].includes(c.channel) ? <small>ამ არხის კონტენტის შესრულება ჯერ ცალკე გამართვას საჭიროებს.</small> : null}</article>)}</div></section>
    <section className="ws-card"><h2>სტრატეგიული გეგმა</h2><p>{p.plan.audienceChange}</p><div className="strategy-grid">{[{ title: "მოსახსნელი ბარიერები", values: p.plan.barriers }, { title: "რა მტკიცებულება გვჭირდება", values: p.plan.proofNeeds }, { title: "კონტენტის შესაძლო როლები", values: p.plan.contentRoles }, { title: "რას ვერ დავპირდებით", values: p.plan.mustNotClaim }].map((group) => <article key={group.title}><h3>{group.title}</h3><ul>{group.values.map((v) => <li key={v}>{v}</li>)}</ul></article>)}</div><h3>გაცნობიდან ნდობამდე</h3><p>{p.plan.journey}</p><h3>შეთავაზებასთან კავშირი</h3><p>{p.plan.commercialBridge}</p></section>
    <section className="ws-card"><h2>როგორ შევაფასებთ პროგრესს</h2>{p.measurement.map((m, i) => <article key={i}><p className="eyebrow">{levels[m.level]}</p><h3>{m.signal}</h3><p>{m.interpretation}</p></article>)}<small>მონაცემის ხელმისაწვდომობა შედეგების გვერდზე ცალკე ფიქსირდება. ერთი მაჩვენებელი მიზნის მიღწევას არ ამტკიცებს.</small></section>
    {strategy.payload.reason ? <section className="ws-card"><h3>რა გახდა ცვლილების საფუძველი</h3><strong>{reasons[strategy.payload.reason]}</strong><p>{strategy.payload.comment}</p></section> : null}
  </div>
}
export function StrategyClient({ brandId, initial }: { brandId: string; initial: StrategyView }) {
  const router = useRouter()
  const [view, setView] = useState(initial), [busy, setBusy] = useState(false), [error, setError] = useState("")
  const [editing, setEditing] = useState(false), [comment, setComment] = useState("")
  const [reason, setReason] = useState<RevisionReason>(initial.active ? "performanceEvidence" : "founderFeedback")
  const request = useRef<string | null>(null)
  const latest = view.latest
  const working = latest?.status === "queued" || latest?.status === "running"
  useEffect(() => {
    if (!working) return
    let active = true; let timer: ReturnType<typeof setTimeout>
    async function poll() {
      try { const response = await fetch(`/api/social-strategy?brand=${encodeURIComponent(brandId)}`, { cache: "no-store" }); if (response.status === 402) { router.push("/subscription"); return } if (!response.ok) throw Error(); const next = await response.json(); if (active) setView(next) } catch { if (active) setError("კავშირი დროებით შეწყდა; შენახულ მდგომარეობას ხელახლა შევამოწმებთ.") }
      if (active) timer = setTimeout(poll, 4000)
    }
    timer = setTimeout(poll, 2000)
    return () => { active = false; clearTimeout(timer) }
  }, [brandId, working, router])
  async function act(action: string) {
    if (busy) return
    setBusy(true); setError("")
    request.current ??= crypto.randomUUID()
    try {
      const response = await fetch("/api/social-strategy", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action, brandId, id: ["propose", "revise"].includes(action) ? request.current : latest?.id, parentId: latest?.id, revision: latest?.revision, reason, comment }) })
      const result = await response.json()
      if (response.status === 402) { router.push("/subscription"); return }
      if (!response.ok) throw Error(result.message)
      setView(result); request.current = null; setEditing(false); setComment("")
    } catch (e) { setError(e instanceof Error ? e.message : "სცადეთ ხელახლა.") } finally { setBusy(false) }
  }
  return <div className="strategy-client"><div className="ws-heading"><p className="eyebrow">ბრენდის გაცნობა → სოციალური გარემო → შეთანხმებული სტრატეგია</p><h1>მიზანი, რომელიც კვირებს აერთიანებს.</h1></div>
    {!latest ? <section className="ws-card"><h2>Operator შემოგთავაზებთ სოციალურ მიზანს.</h2><p>შევაფასებთ ხელმისაწვდომ საჯარო გვერდებს, ავირჩევთ არხების როლებს და ჩამოვაყალიბებთ სტრატეგიასა და პროგრესის ნიშნებს.</p>{initial.legacy ? <p>ძველი გეგმები შენარჩუნებულია. მათი მიზნები ავტომატურად ახალ სტრატეგიად არ გადაგვაქვს.</p> : null}<button className="ws-button" disabled={busy} onClick={() => void act("propose")}>კვლევა და რეკომენდაციის მომზადება →</button></section> : null}
    {working ? <section className="ws-card" role="status"><h2>რეკომენდაცია მზადდება…</h2><p>საჯარო წყაროების შემოწმება და ერთი სტრატეგიული რეკომენდაცია. დასრულებული კვლევა ინახება; შეგიძლიათ მოგვიანებით დაბრუნდეთ.</p></section> : null}
    {latest?.status === "failed" ? <section className="ws-card"><p>{latest.error}</p><button className="ws-button" disabled={busy} onClick={() => void act("retry")}>ხელახლა ცდა</button></section> : null}
    {latest?.payload.proposal ? <StrategyReport strategy={latest} /> : null}
    {latest?.status === "proposed" || latest?.status === "approved" ? <section className="ws-card strategy-actions">{latest.status === "proposed" ? <button className="ws-button" disabled={busy} onClick={() => void act("approve")}>ვეთანხმები სტრატეგიულ მიზანს →</button> : <Link className="ws-button" href="/workspace">მიმდინარე კვირის დაგეგმვა →</Link>}<button className="ws-button ws-button-outline" disabled={busy} onClick={() => setEditing(!editing)}>{view.active ? "სტრატეგიის ცვლილების საფუძველი" : "არ ვეთანხმები / კომენტარი"}</button></section> : null}
    {editing ? <form className="ws-card strategy-form" onSubmit={(e) => { e.preventDefault(); void act("revise") }}><label>ცვლილების მიზეზი<select value={reason} onChange={(e) => setReason(e.target.value as RevisionReason)}>{Object.entries(reasons).filter(([key]) => !view.active || key !== "founderFeedback").map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label><label>რას უნდა დაეყრდნოს ახალი რეკომენდაცია<textarea required minLength={10} maxLength={3000} rows={5} value={comment} onChange={(e) => setComment(e.target.value)} /></label><button className="ws-button" disabled={busy}>კომენტარის გათვალისწინება და ახალი რეკომენდაცია</button></form> : null}
    {view.active && view.active.id !== latest?.id ? <details className="ws-card"><summary>მოქმედი სტრატეგია ახალი რეკომენდაციის დადასტურებამდე შენარჩუნებულია</summary><StrategyReport strategy={view.active} /></details> : null}
    {error ? <p role="alert">{error}</p> : null}
  </div>
}
