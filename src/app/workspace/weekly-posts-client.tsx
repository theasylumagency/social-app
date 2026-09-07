"use client"

import { useState } from "react"
import Image from "next/image"
import { displayDate } from "../../application/dashboard/model"
import type { PlanningRun } from "../../blueprints/social/weekly-planning/model"
import { IMAGE_GENERATION_POLICY, type PostsBatch, type PostOutline, type PostCopy, type PostAsset, type PostChannel } from "../../blueprints/social/weekly-planning/posts"

const formats = { text: "ტექსტური პოსტი", image: "პოსტი გამოსახულებით", carousel: "კარუსელი", story: "სთორი", reel: "რილი" }
const channels = { facebook: "Facebook", instagram: "Instagram" }
function day(week: string, offset: number) {
  const date = new Date(`${week}T12:00:00Z`); date.setUTCDate(date.getUTCDate() + offset)
  const weekdays = ["კვირა", "ორშაბათი", "სამშაბათი", "ოთხშაბათი", "ხუთშაბათი", "პარასკევი", "შაბათი"]
  return `${weekdays[date.getUTCDay()]}, ${displayDate(date.toISOString())}`
}

function PostCard({ run, post, index, copy, assets, onAssets, readOnly = false }: { run: PlanningRun; post: PostOutline; index: number; copy: PostCopy | undefined; assets: PostAsset[]; onAssets: (assets: PostAsset[]) => void; readOnly?: boolean }) {
  const [channel, setChannel] = useState<PostChannel>(post.channels[0]!.channel)
  const [busy, setBusy] = useState<number | null>(null)
  const [error, setError] = useState("")
  const [copied, setCopied] = useState(false)
  const postKey = `p${index + 1}`
  const variant = copy?.variants.find((v) => v.channel === channel)
  async function upload(file: File | undefined, slot: number) {
    if (!file) return
    setError(""); setBusy(slot)
    try {
      if (file.size > 8 * 1024 * 1024) throw Error("ფაილი 8 MB-ზე დიდი არ უნდა იყოს.")
      const data = new FormData(); data.set("runId", run.id); data.set("postKey", postKey); data.set("slot", String(slot)); data.set("file", file)
      const response = await fetch("/api/weekly-planning/assets", { method: "POST", body: data })
      const result = await response.json()
      if (!response.ok) throw Error(result.message)
      onAssets(result.assets)
    } catch (e) { setError(e instanceof Error ? e.message : "ატვირთვა ვერ დასრულდა.") } finally { setBusy(null) }
  }
  async function remove(slot: number) {
    setError(""); setBusy(slot)
    try {
      const response = await fetch(`/api/weekly-planning/assets?runId=${run.id}&postKey=${postKey}&slot=${slot}`, { method: "DELETE" })
      const result = await response.json(); if (!response.ok) throw Error(result.message); onAssets(result.assets)
    } catch (e) { setError(e instanceof Error ? e.message : "წაშლა ვერ დასრულდა.") } finally { setBusy(null) }
  }
  async function copyText() {
    if (!variant) return
    try { await navigator.clipboard.writeText([variant.caption, ...variant.frames.map((f) => [f.heading, f.body].filter(Boolean).join("\n")), variant.script, ...variant.onScreenText].filter(Boolean).join("\n\n")); setCopied(true) }
    catch { setError("კოპირება ვერ მოხერხდა. ტექსტის მონიშვნა და ხელით კოპირება შეგიძლიათ.") }
  }
  const hasUploads = ["image", "carousel", "story"].includes(post.format)
  return <article className="fp-post" id={readOnly ? `previous-post-${index + 1}` : `post-${index + 1}`}>
    <header className="fp-post-heading"><span className="fp-number">{String(index + 1).padStart(2, "0")}</span><div><p className="fp-day">{day(run.week, post.dayOffset)} <span>· შეთავაზებული დღე</span></p><h3>{post.title}</h3></div><span className="fp-format">{formats[post.format]}</span></header>
    <p className="fp-why">{post.why}</p>
    <div className={`fp-post-body ${post.format === "text" ? "fp-text-only" : ""}`}>
      <section className="fp-copy" aria-label={`პოსტი ${index + 1}: ტექსტი`}>
        <div className="fp-channel-tabs" aria-label="ტექსტის არხი">{post.channels.map((c) => <button type="button" key={c.channel} aria-pressed={channel === c.channel} onClick={() => { setChannel(c.channel); setCopied(false) }}><span className={`fp-channel-icon ${c.channel}`}>{c.channel === "facebook" ? "f" : "◎"}</span>{channels[c.channel]}</button>)}</div>
        <p className="fp-channel-reason">{post.channels.find((c) => c.channel === channel)?.reason}</p>
        {variant ? <><div className="fp-caption">{variant.caption}</div>{variant.frames.length ? <div className="fp-copy-frames">{variant.frames.map((frame, i) => <section key={i}><span>{post.format === "story" ? "კადრი" : "სლაიდი"} {i + 1}</span>{frame.heading ? <h4>{frame.heading}</h4> : null}<p>{frame.body}</p></section>)}</div> : null}{variant.script ? <section className="fp-script"><h4>სათქმელი ტექსტი</h4><p>{variant.script}</p><h4>ტექსტი ეკრანზე</h4><ol>{variant.onScreenText.map((s, i) => <li key={i}>{s}</li>)}</ol></section> : null}<button className="fp-copy-button" onClick={() => void copyText()}>{copied ? "ტექსტი დაკოპირებულია ✓" : "ტექსტის კოპირება"}</button></> : <div className="fp-copy-pending" role="status"><span className="fp-pulse" /> ამ პოსტის სრულ ტექსტს ვამზადებთ…</div>}
      </section>
      {post.format !== "text" ? <aside className="fp-visual"><p className="wp-eyebrow">რეკომენდებული ვიზუალი</p><h4>{post.visual.kind === "video" ? "გადასაღები ვიდეო" : post.visual.kind === "photo" ? "ნამდვილი ფოტო" : post.visual.kind === "slides" ? "ვიზუალური სერია" : "მარტივი გრაფიკული გამოსახულება"} <span>{post.visual.aspectRatio}</span></h4><p>{post.visual.description}</p>
        {post.visual.frames.map((description, slot) => { const asset = assets.find((a) => a.postKey === postKey && a.slot === slot); return <div className="fp-visual-slot" key={slot}>{post.visual.frames.length > 1 ? <strong>{post.format === "reel" ? "სცენა" : "გამოსახულება"} {slot + 1}</strong> : null}{asset ? <><div className="fp-uploaded-image"><Image unoptimized width={asset.width} height={asset.height} src={`/api/weekly-planning/assets?id=${asset.id}`} alt={`${post.title} — ატვირთული გამოსახულება ${slot + 1}`} /></div><small>{asset.name} · {asset.width} × {asset.height}</small></> : <div className="fp-visual-placeholder" aria-label="გამოსახულება ჯერ არ არის"><svg viewBox="0 0 80 50" aria-hidden="true"><rect x="1" y="1" width="78" height="48" rx="5" /><circle cx="24" cy="17" r="5" /><path d="m5 44 23-18 15 12 14-17 18 23" /></svg><span>{post.format === "reel" ? "ვიდეო გადასაღებია" : "გამოსახულება დასამატებელია"}</span></div>}<p>{description}</p>{hasUploads ? <div className="fp-asset-actions"><label className="fp-upload-button" aria-disabled={busy !== null || readOnly}>{busy === slot ? "ინახება…" : asset ? "გამოსახულების შეცვლა" : "ჩემი გამოსახულების ატვირთვა"}<input type="file" accept="image/jpeg,image/png,image/webp" aria-label={`პოსტი ${index + 1}, გამოსახულება ${slot + 1}: ატვირთვა`} disabled={busy !== null || readOnly} onChange={(e) => { void upload(e.target.files?.[0], slot); e.target.value = "" }} /></label>{asset ? <button type="button" disabled={busy !== null || readOnly} onClick={() => void remove(slot)}>წაშლა</button> : null}</div> : null}</div> })}
        {hasUploads ? <><small className="fp-file-hint">JPG, PNG ან WebP · მაქსიმუმ 8 MB თითო ფაილზე</small><div className="fp-generation"><button type="button" disabled={!IMAGE_GENERATION_POLICY.enabled}>✧ გამოსახულების გენერაცია <span>ფასიანი გეგმა</span></button><p>ტესტირებისას გამორთულია. საცდელ გეგმაში გენერაცია არ შედის; საკუთარი გამოსახულების ატვირთვა შეგიძლიათ.</p></div></> : <p className="fp-file-hint">რილისთვის საჭიროა ვიდეოს გადაღება. გამოსახულების გენერაცია ვიდეოს არ ქმნის.</p>}
      </aside> : null}
    </div>
    {error ? <p className="wp-error" role="alert">{error}</p> : null}
    <details className="fp-post-details wp-details"><summary>რატომ ეს პოსტი და რას უნდა მივაღწიოთ</summary><p>{post.brief.takeaway}</p><ul>{post.brief.points.map((point) => <li key={point}>{point}</li>)}</ul><p><strong>რას ვერ დავპირდებით:</strong> {post.brief.mustNotSay.join(" · ")}</p></details>
  </article>
}

