"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import type { ConnectionAccountView } from "../../application/social-connections/view"
import type { PageChoice } from "../../application/social-connections/connection-flow"
import { Icon } from "./icons"

export function ConnectionsClient({ brandId, accounts, available, intentId, outcome }: {
  brandId: string; accounts: ConnectionAccountView[]; available: boolean; intentId: string; outcome: string
}) {
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState(outcome === "failed" ? "ანგარიშის დაკავშირება ვერ დასრულდა. სცადეთ თავიდან." : outcome === "connected" ? "ანგარიში დაკავშირებულია." : "")
  async function begin(channel: "facebook" | "instagram", accountId?: string) {
    setBusy(true); setMessage("")
    try {
      const response = await fetch(`/api/social/connections/${channel}`, { method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ brandId, ...(accountId ? { accountId } : {}) }) })
      const result = await response.json()
      if (!response.ok) throw new Error(result.message)
      window.location.assign(result.authUrl)
    } catch { setMessage("დაკავშირება ვერ დაიწყო. მოგვიანებით სცადეთ."); setBusy(false) }
  }
  return <section className="ws-card ws-connection-card">
    <div className="ws-card-heading"><h2>სოციალური ანგარიშები</h2><span>{accounts.filter((a) => a.connected).length} დაკავშირებული</span></div>
    {message ? <p role="status" className="ws-connection-note">{message}</p> : null}
    {(["facebook", "instagram"] as const).map((channel) => <div key={channel}>
      <div className="ws-channel-row"><span className={`ws-channel-icon ws-${channel}`}><Icon name={channel} /></span>
        <div><h3>{channel === "facebook" ? "Facebook" : "Instagram"}</h3><p>{channel === "facebook" ? "აირჩიეთ თქვენი Facebook გვერდი" : "დააკავშირეთ პროფესიული Instagram ანგარიში"}</p></div>
        <button type="button" className="ws-button ws-button-outline" disabled={!available || busy} onClick={() => begin(channel)}>დაკავშირება</button>
      </div>
      {accounts.filter((a) => a.channel === channel).map((account) => <div className="ws-channel-row" key={account.id}>
        <div><h3>{account.name}</h3><p>{account.connected ? "დაკავშირებულია" : "საჭიროა ხელახლა დაკავშირება"}</p>
          {account.connected ? <small>გამოქვეყნების წვდომა: {account.canPublish ? "არის" : "არ არის"} · შედეგების წვდომა: {account.canFetchAnalytics ? "არის" : "არ არის"}</small> : null}</div>
        <button type="button" className="ws-button ws-button-outline" disabled={!available || busy} onClick={() => begin(channel, account.id)}>ხელახლა დაკავშირება</button>
      </div>)}
    </div>)}
    {!available ? <p className="ws-connection-note">დაკავშირება ჯერ არ არის გააქტიურებული.</p> : null}
    {intentId ? <FacebookPagePicker key={intentId} intentId={intentId} brandId={brandId} /> : null}
    <p className="ws-connection-note">ანგარიშის დაკავშირება პოსტებს არ აქვეყნებს. გამოქვეყნების ფუნქცია შემდეგ ეტაპზე დაემატება.</p>
  </section>
}

function FacebookPagePicker({ intentId, brandId }: { intentId: string; brandId: string }) {
  const router = useRouter()
  const [pages, setPages] = useState<PageChoice[] | null>(null)
  const [selected, setSelected] = useState("")
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState("")
  useEffect(() => {
    const controller = new AbortController()
    void fetch(`/api/social/connections/facebook/pages?intent=${encodeURIComponent(intentId)}`, { signal: controller.signal, cache: "no-store" })
      .then(async (response) => {
        const data = await response.json()
        if (!response.ok || data.brandId !== brandId) throw Error()
        setPages(data.pages)
      }).catch(() => { if (!controller.signal.aborted) setMessage("გვერდების სია ვერ ჩაიტვირთა ან კავშირის დრო ამოიწურა. დაიწყეთ თავიდან.") })
    return () => controller.abort()
  }, [intentId, brandId])
  async function confirm() {
    if (!selected || busy) return
    setBusy(true); setMessage("")
    try {
      const response = await fetch("/api/social/connections/facebook/select-page", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ intentId, pageId: selected }) })
      if (!response.ok) throw Error()
      router.replace("/workspace/connections?connection=connected")
      router.refresh()
    } catch { setMessage("გვერდი ვერ დაკავშირდა. დაიწყეთ დაკავშირება თავიდან."); setBusy(false) }
  }
  return <section className="ws-page-picker" aria-label="Facebook გვერდის არჩევა">
    <h3>რომელი გვერდი დავაკავშიროთ?</h3>
    {message ? <p role="alert">{message}</p> : null}
    {pages === null && !message ? <p role="status">გვერდები იტვირთება…</p> : null}
    {pages?.length === 0 ? <p>ხელმისაწვდომი გვერდები ვერ მოიძებნა. შეამოწმეთ Facebook-ზე გვერდის მართვის უფლება.</p> : null}
    {pages?.length ? <fieldset disabled={busy}><legend>აირჩიეთ ერთი გვერდი</legend>
      {pages.map((page) => <label key={page.id}><input type="radio" name="facebook-page" value={page.id} checked={selected === page.id} onChange={() => setSelected(page.id)} /> {page.name}</label>)}
    </fieldset> : null}
    <button type="button" className="ws-button ws-button-green" disabled={!selected || busy} onClick={confirm}>{busy ? "უკავშირდება…" : "არჩეული გვერდის დაკავშირება"}</button>
    <Link className="ws-text-link" href="/workspace/connections" replace prefetch={false}>გაუქმება</Link>
  </section>
}
