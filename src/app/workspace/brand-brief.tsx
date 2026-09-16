import Link from "next/link"
import type { BrandDossier } from "../../blueprints/social/brand-discovery/model"
import { displayDate } from "../../application/dashboard/model"
import { BrandDossierView } from "../brand-dossier"
import { ContextNoteButton } from "./contextual-notes"

export function BrandBrief({ dossier, brandId }: { dossier: BrandDossier; brandId: string }) {
  const p = dossier.payload
  const u = p.understanding!
  const refineHref = `/onboarding?brand=${encodeURIComponent(brandId)}`
  const audiences = p.hypotheses.filter((h) => !p.feedback.stances.some((s) => s.audienceHypothesisId === h.id && s.stance === "disagree"))
  const version = `${dossier.sessionId}:${dossier.revision}`
  return <div className="brief-page">
    <header className="ws-page-heading"><div><p className="ws-eyebrow">ბრენდის სამუშაო ცოდნა</p><h1>{u.name}</h1><p>ბოლო დადასტურება: <time dateTime={dossier.confirmedAt}>{displayDate(dossier.confirmedAt, { year: "numeric" })}</time></p></div><Link className="ws-button ws-button-outline" href={refineHref}>გაგების დაზუსტება ↗</Link></header>
    <section className="brief-lead"><p className="ws-eyebrow">როგორ გვესმის თქვენი ბიზნესი</p><p className="brief-business-summary">{u.summary}</p><ContextNoteButton type="business_summary" id="business-summary" label="ბიზნესის მოკლე აღწერა" version={version} data={{ summary: u.summary }} /><div className="brief-tags"><span>{u.offers.length} შეთავაზების მიმართულება</span><span>{p.hypotheses.length} აუდიტორიის ჰიპოთეზა</span><span>{p.sources.length} წყარო</span></div></section>
    <div className="brief-grid"><section className="ws-card brief-panel"><h2>პოზიციონირება</h2><p>{u.positioning}</p><ContextNoteButton type="positioning" id="positioning" label="პოზიციონირება" version={version} data={{ positioning: u.positioning }} /></section><section className="ws-card brief-panel"><h2>ვის ვესაუბრებით</h2><p>{audiences.length ? audiences.map((h) => h.name).join(" · ") : "მიღებული აუდიტორიული ჰიპოთეზა ჯერ არ გვაქვს."}</p>{audiences.map(h => <ContextNoteButton key={h.id} type="audience_hypothesis" id={h.id} label={`აუდიტორია: ${h.name}`} version={version} data={{ hypothesis: h }} />)}{p.feedback.founderAudiences.length ? <p>თქვენგან დამატებული: {p.feedback.founderAudiences.map((a) => a.name).join(" · ")}</p> : null}<small>აუდიტორიის სამუშაო ჰიპოთეზები რეალური მომხმარებლების კვლევას არ უდრის.</small></section></div>
    <details className="brief-details"><summary>შეთავაზებებსა და საკომუნიკაციო წესებზე კონკრეტული შენიშვნა</summary><div className="brief-panel"><h3>შეთავაზებები</h3>{u.offers.map((offer, index) => <div key={`${offer.name}:${index}`}><strong>{offer.name}</strong><p>{offer.description}</p><ContextNoteButton type="offer" id={`offer-${index + 1}`} label={`შეთავაზება: ${offer.name}`} version={version} data={{ name: offer.name, description: offer.description }} /></div>)}<h3>საკომუნიკაციო წესები</h3>{p.envelope?.framingRules.map((rule, index) => <div key={rule}><p>{rule}</p><ContextNoteButton type="communication_rule" id={`framing-${index + 1}`} label={`საკომუნიკაციო წესი ${index + 1}`} version={version} data={{ rule, kind: "framing" }} /></div>)}</div></details>
    {p.sourceWarnings.length ? <section className="brief-caution"><h2>ცოდნის შეზღუდვები</h2><ul>{p.sourceWarnings.map((warning) => <li key={warning}>{warning}</li>)}</ul></section> : null}
    {u.openQuestions.length ? <details className="brief-details"><summary>{u.openQuestions.length} კითხვა, რომელიც ჩვენს გაგებას გააუმჯობესებს</summary><div className="brief-panel"><p>პასუხი შეგიძლიათ საჭიროებისას დაამატოთ; ეს კითხვები თავისთავად მუშაობას არ ბლოკავს.</p>{u.openQuestions.map((q) => <article key={q.question}><h3>{q.question}</h3><p>{q.whyItMatters}</p></article>)}<Link className="ws-text-link" href={refineHref}>კონტექსტის დამატება ↗</Link></div></details> : null}
    <details className="brief-details"><summary>სრული ანალიზი · შეთავაზებები, აუდიტორიები, ხმა და მტკიცებულებები</summary><div className="brief-full-brand"><BrandDossierView payload={p} refineHref={refineHref} embedded /></div></details>
    <p className="brief-footnote">ეს დადასტურებული სამუშაო საფუძველია. წყაროების ავტომატური ხელახალი შემოწმება ჯერ არ არის ჩართული. <Link href="/workspace/brand?view=history">ცვლილებების ისტორია ↗</Link></p>
  </div>
}
