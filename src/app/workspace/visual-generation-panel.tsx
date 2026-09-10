"use client"

import Image from "next/image"
import { createContext, useCallback, useContext, useEffect, useId, useRef, useState } from "react"
import type { PostAsset, PostOutline } from "../../blueprints/social/weekly-planning/posts"
import type { VisualBalance, VisualGeneration } from "../../application/visuals/types"

type Snapshot = VisualBalance & { generations: VisualGeneration[]; enabled: boolean; mode: string; message: string | null }
const VisualsContext = createContext<{ snapshot: Snapshot | null; error: string; refresh: () => Promise<void>; activate: () => void } | null>(null)

/** One history/balance request and polling loop for all the post cards. */
export function VisualsProvider({ runId, children }: { runId: string; children?: React.ReactNode }) {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null)
  const [error, setError] = useState("")
  const [active, setActive] = useState(false)
  const refresh = useCallback(async () => {
    try {
      const response = await fetch(`/api/visuals?runId=${encodeURIComponent(runId)}`, { cache: "no-store" })
      const body = await response.json()
      if (!response.ok) throw Error(body.message || "ვიზუალები ვერ ჩაიტვირთა.")
      setSnapshot(body); setError("")
    } catch (e) { setError(e instanceof Error ? e.message : "ვიზუალები ვერ ჩაიტვირთა.") }
  }, [runId])
  useEffect(() => {
    if (!active) return
    let stopped = false; let timer: ReturnType<typeof setTimeout>
    async function tick() {
      await refresh()
      if (!stopped) timer = setTimeout(tick, 5000)
    }
    void tick()
    return () => { stopped = true; clearTimeout(timer) }
  }, [refresh, active])
  return <VisualsContext.Provider value={{ snapshot, error, refresh, activate: () => setActive(true) }}>{children}</VisualsContext.Provider>
}

