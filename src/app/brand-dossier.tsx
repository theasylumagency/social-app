"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import type { DiscoveryPayload, SourceCitation } from "../blueprints/social/brand-discovery/model"

type Props = {
  payload: DiscoveryPayload
  busy?: boolean
  onFeedback?: (changes: Record<string, unknown>) => Promise<void>
  onConfirm?: (goalIds: string[], language: "ka" | "en") => Promise<void>
  draftKey?: string
  refineHref?: string
}
const stanceLabels = { agree: "ვეთანხმები", unsure: "არ ვარ დარწმუნებული", disagree: "არ ვეთანხმები" } as const
const confidenceLabels = { tentative: "საწყისი ვარაუდი", reasonable: "დასაბუთებული ჰიპოთეზა", strong: "წყაროებით გამყარებული ჰიპოთეზა" }

function Citation({ citation, payload }: { citation: SourceCitation; payload: DiscoveryPayload }) {
  const source = payload.sources.find((s) => s.key === citation.sourceKey)
  return <details className="bd-citation"><summary>რას ვეყრდნობით <span aria-hidden="true">↗</span></summary><blockquote>{citation.exactExcerpt}</blockquote>{source?.url ? <a href={source.url} target="_blank" rel="noreferrer">{new URL(source.url).hostname} ↗</a> : <small>თქვენი დამატებული ინფორმაცია</small>}</details>
}

