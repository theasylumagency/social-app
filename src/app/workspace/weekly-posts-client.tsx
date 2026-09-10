"use client"

import { useState } from "react"
import Image from "next/image"
import { displayDate } from "../../application/dashboard/model"
import type { PlanningRun } from "../../blueprints/social/weekly-planning/model"
import { type PostsBatch, type PostOutline, type PostVariant, type PostAsset, type PostChannel } from "../../blueprints/social/weekly-planning/posts"
import { changedCopyParts, postPresentation, postsPresentation } from "./weekly-posts-presentation"
import { WeeklyPostsProgress } from "./weekly-posts-progress"
import { VisualGenerationPanel, VisualsProvider } from "./visual-generation-panel"
import { SocialScheduleControls } from "./social-schedule-controls"

const formats = { text: "ტექსტური პოსტი", image: "პოსტი გამოსახულებით", carousel: "კარუსელი", story: "სთორი", reel: "რილი" }
const channels = { facebook: "Facebook", instagram: "Instagram" }
function day(week: string, offset: number) {
  const date = new Date(`${week}T12:00:00Z`); date.setUTCDate(date.getUTCDate() + offset)
  const weekdays = ["კვირა", "ორშაბათი", "სამშაბათი", "ოთხშაბათი", "ხუთშაბათი", "პარასკევი", "შაბათი"]
  return `${weekdays[date.getUTCDay()]}, ${displayDate(date.toISOString())}`
}

function CopyText({ variant, format }: { variant: PostVariant; format: PostOutline["format"] }) {
  return <><div className="fp-caption">{variant.caption}</div>{variant.frames.length ? <div className="fp-copy-frames">{variant.frames.map((frame, i) => <section key={i}><span>{format === "story" ? "კადრი" : "სლაიდი"} {i + 1}</span>{frame.heading ? <h4>{frame.heading}</h4> : null}<p>{frame.body}</p></section>)}</div> : null}{variant.script ? <section className="fp-script"><h4>სათქმელი ტექსტი</h4><p>{variant.script}</p></section> : null}{variant.onScreenText.length ? <section className="fp-script"><h4>ტექსტი ეკრანზე</h4><ol>{variant.onScreenText.map((s, i) => <li key={i}>{s}</li>)}</ol></section> : null}</>
}

function RepairHistory({ state, channel, format }: { state: ReturnType<typeof postPresentation>; channel: PostChannel; format: PostOutline["format"] }) {
  const first = state.draft?.variants.find((variant) => variant.channel === channel)
  const current = state.copy?.variants.find((variant) => variant.channel === channel)
  const changed = first && current ? changedCopyParts(first, current) : []
  return <details className="fp-repair-history wp-details">
    <summary>რატომ შეიცვალა ეს ტექსტი</summary>
    <section className="fp-first-draft"><h4>პირველი ვერსია</h4>{first ? <CopyText variant={first} format={format} /> : <p>ამ არხის პირველი ვერსია შენახული არ არის.</p>}</section>
    <section><h4>რა აღმოვაჩინეთ</h4>{state.feedback?.issues.length ? <ul>{state.feedback.issues.map((issue, i) => <li key={i}>{issue.message}</li>)}</ul> : <p>ამ ძველი ვერსიის გასწორების მიზეზი ცალკე შენახული არ არის.</p>}</section>
    <section><h4>რა შეიცვალა</h4>{state.feedback?.instructions.length ? <><p>გასწორების დავალება:</p><ul>{state.feedback.instructions.map((instruction, i) => <li key={i}>{instruction}</li>)}</ul></> : null}<p>{current ? changed.length ? `არჩეულ არხზე შეიცვალა: ${changed.join(" · ")}. შეადარეთ პირველი და მიმდინარე ტექსტები.` : "ამ არხის ტექსტში ცვლილება არ არის; გასწორება შესაძლოა სხვა არხს შეეხო." : "გადამუშავებული ტექსტი ჯერ არ შენახულა. პირველი ვერსია ხელმისაწვდომია."}</p></section>
    <section className={state.accepted ? "fp-final-copy" : "fp-pending-final"}><h4>{state.accepted ? "საბოლოო ვერსია" : "საბოლოო ვერსია — ჯერ დაუდასტურებელია"}</h4>{current ? <>{!state.accepted ? <p>{state.label}</p> : null}<CopyText variant={current} format={format} /></> : <p>აქ გასწორებული ტექსტი გამოჩნდება.</p>}</section>
  </details>
}