export function WeeklyPostsClient({ run, batch, assets, onAssets, onStart, onRetry, busy, readOnly = false }: { run: PlanningRun; batch: PostsBatch | null | undefined; assets: PostAsset[]; onAssets: (assets: PostAsset[]) => void; onStart: () => void; onRetry: () => void; busy: boolean; readOnly?: boolean }) {
  const outline = batch?.payload.outline
  const issues = batch?.payload.review?.issues ?? []
  if (!batch) return <section className="fp-empty"><p className="wp-eyebrow">ხედვა უკვე გვაქვს. ახლა პოსტები ვნახოთ.</p><h2>რას გამოვაქვეყნებთ ამ კვირაში?</h2><p>მოვამზადებთ პოსტების ჩამონათვალს, სრულ ტექსტებს, Facebook-ისა და Instagram-ის რეკომენდაციებს და ვიზუალურ დავალებებს.</p><button className="wp-button" disabled={busy || run.payload.review?.concerns.some((c) => c.severity === "blocking")} onClick={onStart}>პოსტების მომზადება →</button></section>
  return <div className="fp-app">
    <section className="fp-week-summary"><div><p className="wp-eyebrow">თქვენი კვირა, პოსტებად</p><h2>{outline ? `${outline.posts.length} პოსტი. ერთი მკაფიო მიზანი.` : "ვარჩევთ, რას გამოვაქვეყნებთ ამ კვირაში."}</h2><p>{outline?.summary ?? "ვაზუსტებთ პოსტების რაოდენობას, არხებსა და ფორმატებს. ტექსტები მზადყოფნისთანავე გამოჩნდება."}</p></div>{outline ? <div className="fp-week-stats"><strong>{outline.posts.length}<span>პოსტი</span></strong><strong>{outline.posts.reduce((n, p) => n + p.channels.length, 0)}<span>განთავსება</span></strong></div> : null}</section>
    {outline ? <><details className="fp-decisions-detail wp-details"><summary>რატომ {outline.posts.length} პოსტი და რატომ ეს არხები?</summary><div className="fp-decisions"><section><h3>რატომ {outline.posts.length} პოსტი?</h3><p>{outline.cadenceReason}</p></section><section><h3>სად და რატომ?</h3><p>{outline.channelReason}</p></section></div></details><p className="fp-proposal-note">არხები და დღეები შეთავაზებულია. ანგარიშები ჯერ არ არის დაკავშირებული და პოსტები ავტომატურად არ გამოქვეყნდება.</p><nav className="fp-agenda" aria-label="ამ კვირის პოსტები">{outline.posts.map((p, i) => <a key={i} href={readOnly ? `#previous-post-${i + 1}` : `#post-${i + 1}`}><span>{String(i + 1).padStart(2, "0")} · {formats[p.format]}</span><strong>{p.title}</strong><small>{p.channels.map((c) => channels[c.channel]).join(" + ")}</small></a>)}</nav></> : null}
    {batch.status === "queued" || batch.status === "running" ? <div className="fp-progress" role="status"><span className="fp-pulse" /><p>{batch.step === "outline" ? "ვაწყობთ პოსტების ჩამონათვალს…" : batch.step === "writing" ? `მზადაა ${Object.keys(batch.payload.copies).length} / ${outline?.posts.length ?? 0} პოსტის ტექსტი. დანარჩენს პარალელურად ვამზადებთ…` : "ყველა ტექსტს ბრენდის ხმასა და ფაქტებს ვუდარებთ…"}</p></div> : null}
    {batch.status === "failed" ? <section className="wp-error" role="alert"><p>{batch.error}</p><button className="wp-button" disabled={busy} onClick={onRetry}>მომზადების გაგრძელება</button></section> : null}
    {outline?.posts.map((post, index) => <PostCard key={`${run.id}:${index}`} run={run} post={post} index={index} copy={batch.payload.copies[`p${index + 1}`]} assets={assets} onAssets={onAssets} readOnly={readOnly} />)}
    {issues.length ? <section className="wp-concerns"><h2>რა არის გასათვალისწინებელი</h2>{issues.map((issue, i) => <p key={i}><strong>{outline?.posts[Number(issue.postKey.slice(1)) - 1]?.title}:</strong> {issue.message}</p>)}</section> : null}
    {batch.status === "ready" ? <details className="wp-details fp-copy-review"><summary>ტექსტების შემოწმება</summary><p>{batch.payload.review?.summary}</p></details> : null}
  </div>
}
