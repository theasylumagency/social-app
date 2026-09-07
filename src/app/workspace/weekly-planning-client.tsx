"use client"

import Link from "next/link"
import { useEffect, useRef, useState } from "react"
import { displayDate } from "../../application/dashboard/model"
import { PLANNING_STEPS, type PlanningRun, type PlanningView } from "../../blueprints/social/weekly-planning/model"
import type { AudienceRef } from "../../blueprints/social/audience"

const stages = { objective: "ვირჩევთ კვირის მთავარ მიზანს", focus: "ვადგენთ აუდიტორიის ფოკუსს", directions: "ვაყალიბებთ კონტენტის მიმართულებებს", adaptation: "ვაზუსტებთ თითოეულის საკომუნიკაციო როლს", experiment: "ვაფასებთ ექსპერიმენტის საჭიროებას", review: "ვამოწმებთ გეგმის შესაბამისობას", ready: "გეგმა მზადაა განსახილველად" }
const biasLabels = { balanced: "დაბალანსებული ახსნა", moreExplanatory: "უკეთ გაგების დახმარება", moreDecisionOriented: "არჩევანში დახმარება", moreTrustFocused: "ნდობის საფუძვლის გაძლიერება", morePractical: "პრაქტიკული ნაბიჯის გარკვევა" }
const statusLabels = { queued: "მზადდება", running: "მზადდება", ready: "განსახილველია", failed: "დროებით შეჩერებულია", approved: "დადასტურებულია", changesRequested: "დაზუსტება მოითხოვეთ", superseded: "წინა ვერსია" }
const checkLabels = { brandSpecificity: "თქვენი ბიზნესის სპეციფიკა", focusCoherence: "ერთი მიზანი, განსხვავებული როლები", voiceCompatibility: "ბრენდის ხმა და საზღვრები", evidenceDiscipline: "რისი მტკიცების საფუძველი გვაქვს", priorityResponse: "როგორ გავითვალისწინეთ თქვენი პრიორიტეტი" }