export function VisualGenerationPanel({ runId, brandId, postKey, post, disabled, onAssets }: {
  runId: string; brandId: string; postKey: string; post: PostOutline; disabled: boolean; onAssets: (assets: PostAsset[]) => void;
}) {
  const context = useContext(VisualsContext)
  const fieldId = useId()
  const initialPrompt = (slot: number) => [post.title, post.visual.description, post.visual.frames[slot]].filter(Boolean).join("\n\n")
  const [slot, setSlot] = useState(0)
  const [prompt, setPrompt] = useState(() => initialPrompt(0))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")
  const [selected, setSelected] = useState<string | null>(null)
  const attempt = useRef<{ fingerprint: string; id: string } | null>(null)
  const submitting = useRef(false)
  if (!context) return null
  const { snapshot, refresh } = context
  const history = snapshot?.generations.filter((g) => g.target?.postKey === postKey && g.target.slot === slot) ?? []
  const result = history.find((g) => g.id === selected) ?? history[0]
  const pending = history.some((g) => g.status === "pending")
  async function generate() {
    if (submitting.current || disabled || pending) return
    submitting.current = true; setBusy(true); setError(""); setNotice("")
    const input = { prompt, brandId, target: { runId, postKey, slot }, aspectRatio: post.visual.aspectRatio === "none" ? "1:1" : post.visual.aspectRatio, requestKind: history.some((g) => g.status === "succeeded") ? "regenerate" : "generate" }
    const fingerprint = JSON.stringify(input)
    if (attempt.current?.fingerprint !== fingerprint) attempt.current = { fingerprint, id: crypto.randomUUID() }
    try {
      const response = await fetch("/api/visuals/generate", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...input, requestId: attempt.current.id }) })
      const body = await response.json()
      if (!response.ok) {
        if (response.status < 500) attempt.current = null
        throw Error(body.message || "გენერაცია ვერ დაიწყო.")
      }
      setSelected(body.generation.id); attempt.current = null
      setNotice("მოთხოვნა შენახულია. სურათის შექმნას რამდენიმე წუთი შეიძლება დასჭირდეს.")
    } catch (e) { setError(e instanceof Error ? e.message : "კავშირი შეწყდა. სტატუსი განაახლეთ ან გაიმეორეთ იგივე მოთხოვნა.") }
    finally { await refresh(); submitting.current = false; setBusy(false) }
  }
  async function attach() {
    if (!result || busy || disabled) return
    setBusy(true); setError(""); setNotice("")
    try {
      const response = await fetch("/api/visuals/attach", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ generationId: result.id, runId, postKey, slot }) })
      const body = await response.json()
      if (!response.ok) throw Error(body.message)
      onAssets(body.assets); setNotice("გამოსახულება პოსტზე დამატებულია.")
    } catch (e) { setError(e instanceof Error ? e.message : "გამოსახულება ვერ მიემაგრა.") } finally { setBusy(false) }
  }
  return <details className="fp-visual-generator wp-details" onToggle={(e) => { if (e.currentTarget.open) context.activate() }}>
    <summary>✧ გამოსახულების გენერაცია {snapshot ? <span className="fp-visual-credit-badge">{snapshot.availableCredits} კრედიტი</span> : null}</summary>
    <div className="fp-visual-generator-body">
      <p>აღწერეთ სასურველი სურათი. ყოველი წარმატებული ვერსია მოიხმარს 1 კრედიტს.</p>
      {snapshot ? <p className="fp-file-hint">ბალანსი: {snapshot.remainingCredits} · ხელმისაწვდომი: {snapshot.availableCredits}{snapshot.reservedCredits ? ` · მუშავდება: ${snapshot.reservedCredits}` : ""}{["demo", "development", "test"].includes(snapshot.mode) ? " · დემო კრედიტები" : ""}</p> : <p role="status">კრედიტები იტვირთება…</p>}
      {post.visual.frames.length > 1 ? <label htmlFor={`${fieldId}-slot`}>გამოსახულება<select id={`${fieldId}-slot`} value={slot} disabled={busy} onChange={(e) => { const next = Number(e.target.value); setSlot(next); setPrompt(initialPrompt(next)); setSelected(null); setNotice(""); setError("") }}>{post.visual.frames.map((_, i) => <option key={i} value={i}>გამოსახულება {i + 1}</option>)}</select></label> : null}
      <label htmlFor={`${fieldId}-prompt`}>სურათის აღწერა</label>
      <textarea id={`${fieldId}-prompt`} value={prompt} maxLength={4000} rows={5} disabled={disabled || busy || pending} onChange={(e) => setPrompt(e.target.value)} />
      <div className="fp-visual-generate-actions"><button type="button" className="wp-button" disabled={disabled || busy || pending || !snapshot?.enabled || snapshot.availableCredits < 1 || !prompt.trim()} onClick={() => void generate()}>{busy ? "ინახება…" : pending ? "სურათი იქმნება…" : history.some((g) => g.status === "succeeded") ? "ახალი ვერსია · 1 კრედიტი" : "სურათის შექმნა · 1 კრედიტი"}</button><button type="button" className="fp-copy-button" onClick={() => void refresh()}>სტატუსის განახლება</button></div>
      {snapshot && !snapshot.enabled ? <p role="status">{snapshot.message}</p> : snapshot && snapshot.availableCredits < 1 ? <p role="status">{snapshot.reservedCredits ? "თავისუფალი კრედიტები არ არის. დაელოდეთ მიმდინარე გენერაციას." : "ვიზუალური კრედიტები ამოიწურა."}</p> : null}
      {pending ? <p role="status" className="fp-copy-pending"><span className="fp-pulse" />სურათი იქმნება. გვერდის დატოვების შემთხვევაშიც შედეგი აქ შეინახება.</p> : null}
      {error || context.error ? <p className="wp-error" role="alert">{error || context.error}</p> : null}
      {notice && !pending ? <p role="status">{notice}</p> : null}
      {result?.status === "failed" ? <p className="wp-error" role="alert">{result.error}</p> : null}
      {result?.imageUrl ? <figure className="fp-generated-result"><Image unoptimized src={result.imageUrl} width={result.width ?? 1024} height={result.height ?? 1024} alt={result.prompt} /><figcaption>შექმნილი გამოსახულება · 1 კრედიტი</figcaption><button type="button" className="wp-button" disabled={busy || disabled} onClick={() => void attach()}>პოსტზე დამატება</button><a href={result.imageUrl} download={`unda-${result.id}.webp`}>ჩამოტვირთვა</a></figure> : null}
      {history.length ? <details className="fp-visual-history"><summary>ამ გამოსახულების ისტორია · {history.length}</summary><ul>{history.map((g) => <li key={g.id}><button type="button" aria-pressed={result?.id === g.id} onClick={() => { setSelected(g.id); setNotice("") }}><span>{g.status === "succeeded" ? "✓ შექმნილია" : g.status === "failed" ? "ვერ შეიქმნა" : "მუშავდება"} · {new Date(g.createdAt).toLocaleString("ka-GE")}</span><small>{g.prompt}</small></button></li>)}</ul></details> : null}
    </div>
  </details>
}