function PostCard({ run, post, index, state, assets, onAssets, readOnly = false, approved = false, preferredChannel }: { run: PlanningRun; post: PostOutline; index: number; state: ReturnType<typeof postPresentation>; assets: PostAsset[]; onAssets: (assets: PostAsset[]) => void; readOnly?: boolean; approved?: boolean; preferredChannel?: PostChannel | undefined }) {
  const [channel, setChannel] = useState<PostChannel>(preferredChannel ?? post.channels[0]!.channel)
  const [busy, setBusy] = useState<number | null>(null)
  const [error, setError] = useState("")
  const [copied, setCopied] = useState(false)
  const postKey = `p${index + 1}`
  const variant = (state.copy ?? state.draft)?.variants.find((v) => v.channel === channel)
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
        {variant ? <><p className={`fp-copy-status ${state.accepted ? "is-final" : "is-provisional"}`}>{state.label}</p><CopyText variant={variant} format={post.format} /><button className="fp-copy-button" onClick={() => void copyText()}>{copied ? "ტექსტი დაკოპირებულია ✓" : "ტექსტის კოპირება"}</button></> : <div className="fp-copy-pending" role="status"><span className="fp-pulse" /> ამ პოსტის სრულ ტექსტს ვამზადებთ…</div>}
        {state.draft ? <RepairHistory state={state} channel={channel} format={post.format} /> : null}
      </section>
      {post.format !== "text" ? <aside className="fp-visual"><p className="wp-eyebrow">რეკომენდებული ვიზუალი</p><h4>{post.visual.kind === "video" ? "გადასაღები ვიდეო" : post.visual.kind === "photo" ? "ნამდვილი ფოტო" : post.visual.kind === "slides" ? "ვიზუალური სერია" : "მარტივი გრაფიკული გამოსახულება"} <span>{post.visual.aspectRatio}</span></h4><p>{post.visual.description}</p>
        {post.visual.frames.map((description, slot) => { const asset = assets.find((a) => a.postKey === postKey && a.slot === slot); return <div className="fp-visual-slot" key={slot}>{post.visual.frames.length > 1 ? <strong>{post.format === "reel" ? "სცენა" : "გამოსახულება"} {slot + 1}</strong> : null}{asset ? <><div className="fp-uploaded-image"><Image unoptimized width={asset.width} height={asset.height} src={`/api/weekly-planning/assets?id=${asset.id}`} alt={`${post.title} — ატვირთული გამოსახულება ${slot + 1}`} /></div><small>{asset.name} · {asset.width} × {asset.height}</small></> : <div className="fp-visual-placeholder" aria-label="გამოსახულება ჯერ არ არის"><svg viewBox="0 0 80 50" aria-hidden="true"><rect x="1" y="1" width="78" height="48" rx="5" /><circle cx="24" cy="17" r="5" /><path d="m5 44 23-18 15 12 14-17 18 23" /></svg><span>{post.format === "reel" ? "ვიდეო გადასაღებია" : "გამოსახულება დასამატებელია"}</span></div>}<p>{description}</p>{hasUploads ? <div className="fp-asset-actions"><label className="fp-upload-button" aria-disabled={busy !== null || readOnly}>{busy === slot ? "ინახება…" : asset ? "გამოსახულების შეცვლა" : "ჩემი გამოსახულების ატვირთვა"}<input type="file" accept="image/jpeg,image/png,image/webp" aria-label={`პოსტი ${index + 1}, გამოსახულება ${slot + 1}: ატვირთვა`} disabled={busy !== null || readOnly} onChange={(e) => { void upload(e.target.files?.[0], slot); e.target.value = "" }} /></label>{asset ? <button type="button" disabled={busy !== null || readOnly} onClick={() => void remove(slot)}>წაშლა</button> : null}</div> : null}</div> })}
        {hasUploads ? <><small className="fp-file-hint">JPG, PNG ან WebP · მაქსიმუმ 8 MB თითო ფაილზე</small><VisualGenerationPanel runId={run.id} brandId={run.brandId} postKey={postKey} post={post} disabled={readOnly || busy !== null} onAssets={onAssets} /></> : <p className="fp-file-hint">რილისთვის საჭიროა ვიდეოს გადაღება. გამოსახულების გენერაცია ვიდეოს არ ქმნის.</p>}
      </aside> : null}
    </div>
    {error ? <p className="wp-error" role="alert">{error}</p> : null}
    <details className="fp-post-details wp-details"><summary>რატომ ეს პოსტი და რას უნდა მივაღწიოთ</summary><p>{post.brief.takeaway}</p><ul>{post.brief.points.map((point) => <li key={point}>{point}</li>)}</ul><p><strong>რას ვერ დავპირდებით:</strong> {post.brief.mustNotSay.join(" · ")}</p></details>
    <SocialScheduleControls brandId={run.brandId} runId={run.id} postKey={postKey} channels={post.channels.map((item) => item.channel)} enabled={!readOnly && approved} />
  </article>
}

