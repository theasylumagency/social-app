"use client"
import { useRouter } from "next/navigation"
import { useState } from "react"
import type { WeekEvidence } from "../../blueprints/social/strategy/model"
import { currentWeek, shiftWeek } from "../../application/dashboard/model"

export function EvidenceClient({ brandId, initial }: { brandId: string; initial: WeekEvidence[] }) {
  const router = useRouter()
  const [week, setWeek] = useState(shiftWeek(currentWeek(), -1)), [observation, setObservation] = useState(""), [source, setSource] = useState("")
  const [level, setLevel] = useState<"public" | "connected" | "downstream">("public")
  const [execution, setExecution] = useState(""), [unknowns, setUnknowns] = useState(""), [context, setContext] = useState("")
  const [busy, setBusy] = useState(false), [message, setMessage] = useState(""), [reviews, setReviews] = useState(initial)
  function selectWeek(value: string) {
    setWeek(value)
    const existing = reviews.find((r) => r.week === value)
    setObservation(existing?.observations[0]?.observation ?? ""); setSource(existing?.observations[0]?.source ?? ""); setLevel(existing?.observations[0]?.level ?? "public")
    setExecution(existing?.execution.join("\n") ?? ""); setUnknowns(existing?.unknowns.join("\n") ?? ""); setContext(existing?.businessContext ?? "")
  }
  async function save() {
    setBusy(true); setMessage("")
    const evidence: WeekEvidence = { week, reviewedAt: new Date().toISOString(), availability: observation.trim() ? "available" : "unavailable", observations: observation.trim() ? [{ level, observation: observation.trim(), source: source.trim() }] : [], execution: execution.trim() ? [execution.trim()] : [], unknowns: unknowns.trim() ? [unknowns.trim()] : ["მიზეზობრივი კავშირი და ბიზნესგავლენა დაუდგენელია."], businessContext: context.trim() }
    try {
      const response = await fetch("/api/social-evidence", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ brandId, evidence }) })
      if (response.status === 402) { router.push("/subscription"); return }
      const result = await response.json(); if (!response.ok) throw Error(result.message)
      setReviews((r) => [evidence, ...r.filter((e) => e.week !== week)].sort((a, b) => b.week.localeCompare(a.week)))
      setMessage("შეფასება შენახულია. შემდეგი კვირის გეგმა ამ კონტექსტს გაითვალისწინებს; სტრატეგიული მიზანი უცვლელია.")
    } catch (e) { setMessage(e instanceof Error ? e.message : "შენახვა ვერ დასრულდა.") } finally { setBusy(false) }
  }
  return <div className="strategy-client"><div><p className="eyebrow">გამოქვეყნება → დაკვირვება → სწავლა → შემდეგი გეგმა</p><h1>რა მოხდა და რა ვიცით.</h1><p>ავტომატური ანალიტიკის მიღება ჯერ არ არის ჩართული. შეგიძლიათ შეინახოთ რეალური დაკვირვება წყაროსთან ერთად, ან პირდაპირ აღნიშნოთ, რომ შედეგები ჯერ უცნობია.</p></div>
    <form className="ws-card strategy-form" onSubmit={(e) => { e.preventDefault(); void save() }}><h2>კვირის ხელმისაწვდომი სიგნალების შეფასება</h2><label>კვირის ორშაბათი<input type="date" required value={week} max={currentWeek()} onChange={(e) => selectWeek(e.target.value)} /></label><label>რა შესრულდა<textarea maxLength={2500} rows={3} value={execution} onChange={(e) => setExecution(e.target.value)} placeholder="განასხვავეთ მომზადებული ტექსტი და რეალურად გამოქვეყნებული პოსტი." /></label><label>მონაცემის ტიპი<select value={level} onChange={(e) => setLevel(e.target.value as typeof level)}><option value="public">საჯაროდ ხილული დაკვირვება</option><option value="connected">სოციალური ანგარიშის რეალური მონაცემი</option><option value="downstream">ვებსაიტის ან სხვა შემდგომი წყაროს მონაცემი</option></select></label><label>რა ვნახეთ — სურვილისამებრ<textarea maxLength={2500} rows={4} value={observation} onChange={(e) => setObservation(e.target.value)} placeholder="თუ შედეგები არ გაქვთ, დატოვეთ ცარიელი. ეს შეფასებაშიც პირდაპირ დაფიქსირდება." /></label><label>დაკვირვების წყარო<input maxLength={2500} required={Boolean(observation.trim())} value={source} onChange={(e) => setSource(e.target.value)} placeholder="პოსტის ბმული ან ანგარიშის/ექსპორტის დასახელება და პერიოდი" /></label><label>რა რჩება უცნობი<textarea maxLength={2500} rows={3} value={unknowns} onChange={(e) => setUnknowns(e.target.value)} /></label><label>ახალი ბიზნესმოვლენა ან შეზღუდვა — სურვილისამებრ<textarea maxLength={2500} rows={3} value={context} onChange={(e) => setContext(e.target.value)} /></label><button className="ws-button" disabled={busy}>{busy ? "ინახება…" : "შეფასების შენახვა"}</button><p>ეს თქვენი მოწოდებული დაკვირვებაა. Operator განასხვავებს ფაქტს, ინტერპრეტაციასა და ჰიპოთეზას შემდეგი გეგმის დასაბუთებაში.</p></form>
    {message ? <p role="status">{message}</p> : null}
    {reviews.map((r) => <section className="ws-card" key={r.week}><h2>{r.week} · {r.availability === "available" ? "დაკვირვებები ხელმისაწვდომია" : "შედეგები უცნობია"}</h2>{r.execution.map((v) => <p key={v}>{v}</p>)}{r.observations.map((o, i) => <article key={i}><strong>{o.level === "public" ? "საჯარო" : o.level === "connected" ? "ანგარიშის მონაცემი" : "შემდგომი სიგნალი"} · მომხმარებლის მოწოდებული</strong><p>{o.observation}</p><small>წყარო: {o.source}</small></article>)}{r.unknowns.map((v) => <p key={v}>უცნობია: {v}</p>)}<p>{r.businessContext}</p><button className="ws-button ws-button-outline" onClick={() => selectWeek(r.week)}>შეფასების განახლება</button></section>)}
  </div>
}