function audience(run: PlanningRun, ref: AudienceRef) {
  return run.payload.basis.payload.landscape?.entries.find((e) => e.source === ref.source && e.audience.id === ref.id)?.audience
}
function PlanReport({ run }: { run: PlanningRun }) {
  const p = run.payload
  const plan = p.plan!
  const selectedGoals = p.basis.payload.goals.filter((g) => p.basis.payload.feedback.selectedGoalIds?.includes(g.id))
  const alignedGoals = selectedGoals.filter((_, i) => p.review?.brandGoalKeys.includes(`g${i + 1}`))
  const primary = audience(run, plan.audienceFocus.primary)
  return <div className="wp-report">
    <section className="wp-objective"><div className="wp-kicker"><span className="wp-dot" /><span>{statusLabels[run.status]}</span><span>ვერსია {run.version}</span></div><p className="wp-eyebrow">ამ კვირის მთავარი ამოცანა</p><h2>{plan.objective.objective}</h2><p className="wp-objective-reason">{plan.objective.rationale}</p><div className="wp-goal-link"><span>ემსახურება ბრენდის მიზანს</span>{alignedGoals.map((g) => <strong key={g.id}>{g.title}</strong>)}</div></section>
    <section className="wp-focus"><div className="wp-section-label"><span>01</span><div><p className="wp-eyebrow">ამ კვირაში ვისთან გვინდა პროგრესი</p><h2>ვიწრო ფოკუსი. მკაფიო მიზეზი.</h2></div></div><div className="wp-focus-grid"><article><span className="wp-card-label">მთავარი აუდიტორია</span><h3>{primary?.name}</h3><p>{primary && "buyingSituation" in primary ? primary.buyingSituation : primary?.description}</p>{primary && "currentNeed" in primary ? <p className="wp-need"><strong>სჭირდება:</strong> {primary.currentNeed}</p> : null}</article>{plan.audienceFocus.secondary.map((ref) => { const a = audience(run, ref); return <article className="wp-secondary" key={ref.id}><span className="wp-card-label">დამატებითი აუდიტორია</span><h3>{a?.name}</h3><p>{a && "buyingSituation" in a ? a.buyingSituation : a?.description}</p></article> })}</div><p className="wp-focus-reason">{plan.audienceFocus.rationale}</p><small>ეს ამ კვირის არჩევანია. ბრენდის დანარჩენი აუდიტორიები შენარჩუნებულია.</small></section>
    <section className="wp-directions"><div className="wp-section-label"><span>02</span><div><p className="wp-eyebrow">თითოეულ მიმართულებას თავისი საქმე აქვს</p><h2>რით მივალთ ამ მიზნამდე</h2></div><span className="wp-count">{plan.contentDirections.length} მიმართულება</span></div><div className="wp-direction-list">{plan.contentDirections.map((d) => { const primary = audience(run, d.audienceDirection.primaryAudience); const profile = p.basis.payload.profiles.find((profile) => profile.audience.source === d.audienceDirection.primaryAudience.source && profile.audience.id === d.audienceDirection.primaryAudience.id); return <article className="wp-direction" key={d.id}><span className="wp-direction-number">{String(d.order + 1).padStart(2, "0")}</span><div><h3>{d.direction}</h3><p className="wp-direction-purpose">{d.purpose}</p><div className="wp-direction-tags"><span>{primary?.name}</span><span>{biasLabels[d.audienceDirection.bias]}</span></div><details className="wp-details"><summary>რატომ ეს მიმართულება და როგორ უნდა გაიჟღეროს <span aria-hidden="true">+</span></summary><p>{d.rationale}</p>{profile ? <><h4>კომუნიკაციის მიდგომა</h4><p>{profile.communicationGoal}</p><ul>{profile.preferredFraming.map((f) => <li key={f}>{f}</li>)}</ul></> : null}{d.audienceDirection.secondaryAudiences.length ? <p><strong>ასევე გამოსადეგია:</strong> {d.audienceDirection.secondaryAudiences.map((ref) => audience(run, ref)?.name).join(" · ")}</p> : null}</details></div></article> })}</div><p className="wp-caption">ეს მიმართულებები კონტენტის მომზადების საფუძველია. კონკრეტული პოსტები და გამოქვეყნების დრო ცალკე განისაზღვრება.</p></section>
    <div className="wp-lower-grid"><section className="wp-omissions"><p className="wp-eyebrow">ფოკუსს არჩევანი იცავს</p><h2>რას არ ვაქცევთ ამ კვირის პრიორიტეტად</h2><ul>{plan.objective.deliberateOmissions.map((item) => <li key={item}>{item}</li>)}</ul></section><section className="wp-signals"><p className="wp-eyebrow">შემდეგ რა უნდა დავაკვირდეთ</p><h2>პროგრესის ნიშნები</h2><ul>{p.review?.progressSignals.map((signal) => <li key={signal}>{signal}</li>)}</ul><small>ეს დაკვირვების ნიშნებია. ამ კვირის შედეგები ჯერ არ გაზომილა.</small></section></div>
    <section className="wp-envelope"><p className="wp-eyebrow">ბრენდის ხმა ყველა მიმართულებაში</p><h2>იგივე ხმა. ამ კვირის ამოცანაზე მორგებული.</h2><div className="wp-tone-tags">{p.basis.payload.envelope!.toneRange.map((tone) => <span key={tone}>{tone}</span>)}</div><p>{p.review?.checks.voiceCompatibility}</p><details className="wp-details"><summary>საკომუნიკაციო წესები, რომლებსაც გეგმა ეყრდნობა</summary><ul>{p.basis.payload.envelope!.framingRules.map((r) => <li key={r}>{r}</li>)}</ul><h3>რა უნდა ავირიდოთ</h3><ul>{p.basis.payload.envelope!.avoid.map((r) => <li key={r}>{r}</li>)}</ul></details></section>
    <section className="wp-experiment"><div><p className="wp-eyebrow">რას ვსწავლობთ მიზანმიმართულად</p><h2>{plan.experimentDecision.decision === "experiment" ? "ერთი შეზღუდული ექსპერიმენტი" : "ამ კვირას ექსპერიმენტს არ ვამატებთ"}</h2><p>{plan.experimentDecision.rationale}</p></div>{plan.experimentDecision.experiment ? <dl>{[{ label: "ჰიპოთეზა", value: plan.experimentDecision.experiment.hypothesis }, { label: "რას ვცვლით", value: plan.experimentDecision.experiment.variable }, { label: "რას ვადარებთ", value: plan.experimentDecision.experiment.comparison }, { label: "რას დავაკვირდებით", value: plan.experimentDecision.experiment.learningSignal }, { label: "საზღვრები", value: plan.experimentDecision.experiment.guardrails.join(" · ") }].map((item) => <div key={item.label}><dt>{item.label}</dt><dd>{item.value}</dd></div>)}</dl> : null}</section>
    <details className="wp-quality wp-details"><summary>გეგმის შესაბამისობის შემოწმება <span aria-hidden="true">+</span></summary>{p.review ? Object.entries(p.review.checks).map(([key, value]) => <div key={key}><h3>{checkLabels[key as keyof typeof checkLabels]}</h3><p>{value}</p></div>) : null}<p>საფუძველი დადასტურებულია {displayDate(p.basis.confirmedAt, { year: "numeric" })}. <Link href="/workspace/brand">ბრენდის ხედვის ნახვა ↗</Link></p></details>
  </div>
}

