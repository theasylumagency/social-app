"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useRef, useState, useTransition } from "react"
import type { DashboardBrand, WeeklyBrief } from "../../application/dashboard/model"
import { Icon } from "./icons"

export function BrandSwitcher({ brands, active }: { brands: Pick<DashboardBrand, "id" | "name">[]; active: string }) {
  const router = useRouter()
  const details = useRef<HTMLDetailsElement>(null)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState("")
  const current = brands.find((brand) => brand.id === active)
  return <details className="ws-brand-switcher" ref={details} onKeyDown={(event) => { if (event.key === "Escape" && details.current) { details.current.open = false; details.current.querySelector("summary")?.focus() } }}>
    <summary><span className="ws-brand-avatar">{current?.name.slice(0, 1)}</span><span className="ws-brand-name"><strong>{current?.name}</strong><small>სამუშაო სივრცე</small></span><Icon name="down" /></summary>
    <div className="ws-brand-dropdown">
      <p>თქვენი ბრენდები · {brands.length}</p>
      {brands.map((brand) => <button key={brand.id} disabled={pending} aria-current={brand.id === active ? "true" : undefined} onClick={() => {
        setError("")
        startTransition(async () => {
          try {
            const response = await fetch("/api/workspace/select", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ brandId: brand.id }) })
            if (!response.ok) { setError("გადართვა ვერ მოხერხდა. სცადეთ ხელახლა."); return }
            if (details.current) details.current.open = false
            router.push("/workspace"); router.refresh()
          } catch { setError("კავშირი ვერ დამყარდა. სცადეთ ხელახლა.") }
        })
      }}><span>{brand.name}</span>{brand.id === active ? <Icon name="check" /> : null}</button>)}
      <Link href="/onboarding"><Icon name="plus" /> ბრენდის დამატება</Link>
      {error ? <p role="alert" className="ws-error-text">{error}</p> : null}
    </div>
  </details>
}

export function ObjectiveEditor({ brandId, week, brief }: { brandId: string; week: string; brief: WeeklyBrief }) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(brief?.objective ?? "")
  const [error, setError] = useState("")
  const [message, setMessage] = useState("")
  const [pending, startTransition] = useTransition()
  return <section className="ws-card ws-objective" aria-labelledby="objective-title">
    <div className="ws-card-heading"><h2 id="objective-title"><Icon name="target" />ამ კვირის მიზანი</h2><span className="ws-subtle">თქვენი პრიორიტეტი</span></div>
    {editing ? <form onSubmit={(event) => {
      event.preventDefault(); setError(""); setMessage("")
      startTransition(async () => {
        try {
          const response = await fetch("/api/workspace/brief", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ brandId, week, objective: value }) })
          if (!response.ok) { const body = await response.json(); setError(body.message ?? "შენახვა ვერ დასრულდა."); return }
          setEditing(false); setMessage("კვირის მიზანი შენახულია."); router.refresh()
        } catch { setError("კავშირი ვერ დამყარდა. თქვენი ტექსტი აქ რჩება.") }
      })
    }}>
      <label htmlFor="weekly-objective">რას უნდა მიაღწიოს ბრენდმა ამ კვირაში?</label>
      <textarea id="weekly-objective" autoFocus required maxLength={1200} rows={4} value={value} onChange={(event) => setValue(event.target.value)} placeholder="მაგ. ახალი მომსახურების გაცნობა იმ მომხმარებლებისთვის, რომლებიც უკვე ინტერესდებიან ჩვენი შეთავაზებით." />
      <div className="ws-editor-footer"><small>{value.length} / 1200</small><div><button className="ws-button ws-button-quiet" type="button" disabled={pending} onClick={() => { setValue(brief?.objective ?? ""); setEditing(false); setError("") }}>გაუქმება</button><button className="ws-button ws-button-green" disabled={pending || !value.trim()}>{pending ? "ინახება…" : "შენახვა"}</button></div></div>
    </form> : <>
      {brief ? <p className="ws-objective-copy">{brief.objective}</p> : <><p className="ws-objective-copy">რას უნდა ემსახურებოდეს ეს კვირა?</p><p className="ws-muted">თუ განსაკუთრებული პრიორიტეტი გაქვთ — ახალი შეთავაზება, მომსახურება ან მნიშვნელოვანი ამბავი — შეგიძლიათ აქ დაამატოთ.</p></>}
      <button className="ws-text-button" onClick={() => { setValue(brief?.objective ?? ""); setMessage(""); setEditing(true) }}><Icon name={brief ? "edit" : "plus"} />{brief ? "მიზნის დაზუსტება" : "კვირის მიზნის დამატება"}</button>
    </>}
    {error ? <p className="ws-error-text" role="alert">{error}</p> : null}
    {message ? <p className="ws-success-text" role="status">{message}</p> : null}
  </section>
}
