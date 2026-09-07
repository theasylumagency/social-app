"use client"

import Link from "next/link"
import { useState } from "react"
import { countPostChannels, MAX_POSTS_PER_CHANNEL, type PostCadence, type PostsBatch } from "../../blueprints/social/weekly-planning/posts"

export function WeeklyCadenceClient({ batch, week, busy, blocked, onSave, onStart, onRetry }: { batch: PostsBatch | null | undefined; week: string; busy: boolean; blocked: boolean; onSave: (cadence: PostCadence) => Promise<void>; onStart: () => void; onRetry: () => void }) {
  const outline = batch?.payload.outline
  const saved = batch?.payload.cadence ?? countPostChannels(outline?.posts ?? [])
  const [draft, setDraft] = useState<PostCadence | null>(null)
  const counts = draft ?? saved
  const changed = counts.facebook !== saved.facebook || counts.instagram !== saved.instagram
  const working = batch?.status === "queued" || batch?.status === "running"
  return <section className="wp-cadence" aria-label="კვირის პოსტების რაოდენობა">
    <div className="wp-cadence-heading"><div><p className="wp-eyebrow">რამდენი პოსტი მოვამზადოთ</p><h2>კვირის რიტმი თქვენი ბიზნესისთვის</h2><p>{outline ? outline.cadenceReason : "თქვენი ბიზნესისა და კვირის მიზნის მიხედვით პოსტების რაოდენობასა და არხებს ვარჩევთ."}</p></div><Link className="wp-button wp-button-outline" href={`/workspace/content?week=${week}`}>კონტენტის ნახვა →</Link></div>
    <form onSubmit={async (e) => { e.preventDefault(); await onSave(counts) }}>
      <div className="wp-cadence-channels">{(["facebook", "instagram"] as const).map((channel) => <label key={channel}><span className={`fp-channel-icon ${channel}`}>{channel === "facebook" ? "f" : "◎"}</span><strong>{channel === "facebook" ? "Facebook" : "Instagram"}</strong>{outline ? <select aria-label={`${channel === "facebook" ? "Facebook" : "Instagram"}: პოსტები კვირაში`} value={counts[channel]} disabled={busy || blocked} onChange={(e) => setDraft({ ...counts, [channel]: Number(e.target.value) })}>{Array.from({ length: MAX_POSTS_PER_CHANNEL + 1 }, (_, n) => <option key={n} value={n}>{n} პოსტი კვირაში</option>)}</select> : <span className="wp-cadence-pending">რაოდენობა მზადდება…</span>}</label>)}</div>
      {outline ? <><p className="wp-caption">ერთი პოსტი შეიძლება ორივე არხზე გამოჩნდეს. 0 გამორთავს შესაბამის არხს ამ კვირისთვის. თითოეულ არხზე შეგიძლიათ აირჩიოთ 0–{MAX_POSTS_PER_CHANNEL} პოსტი.</p>{changed ? <div className="wp-cadence-save"><p>რაოდენობის შენახვისას დღეებს გადავანაწილებთ. დარჩენილ ტექსტებსა და გამოსახულებებს შევინარჩუნებთ; მხოლოდ დამატებით საჭირო პოსტებს მოვამზადებთ.</p><button className="wp-button" disabled={busy || blocked}>{busy ? "ინახება…" : "რაოდენობის შენახვა და განრიგის განახლება"}</button><button type="button" className="wp-text-link" disabled={busy} onClick={() => setDraft(null)}>ცვლილების გაუქმება</button></div> : null}<details className="wp-details"><summary>რატომ ეს არხები?</summary><p>{outline.channelReason}</p></details></> : null}
    </form>
    {!batch ? <button className="wp-button" disabled={busy || blocked} onClick={onStart}>პოსტების მომზადება →</button> : null}
    {working ? <p className="fp-progress" role="status"><span className="fp-pulse" />{batch.step === "outline" ? "პოსტების განრიგს ვამზადებთ." : batch.step === "writing" ? `ფონში ტექსტები მზადდება: ${Object.keys(batch.payload.copies).length} / ${outline?.posts.length ?? 0}.` : "პოსტების ტექსტებსა და თანმიმდევრობას ვამოწმებთ."} გეგმის კითხვა შეგიძლიათ გააგრძელოთ.</p> : null}
    {batch?.status === "failed" ? <div className="wp-error" role="alert"><p>{batch.error}</p><button className="wp-button" disabled={busy} onClick={onRetry}>მომზადების გაგრძელება</button></div> : null}
    {batch?.status === "ready" ? <p className="wp-caption">{batch.payload.review?.issues.some((i) => i.severity === "blocking") ? "ტექსტებში დასაზუსტებელი საკითხებია — იხილეთ კონტენტის ტაბში." : batch.approvedAt ? "კონტენტი დადასტურებულია. გამოქვეყნება ჯერ არ დაწყებულა." : "კონტენტი მზადაა განსახილველად. ტექსტები და გამოსახულებები კონტენტის ტაბში ნახეთ."}</p> : null}
  </section>
}