export function BrandDossierView({ payload: p, busy = false, onFeedback, onConfirm, refineHref, draftKey }: Props) {
  const u = p.understanding!
  const envelope = p.envelope
  const [stances, setStances] = useState(() => p.feedback.stances.map((s) => ({ audienceHypothesisId: s.audienceHypothesisId as string, stance: s.stance, note: s.note ?? "" })))
  const [founderAudiences, setFounderAudiences] = useState(() => p.feedback.founderAudiences.map((a) => ({ id: a.id as string, name: a.name, description: a.description })))
  const [feedbackDirty, setFeedbackDirty] = useState(false)
  const [noteOpen, setNoteOpen] = useState(false)
  const [businessNote, setBusinessNote] = useState("")
  const [language, setLanguage] = useState(p.input.language)
  const [goalIds, setGoalIds] = useState(() => p.feedback.selectedGoalIds ?? p.goals.map((g) => g.id))
  const [draftRestored, setDraftRestored] = useState(false)
  useEffect(() => {
    let active = true
    queueMicrotask(() => {
      if (!active) return
      try {
        const raw = draftKey ? localStorage.getItem(draftKey) : null
        if (raw) {
          const saved = JSON.parse(raw)
          if (Array.isArray(saved.stances) && saved.stances.length <= 5 && saved.stances.every((s: { audienceHypothesisId?: string; stance?: string; note?: string }) => p.hypotheses.some((h) => h.id === s.audienceHypothesisId) && ["agree", "unsure", "disagree"].includes(s.stance ?? "") && typeof s.note === "string" && s.note.length <= 1000)) setStances(saved.stances)
          if (Array.isArray(saved.founderAudiences) && saved.founderAudiences.length <= 4 && saved.founderAudiences.every((a: { id?: string; name?: string; description?: string }) => typeof a.id === "string" && typeof a.name === "string" && a.name.length <= 120 && typeof a.description === "string" && a.description.length <= 1000)) setFounderAudiences(saved.founderAudiences)
          if (typeof saved.businessNote === "string" && saved.businessNote.length <= 4000) { setBusinessNote(saved.businessNote); setNoteOpen(Boolean(saved.businessNote)) }
          if (Array.isArray(saved.goalIds) && saved.goalIds.every((id: string) => p.goals.some((g) => g.id === id))) setGoalIds(saved.goalIds)
          if (["ka", "en"].includes(saved.language)) setLanguage(saved.language)
          setFeedbackDirty(saved.feedbackDirty === true)
        }
      } catch { /* A malformed local draft never replaces the server report. */ }
      setDraftRestored(true)
    })
    return () => { active = false }
  }, [draftKey, p])
  useEffect(() => {
    if (!draftKey || !draftRestored) return
    try { localStorage.setItem(draftKey, JSON.stringify({ stances, founderAudiences, businessNote, goalIds, language, feedbackDirty })) } catch { /* The saved report remains on the server. */ }
  }, [draftKey, draftRestored, stances, founderAudiences, businessNote, goalIds, language, feedbackDirty])
  const editable = !!onFeedback
  const setStance = (id: string, stance: keyof typeof stanceLabels, note?: string) => {
    setStances((current) => [...current.filter((s) => s.audienceHypothesisId !== id), { audienceHypothesisId: id, stance, note: note ?? current.find((s) => s.audienceHypothesisId === id)?.note ?? "" }])
    setFeedbackDirty(true)
  }
  return <div className="bd-dossier">
    <header className="bd-reveal">
      <div className="bd-reveal-kicker"><span className="bd-live-dot" />{editable ? "ჩვენი პირველი ხედვა თქვენს ბიზნესზე" : "თქვენი ბრენდის სამუშაო საფუძველი"}<span>{p.sources.length} წყარო</span></div>
      <h1>{u.name}</h1>
      <p className="bd-summary">{u.summary}</p>
      <div className="bd-reveal-footer"><p>ბიზნესის გაგება, რომელიც შემდეგ გადაწყვეტილებას აზრს აძლევს.</p>{editable ? <button type="button" className="bd-text-button" onClick={() => setNoteOpen(!noteOpen)} aria-expanded={noteOpen}>რაღაც დასაზუსტებელია <span aria-hidden="true">↗</span></button> : refineHref ? <Link className="bd-text-button" href={refineHref}>ბრენდის დაზუსტება ↗</Link> : null}</div>
    </header>
    {noteOpen && onFeedback ? <form className="bd-refinement" onSubmit={(event) => { event.preventDefault(); void onFeedback({ kind: "business", note: businessNote }) }}><label htmlFor="bd-business-note">რა უნდა იცოდეს UNDA-მ უფრო ზუსტად?</label><textarea id="bd-business-note" name="businessNote" rows={4} minLength={10} maxLength={4000} required value={businessNote} onChange={(e) => setBusinessNote(e.target.value)} placeholder="მაგ. ეს პროექტის მაგალითია და არა ჩვენი ცალკე მომსახურება…" /><p>თქვენი განმარტება ცალკე შეინახება. მის საფუძველზე თავიდან გადავამოწმებთ საქმიანობას, აუდიტორიებსა და კომუნიკაციას.</p><button className="bd-button" disabled={busy}>დაზუსტების გათვალისწინება</button><button type="button" className="bd-text-button" disabled={busy} onClick={() => { setBusinessNote(""); setNoteOpen(false) }}>მონახაზის გაუქმება</button></form> : null}
    {p.sourceWarnings.length ? <div className="bd-notice">{p.sourceWarnings.map((warning) => <p key={warning}>{warning}</p>)}</div> : null}
    <nav className="bd-section-nav" aria-label="ბრენდის გაცნობის შედეგები"><a href="#bd-business">01 · ბიზნესი</a><a href="#bd-audiences">02 · აუდიტორია</a><a href="#bd-goals">03 · მიზნები</a><a href="#bd-voice">04 · კომუნიკაცია</a></nav>

    <section id="bd-business" className="bd-section">
      <div className="bd-section-heading"><span className="bd-section-number">01</span><div><p className="bd-eyebrow">საქმიანობა და განსხვავება</p><h2>რას ვხედავთ ზედაპირის მიღმა</h2></div></div>
      <div className="bd-business-grid"><article><h3>როგორ ქმნით ღირებულებას</h3><p>{u.businessModel}</p></article><article><h3>რა ადგილს იკავებთ</h3><p>{u.positioning}</p></article><article><h3>რატომ არის ეს საჭირო</h3><p>{u.valueProposition}</p></article></div>
      <div className="bd-subheading"><h3>შეთავაზების სტრუქტურა</h3><span>{u.offers.length} მიმართულება</span></div>
      <div className="bd-offers">{u.offers.map((offer, i) => <article key={offer.name}><span className="bd-offer-index">{String(i + 1).padStart(2, "0")}</span><h4>{offer.name}</h4><p>{offer.description}</p><Citation citation={offer} payload={p} /></article>)}</div>
      <div className="bd-signals"><h3>ნიშნები, რომლებმაც ჩვენი ხედვა განსაზღვრა</h3>{u.distinctiveSignals.map((signal) => <div className="bd-signal" key={signal.statement}><span aria-hidden="true">↗</span><div><p>{signal.statement}</p><Citation citation={signal} payload={p} /></div></div>)}</div>
    </section>

    <section id="bd-audiences" className="bd-section">
      <div className="bd-section-heading"><span className="bd-section-number">02</span><div><p className="bd-eyebrow">ვისთვის ხდებით მნიშვნელოვანი</p><h2>ადამიანები გადაწყვეტილების წინაშე</h2><p>აუდიტორიებს ვარჩევთ საჭიროებისა და არჩევანის მომენტის მიხედვით. ეს სამუშაო ჰიპოთეზებია — თქვენი ცოდნა მათ უკეთესს გახდის.</p></div></div>
      <div className="bd-audiences">{p.hypotheses.map((audience, i) => {
        const stance = stances.find((s) => s.audienceHypothesisId === audience.id)
        const profile = p.profiles.find((profile) => profile.audience.id === audience.id)
        const evidence = p.evidence.find((e) => audience.evidenceIds.includes(e.id as typeof audience.evidenceIds[number]))
        return <article className={`bd-audience ${stance ? `bd-stance-${stance.stance}` : ""}`} key={audience.id}>
          <div className="bd-card-top"><span>აუდიტორია {String(i + 1).padStart(2, "0")}</span><span>{confidenceLabels[audience.confidenceBand]}</span></div>
          <h3>{audience.name}</h3><p className="bd-audience-situation">{audience.buyingSituation}</p>
          <dl><div><dt>რა სჭირდება ახლა</dt><dd>{audience.currentNeed}</dd></div><div><dt>რა აყოვნებს გადაწყვეტილებას</dt><dd>{audience.likelyBarriers.join(" · ")}</dd></div></dl>
          <div className="bd-rationale"><strong>რატომ ვფიქრობთ ასე</strong><p>{audience.rationale}</p></div>
          <details className="bd-detail"><summary>კითხვები, ვარაუდები და კომუნიკაცია <span aria-hidden="true">+</span></summary><h4>რას გეკითხებათ ეს ადამიანი</h4><ul>{audience.mainQuestions.map((q) => <li key={q}>{q}</li>)}</ul>{audience.assumptions.length ? <><h4>რა რჩება ვარაუდად</h4><ul>{audience.assumptions.map((a) => <li key={a}>{a}</li>)}</ul></> : null}{profile ? <><h4>როგორ ვესაუბრებით</h4><p>{profile.communicationGoal}</p><ul>{profile.preferredFraming.map((f) => <li key={f}>{f}</li>)}</ul></> : null}{evidence ? <Citation citation={evidence} payload={p} /> : <p>პირდაპირი აუდიტორიული მტკიცებულება ჯერ არ გვაქვს.</p>}</details>
          {editable ? <div className="bd-founder-response"><p>თქვენი გამოცდილებით?</p><div className="bd-stance-controls">{(Object.keys(stanceLabels) as (keyof typeof stanceLabels)[]).map((value) => <button type="button" aria-pressed={stance?.stance === value} disabled={busy} key={value} onClick={() => setStance(audience.id, value)}>{stanceLabels[value]}</button>)}</div>{stance ? <label className="bd-note-label">კონტექსტი სურვილისამებრ<input name={`note-${audience.id}`} maxLength={1000} value={stance.note} onChange={(e) => setStance(audience.id, stance.stance, e.target.value)} placeholder="რა იცით ამ აუდიტორიაზე ჩვენზე უკეთ…" /></label> : null}</div> : stance ? <p className="bd-saved-stance">თქვენი პასუხი: {stanceLabels[stance.stance]}{stance.note ? ` — ${stance.note}` : ""}</p> : null}
        </article>
      })}</div>
      {founderAudiences.length ? <div className="bd-founder-audiences"><h3>თქვენგან დამატებული აუდიტორიები</h3>{founderAudiences.map((audience, i) => <div key={audience.id} className="bd-founder-card">{editable ? <><label>აუდიტორიის სახელი<input name={`founder-name-${i}`} maxLength={120} value={audience.name} onChange={(e) => { setFounderAudiences((list) => list.map((a, index) => index === i ? { ...a, name: e.target.value } : a)); setFeedbackDirty(true) }} /></label><label>რა სიტუაციაშია და რა სჭირდება<textarea name={`founder-description-${i}`} maxLength={1000} rows={3} value={audience.description} onChange={(e) => { setFounderAudiences((list) => list.map((a, index) => index === i ? { ...a, description: e.target.value } : a)); setFeedbackDirty(true) }} /></label><button type="button" className="bd-text-button" onClick={() => { setFounderAudiences((list) => list.filter((_, index) => index !== i)); setFeedbackDirty(true) }}>ამოღება</button></> : <><h4>{audience.name}</h4><p>{audience.description}</p><small>თქვენი ბიზნეს-ცოდნა</small></>}</div>)}</div> : null}
      {onFeedback ? <div className="bd-feedback-actions"><button type="button" className="bd-button bd-button-outline" disabled={busy || founderAudiences.length >= 4} onClick={() => { setFounderAudiences((current) => [...current, { id: `new-${current.length}`, name: "", description: "" }]); setFeedbackDirty(true) }}>+ ჩემი აუდიტორიის დამატება</button>{feedbackDirty ? <button type="button" className="bd-button" disabled={busy} onClick={() => void onFeedback({ kind: "audience", stances, founderAudiences })}>ჩემი პასუხების გათვალისწინება ↗</button> : <p>შეგიძლიათ გააგრძელოთ პასუხის გარეშეც. გაურკვევლობა მუშაობას არ აჩერებს.</p>}</div> : null}
    </section>

    <section id="bd-goals" className="bd-section"><div className="bd-section-heading"><span className="bd-section-number">03</span><div><p className="bd-eyebrow">რისთვის უნდა იმუშაოს კომუნიკაციამ</p><h2>პირველი მნიშვნელოვანი მიზნები</h2><p>ვთავაზობთ ცვლილებას, რომელსაც კომუნიკაცია უნდა ემსახურებოდეს. შედეგები მოგვიანებით გვაჩვენებს, რამდენად სწორია ეს მიმართულება.</p></div></div>
      <div className="bd-goals">{p.goals.map((goal, i) => <article className={goalIds.includes(goal.id) ? "is-selected" : ""} key={goal.id}><div className="bd-goal-order">{String(i + 1).padStart(2, "0")}</div><div><div className="bd-goal-title"><h3>{goal.title}</h3>{onConfirm ? <label className="bd-goal-select"><input type="checkbox" checked={goalIds.includes(goal.id)} onChange={(e) => setGoalIds((ids) => e.target.checked ? [...ids, goal.id] : ids.filter((id) => id !== goal.id))} />ავირჩიოთ</label> : null}</div><p className="bd-goal-change">{goal.desiredChange}</p><p>{goal.rationale}</p><details className="bd-detail"><summary>რით მივხვდებით, რომ წინ მივდივართ <span aria-hidden="true">+</span></summary><ul>{goal.progressSignals.map((signal) => <li key={signal}>{signal}</li>)}</ul></details></div></article>)}</div>
    </section>

    {envelope ? <section id="bd-voice" className="bd-section bd-communication"><div className="bd-section-heading"><span className="bd-section-number">04</span><div><p className="bd-eyebrow">Communication envelope</p><h2>ხმა, რომელიც თქვენად დარჩება</h2><p>{envelope.rationale}</p></div></div><div className="bd-tone-row">{envelope.toneRange.map((tone) => <span key={tone}>{tone}</span>)}</div><div className="bd-communication-grid"><div><h3>როგორ ავაწყობთ აზრს</h3><ul>{envelope.framingRules.map((rule) => <li key={rule}>{rule}</li>)}</ul><h3>როგორ მოვიწვევთ შემდეგ ნაბიჯზე</h3><p>{({ informational: "ინფორმაცია, რომელიც დამოუკიდებელ არჩევანს ეხმარება.", lowPressure: "მშვიდი მოწვევა, ზეწოლისა და ხელოვნური აჩქარების გარეშე.", consultative: "დიალოგი და კონსულტაცია — გადაწყვეტილების დაჩქარების ნაცვლად.", directWhenJustified: "კონკრეტული მოქმედება მაშინ, როცა ამის საფუძველი არსებობს." })[envelope.ctaStyle]}</p></div><div><h3>რით შევქმნით ნდობას</h3><ul>{envelope.trustMechanisms.map((rule) => <li key={rule}>{rule}</li>)}</ul><h3>რა არ უნდა გაჟღერდეს</h3><ul>{envelope.avoid.map((rule) => <li key={rule}>{rule}</li>)}</ul></div></div><details className="bd-detail bd-envelope-detail"><summary>კომუნიკაციის სრული წესები <span aria-hidden="true">+</span></summary><div className="bd-communication-grid">{[{ title: "ტერმინები და განმარტება", items: envelope.terminologyRules }, { title: "ტექსტის აგებულება", items: envelope.preferredStructures }, { title: "მტკიცებულების გამოყენება", items: envelope.proofStyle }, { title: "როგორ გავითვალისწინებთ განსხვავებულ მკითხველს", items: envelope.inclusivityRules }].map((group) => <div key={group.title}><h3>{group.title}</h3><ul>{group.items.map((item) => <li key={item}>{item}</li>)}</ul></div>)}</div></details></section> : null}

    {u.voice.examples.length ? <section className="bd-voice-evidence"><p className="bd-eyebrow">თქვენი ხმის კვალი წყაროებში</p><h2>სტილი, რომელსაც უკვე ვეყრდნობით</h2><div>{u.voice.examples.map((example, i) => <Citation key={i} citation={example} payload={p} />)}</div><p>{u.voice.principles.join(" ")}</p></section> : null}
    {u.openQuestions.length ? <section className="bd-open-questions"><h2>რას დავაზუსტებდით თქვენთან</h2><p>ეს კითხვები სურათს გააუმჯობესებს. პასუხი შეგიძლიათ ახლავე დაამატოთ ან მოგვიანებით დაგვიბრუნდეთ.</p>{u.openQuestions.map((q) => <article key={q.question}><h3>{q.question}</h3><p>{q.whyItMatters}</p></article>)}{editable ? <button type="button" className="bd-text-button" onClick={() => { setNoteOpen(true); window.scrollTo({ top: 0 }) }}>დამატებითი კონტექსტის გაზიარება ↑</button> : null}</section> : null}
    {onConfirm ? <footer className="bd-confirm"><div><p className="bd-eyebrow">ეს იქნება ჩვენი სამუშაო საფუძველი</p><h2>რამდენად გეცნობათ თქვენი ბიზნესი?</h2><p>დადასტურება შეინახავს საქმიანობასა და არჩეულ მიზნებს. აუდიტორიის ჰიპოთეზები და თქვენი პასუხები დამოუკიდებლად დარჩება.</p></div><div className="bd-confirm-actions"><label htmlFor="bd-content-language">კონტენტის ენა<select id="bd-content-language" value={language} onChange={(e) => setLanguage(e.target.value as "ka" | "en")}><option value="ka">ქართული</option><option value="en">English</option></select></label><button type="button" className="bd-button" disabled={busy || feedbackDirty || !!businessNote.trim() || !goalIds.length} onClick={() => void onConfirm(goalIds, language)}>{busy ? "ინახება…" : "ვადასტურებ ბრენდის საფუძველს →"}</button>{businessNote.trim() ? <small>ჯერ ბიზნესის დაზუსტება გაითვალისწინეთ ან წაშალეთ მონახაზი.</small> : feedbackDirty ? <small>ჯერ თქვენი აუდიტორიული პასუხები გაითვალისწინეთ.</small> : !goalIds.length ? <small>აირჩიეთ სულ მცირე ერთი მიზანი.</small> : <small>შემდგომი დაზუსტება ყოველთვის შეგეძლებათ.</small>}</div></footer> : null}
  </div>
}