export function WeeklyPostsClient({ run, batch, assets, onAssets, onStart, onRetry, onRepair, busy, readOnly = false }: { run: PlanningRun; batch: PostsBatch | null | undefined; assets: PostAsset[]; onAssets: (assets: PostAsset[]) => void; onStart: () => void; onRetry: () => void; onRepair?: () => void; busy: boolean; readOnly?: boolean }) {
  const [filter, setFilter] = useState<"all" | PostChannel>("all")
  const [calendar, setCalendar] = useState(false)
  const outline = batch?.payload.outline
  const visible = outline?.posts.map((post, index) => ({ post, index })).filter(({ post }) => filter === "all" || post.channels.some((c) => c.channel === filter)) ?? []
  const issues = batch?.payload.review?.issues ?? []
  if (!batch) return <section className="fp-empty"><p className="wp-eyebrow">ხედვა უკვე გვაქვს. ახლა პოსტები ვნახოთ.</p><h2>რას გამოვაქვეყნებთ ამ კვირაში?</h2><p>მოვამზადებთ პოსტების ჩამონათვალს, სრულ ტექსტებს, Facebook-ისა და Instagram-ის რეკომენდაციებს და ვიზუალურ დავალებებს.</p><button className="wp-button" disabled={busy || run.payload.review?.concerns.some((c) => c.severity === "blocking")} onClick={onStart}>პოსტების მომზადება →</button></section>
  const progress = postsPresentation(batch)
  return <VisualsProvider key={run.id} runId={run.id}><div className="fp-app">
    {progress.active && !readOnly ? <WeeklyPostsProgress key={batch.runId} batch={batch} /> : null}
    {progress.completion ? <p className="fp-completion" role="status">{progress.completion}</p> : null}
    {outline ? <><div className="fp-content-toolbar"><nav className="fp-channel-tabs" aria-label="პოსტების არხით გაფილტვრა">{(["all", "facebook", "instagram"] as const).map((channel) => <button key={channel} type="button" aria-pressed={filter === channel} onClick={() => setFilter(channel)}>{channel === "all" ? "ყველა" : channels[channel]} · {channel === "all" ? outline.posts.length : outline.posts.filter((p) => p.channels.some((c) => c.channel === channel)).length}</button>)}</nav><div className="fp-channel-tabs" aria-label="კონტენტის ხედი"><button type="button" aria-pressed={!calendar} onClick={() => setCalendar(false)}>სია</button><button type="button" aria-pressed={calendar} onClick={() => setCalendar(true)}>კვირის განრიგი</button></div></div>{calendar ? <section className="fp-calendar" aria-label="შეთავაზებული კვირის განრიგი">{Array.from({ length: 7 }, (_, offset) => <div key={offset}><h3>{day(run.week, offset)}</h3>{visible.filter(({ post }) => post.dayOffset === offset).map(({ post, index }) => <a key={index} href={`#${readOnly ? "previous-" : ""}post-${index + 1}`}><strong>{post.title}</strong><small>{post.channels.map((c) => channels[c.channel]).join(" · ")}</small></a>)}{!visible.some(({ post }) => post.dayOffset === offset) ? <p>პოსტი არ არის</p> : null}</div>)}</section> : null}{!visible.length ? <p className="wp-notice">{outline.posts.length ? "ამ არხისთვის ამ კვირაში პოსტები არჩეული არ არის." : "ამ კვირაში ორივე არხზე 0 პოსტია არჩეული. რაოდენობის გაზრდა კვირის ტაბში შეგიძლიათ."}</p> : null}</> : null}
    <section className="fp-week-summary"><div><p className="wp-eyebrow">თქვენი კვირა, პოსტებად</p><h2>{outline ? outline.posts.length ? `${outline.posts.length} პოსტი. ერთი მკაფიო მიზანი.` : "ამ კვირაში პოსტები შეჩერებულია." : "ვარჩევთ, რას გამოვაქვეყნებთ ამ კვირაში."}</h2><p>{outline?.summary ?? "ვაზუსტებთ პოსტების რაოდენობას, არხებსა და ფორმატებს. ტექსტები მზადყოფნისთანავე გამოჩნდება."}</p></div>{outline ? <div className="fp-week-stats"><strong>{outline.posts.length}<span>პოსტი</span></strong><strong>{outline.posts.reduce((n, p) => n + p.channels.length, 0)}<span>განთავსება</span></strong></div> : null}</section>
    {outline ? <><details className="fp-decisions-detail wp-details"><summary>რატომ {outline.posts.length} პოსტი და რატომ ეს არხები?</summary><div className="fp-decisions"><section><h3>რატომ {outline.posts.length} პოსტი?</h3><p>{outline.cadenceReason}</p></section><section><h3>სად და რატომ?</h3><p>{outline.channelReason}</p></section></div></details><p className="fp-proposal-note">არხები და დღეები შეთავაზებულია. ანგარიშები ჯერ არ არის დაკავშირებული და პოსტები ავტომატურად არ გამოქვეყნდება.</p><nav className="fp-agenda" aria-label="ამ კვირის პოსტები">{visible.map(({ post: p, index: i }) => <a key={i} href={readOnly ? `#previous-post-${i + 1}` : `#post-${i + 1}`}><span>{String(i + 1).padStart(2, "0")} · {formats[p.format]}</span><strong>{p.title}</strong><small>{p.channels.map((c) => channels[c.channel]).join(" + ")}</small></a>)}</nav></> : null}

    {batch.status === "failed" ? <section className="wp-error" role="alert"><p>{batch.error}</p><button className="wp-button" disabled={busy} onClick={onRetry}>მომზადების გაგრძელება</button></section> : null}
    {visible.map(({ post, index }) => <PostCard key={`${run.id}:${index}:${filter}`} run={run} post={post} index={index} state={postPresentation(batch, `p${index + 1}`)} assets={assets} onAssets={onAssets} readOnly={readOnly} approved={run.status === "approved" && Boolean(batch.approvedAt)} preferredChannel={filter === "all" ? undefined : filter} />)}
    {issues.length ? <section className="wp-concerns"><h2>რა არის გასათვალისწინებელი</h2>{issues.map((issue, i) => <p key={i}><strong>{outline?.posts[Number(issue.postKey.slice(1)) - 1]?.title}:</strong> {issue.message}</p>)}{batch.status === "ready" && issues.some((i) => i.severity === "blocking") && onRepair && !readOnly ? <button className="wp-button" disabled={busy} onClick={onRepair}>მხოლოდ დასაზუსტებელი პოსტების გასწორება</button> : null}</section> : null}
    {batch.status === "ready" ? <details className="wp-details fp-copy-review"><summary>ტექსტების შემოწმება</summary><p>{batch.payload.review?.summary}</p></details> : null}
  </div></VisualsProvider>
}