export function WeeklyPlanningClient({ initial, initialPriority, brandId, ownerId, week }: { initial: PlanningView; initialPriority: string; brandId: string; ownerId: string; week: string }) {
  const [view, setView] = useState(initial)
  const [priority, setPriority] = useState(initial.run?.payload.priority ?? initialPriority)
  const [note, setNote] = useState("")
  const [revising, setRevising] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [restored, setRestored] = useState<string | null>(null)
  const requestId = useRef<string>(crypto.randomUUID())
  const wakeAt = useRef(0)
  const run = view.run
  const runId = run?.id
  const working = run?.status === "queued" || run?.status === "running"
  const draftKey = `unda-weekly-draft-v1:${ownerId}:${brandId}:${week}:${run?.version ?? "new"}`
  const url = `/api/weekly-planning?brand=${encodeURIComponent(brandId)}&week=${week}`
  const blocking = run?.payload.review?.concerns.some((c) => c.severity === "blocking") ?? false

  useEffect(() => {
    let active = true
    queueMicrotask(() => {
      if (!active) return
      try { const raw = localStorage.getItem(draftKey); if (raw) { const data = JSON.parse(raw); if (typeof data.priority === "string" && data.priority.length <= 1200) setPriority(data.priority); if (typeof data.note === "string" && data.note.length <= 2000) { setNote(data.note); setRevising(Boolean(data.note)) } } } catch { /* Server plan is authoritative. */ }
      setRestored(draftKey)
    })
    return () => { active = false }
  }, [draftKey])
  useEffect(() => {
    if (restored !== draftKey) return
    try { localStorage.setItem(draftKey, JSON.stringify({ priority, note })) } catch { /* Input remains in the current form. */ }
  }, [draftKey, restored, priority, note])

  useEffect(() => {
    if (!working || !runId) return
    let active = true
    let timer: ReturnType<typeof setTimeout>
    const poll = async () => {
      try {
        const response = await fetch(url, { cache: "no-store" })
        if (!response.ok) throw Error()
        const latest = await response.json() as PlanningView
        if (!active) return
        setView(latest); setError("")
        const current = latest.run
        if (current && (current.status === "queued" || (current.status === "running" && current.leaseUntil && Date.parse(current.leaseUntil) < Date.now())) && Date.now() - wakeAt.current > 12_000) {
          wakeAt.current = Date.now()
          await fetch("/api/weekly-planning", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "resume", id: current.id, version: current.version }) })
        }
      } catch { if (active) setError("კავშირი დროებით გაწყდა. გეგმის შენახულ მდგომარეობას ხელახლა შევამოწმებთ.") }
      if (active) timer = setTimeout(poll, 3500)
    }
    void poll()
    return () => { active = false; clearTimeout(timer) }
  }, [working, runId, url])

  async function action(kind: "start" | "revise" | "approve" | "retry", revisionNote = note) {
    setBusy(true); setError("")
    try {
      const generating = kind === "start" || kind === "revise"
      const response = await fetch("/api/weekly-planning", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: kind, id: generating ? requestId.current : run?.id, version: run?.version, brandId, week, priority, ...(kind === "revise" ? { parentId: run?.id, parentVersion: run?.version, revisionNote } : {}) }) })
      const data = await response.json() as PlanningView & { message?: string }
      if (!response.ok) {
        if (response.status === 409) { const fresh = await fetch(url, { cache: "no-store" }); if (fresh.ok) setView(await fresh.json()) }
        throw Error(data.message ?? "გეგმის შენახვა ვერ დასრულდა.")
      }
      try { localStorage.removeItem(draftKey) } catch {}
      requestId.current = crypto.randomUUID(); setView(data); setNote(""); setRevising(false)
    } catch (e) { setError(e instanceof Error ? e.message : "მოქმედება ვერ დასრულდა.") }
    finally { setBusy(false) }
  }

  if (!view.basis) return <section className="wp-start"><p className="wp-eyebrow">გეგმას ძლიერი საფუძველი სჭირდება</p><h2>ჯერ ბოლომდე გავიცნოთ თქვენი ბრენდი.</h2><p>კვირის გეგმა დაეყრდნობა დადასტურებულ საქმიანობას, აუდიტორიებს, მიზნებსა და კომუნიკაციის ჩარჩოს.</p><Link className="wp-button" href={`/onboarding?brand=${encodeURIComponent(brandId)}`}>ბრენდის გაცნობის დასრულება →</Link></section>
  return <div className="wp-app">
    {error ? <p className="wp-error" role="alert">{error}</p> : null}
    {!run ? <section className="wp-start"><div><p className="wp-eyebrow">ბრენდის ცოდნიდან — ამ კვირის არჩევანამდე</p><h2>მეტი სიცხადე იმაზე,<br />რისთვის ვილაპარაკებთ.</h2><p>თქვენი საქმიანობა, აუდიტორიები და ბრენდის ხმა უკვე ვიცით. ახლა მათ ერთ კვირის მიზნად და კონკრეტულ საკომუნიკაციო მიმართულებებად ვაქცევთ.</p><div className="wp-foundation-chips"><span>{view.basis.payload.landscape?.entries.filter((e) => e.influence !== "none").length} აუდიტორიული სიტუაცია</span><span>{view.basis.payload.feedback.selectedGoalIds?.length} არჩეული მიზანი</span><span>შენახული კომუნიკაციის ჩარჩო</span></div><Link className="wp-text-link" href="/workspace/brand">რას ვეყრდნობით ↗</Link></div><form onSubmit={(e) => { e.preventDefault(); void action("start") }}><label htmlFor="wp-priority">ამ კვირაში რამეს განსაკუთრებული ყურადღება სჭირდება?</label><textarea id="wp-priority" rows={5} maxLength={1200} value={priority} onChange={(e) => setPriority(e.target.value)} placeholder="მაგ. ახალი შეთავაზება გვაქვს, ან ხშირად გვიმეორებენ ერთსა და იმავე კითხვას…" /><p>სურვილისამებრ. თუ პრიორიტეტს არ მიუთითებთ, მიზანს ბრენდის დადასტურებული ხედვიდან შევარჩევთ.</p><button className="wp-button" disabled={busy}>{busy ? "ვიწყებთ…" : "შემომთავაზე კვირის გეგმა →"}</button><small>ჯერ გეგმას განიხილავთ და დაადასტურებთ.</small></form></section> : null}
    {view.stale ? <section className="wp-notice"><h2>ბრენდის ცოდნა ამ გეგმის შემდეგ განახლდა.</h2><p>ახალი ვერსია უკვე გაითვალისწინებს თქვენს ბოლო დაზუსტებებს. ძველი გეგმა ისტორიაში დარჩება.</p>{!working ? <button className="wp-button wp-button-outline" disabled={busy} onClick={() => void action("revise", "გეგმა განაახლე ბრენდის ბოლო დადასტურებული ცოდნისა და არჩეული მიზნების მიხედვით.")}>გეგმის ახალ ცოდნაზე განახლება</button> : null}</section> : null}
    {working && run ? <section className="wp-progress" aria-live="polite"><p className="wp-eyebrow">ბრენდის ცოდნა მუშაობას იწყებს</p><h2>{run.payload.objective?.objective ?? "ვარჩევთ, რა იქნება ამ კვირაში ყველაზე სასარგებლო."}</h2><ol>{PLANNING_STEPS.filter((s) => s !== "ready").map((step, i) => { const current = PLANNING_STEPS.indexOf(run.step); return <li key={step} className={i < current ? "is-complete" : i === current ? "is-current" : ""}><span>{i < current ? "✓" : String(i + 1).padStart(2, "0")}</span><div><strong>{stages[step]}</strong><small>{i < current ? "შენახულია" : i === current ? "მიმდინარეობს…" : "შემდეგი ეტაპი"}</small></div></li> })}</ol><p>დასრულებული ეტაპები ინახება. გვერდის განახლება ან დაბრუნება პროცესს თავიდან არ დაიწყებს.</p></section> : null}
    {run?.status === "failed" ? <section className="wp-error"><h2>გაგრძელება შენახული ეტაპიდან შეგვიძლია.</h2><p>{run.error}</p><p>{stages[run.step]}</p><button className="wp-button" disabled={busy} onClick={() => void action("retry")}>ამ ეტაპის ხელახლა ცდა</button><button className="wp-text-link" onClick={() => setRevising(true)}>პრიორიტეტის დაზუსტება</button></section> : null}
    {run?.payload.plan && !working ? <><PlanReport run={run} />{run.payload.review?.concerns.length ? <section className="wp-concerns"><h2>{blocking ? "დადასტურებამდე დასაზუსტებელია" : "რა გავითვალისწინოთ მომზადებისას"}</h2>{run.payload.review.concerns.map((c, i) => <article key={i}><span>{c.severity === "blocking" ? "დასაზუსტებელია" : "გასათვალისწინებელია"}</span><p>{c.message}</p>{c.directionKeys.length ? <small>მიმართულებები: {c.directionKeys.map((key) => key.slice(1)).join(", ")}</small> : null}</article>)}</section> : null}<section className="wp-review-actions"><div><p className="wp-eyebrow">{run.status === "approved" ? "გადაწყვეტილება შენახულია" : "თქვენი ხედვა გეგმას ასრულებს"}</p><h2>{run.status === "approved" ? "ამ კვირის მიმართულება დადასტურებულია." : "ამ მიმართულებით წავიდეთ?"}</h2><p>{run.status === "approved" ? "მიზანი, აუდიტორიები და მიმართულებები მზადაა შემდეგი ეტაპისთვის — კონტენტის მომზადებისთვის." : "დადასტურება შეინახავს ამ ვერსიას კვირის მოქმედ გეგმად."}</p></div><div>{run.status === "ready" ? <button className="wp-button" disabled={busy || blocking || view.stale || revising} onClick={() => void action("approve")}>{busy ? "ინახება…" : "ვადასტურებ კვირის გეგმას →"}</button> : null}<button className="wp-button wp-button-outline" disabled={busy} onClick={() => setRevising(!revising)}>{revising ? "დაზუსტების დახურვა" : "გეგმის დაზუსტება"}</button></div></section></> : null}
    {revising && run && !working ? <form className="wp-revision" onSubmit={(e) => { e.preventDefault(); void action("revise") }}><h2>რა უნდა შეიცვალოს გეგმაში?</h2><label htmlFor="wp-revision-note">თქვენი დაზუსტება<textarea id="wp-revision-note" required minLength={10} maxLength={2000} rows={4} value={note} onChange={(e) => setNote(e.target.value)} placeholder="მაგ. ამ კვირაში ჯერ შეთავაზების განსხვავება უნდა ავხსნათ; პროცესის დეტალებზე შემდეგ გადავიდეთ." /></label><label htmlFor="wp-revised-priority">კვირის პრიორიტეტი<textarea id="wp-revised-priority" maxLength={1200} rows={3} value={priority} onChange={(e) => setPriority(e.target.value)} /></label><p>ახალი ვერსია თქვენს შენიშვნასა და მიმდინარე ბრენდის ცოდნას დაეყრდნობა. წინა დადასტურებული გეგმა ახალი ვერსიის დადასტურებამდე შენარჩუნდება.</p><button className="wp-button" disabled={busy}>დაზუსტებული გეგმის მომზადება →</button></form> : null}
    {view.approved && view.approved.id !== run?.id ? <details className="wp-previous wp-details"><summary>წინა დადასტურებული გეგმა კვლავ შენახულია · ვერსია {view.approved.version}</summary><h3>{view.approved.payload.plan?.objective.objective}</h3><ol>{view.approved.payload.plan?.contentDirections.map((d) => <li key={d.id}>{d.direction}</li>)}</ol></details> : null}
    {view.history.length > 1 ? <details className="wp-history wp-details"><summary>გეგმის ვერსიები და გადაწყვეტილებები</summary>{view.history.map((item) => <article key={item.id}><span>ვერსია {item.version} · {statusLabels[item.status]}</span><time dateTime={item.updatedAt}>{displayDate(item.updatedAt, { hour: "2-digit", minute: "2-digit" })}</time><p>{item.objective ?? "გეგმის მომზადება"}</p></article>)}</details> : null}
  </div>
}
