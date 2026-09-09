"use client"

import { useEffect, useState } from "react"
import type { PostChannel } from "../../blueprints/social/weekly-planning/posts"
import { displayDate } from "../../application/dashboard/model"

type Account = { id: string; channel: PostChannel; name: string; connected: boolean; canPublish: boolean }
type Saved = { postKey: string; schedule: { id: string; channel: PostChannel; publishAt: string }; publishingAccountId: string;
  lifecycle: { status: "scheduled" | "cancelled"; publishAt?: string } }
const modeOptions = [["social.brandStory", "ბრენდის ამბავი"], ["social.educational", "საგანმანათლებლო"],
  ["social.serviceExplainer", "მომსახურების ახსნა"], ["social.trustBuilder", "ნდობის გაძლიერება"],
  ["social.proofLed", "მტკიცებულებაზე დაფუძნებული"], ["social.directOffer", "პირდაპირი შეთავაზება"]] as const

export function SocialScheduleControls({ brandId, runId, postKey, channels, enabled }: {
  brandId: string; runId: string; postKey: string; channels: readonly PostChannel[]; enabled: boolean
}) {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [saved, setSaved] = useState<Saved[]>([])
  const [account, setAccount] = useState<Record<string, string>>({})
  const [time, setTime] = useState<Record<string, string>>({})
  const [mode, setMode] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState("")
  useEffect(() => {
    if (!enabled) return
    let active = true
    fetch(`/api/social/schedules?brandId=${encodeURIComponent(brandId)}&runId=${encodeURIComponent(runId)}`, { cache: "no-store" })
      .then(async (response) => { if (!response.ok) throw new Error(); return response.json() })
      .then((data: { accounts: Account[]; schedules: Saved[] }) => { if (active) { setAccounts(data.accounts); setSaved(data.schedules.filter((item) => item.postKey === postKey)) } })
      .catch(() => { if (active) setMessage("განრიგის მონაცემები დროებით ვერ ჩაიტვირთა.") })
    return () => { active = false }
  }, [brandId, enabled, postKey, runId])
  if (!enabled) return null
  async function submit() {
    setMessage("")
    const destinations = channels.flatMap((channel) => account[channel] && time[channel] && mode[channel]
      ? [{ channel, publishingAccountId: account[channel], publishAt: new Date(time[channel]).toISOString(), contentMode: mode[channel] }] : [])
    if (!destinations.length) { setMessage("აირჩიეთ ანგარიში, ზუსტი დრო და კონტენტის ტიპი."); return }
    setBusy(true)
    try {
      const response = await fetch("/api/social/schedules", { method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ brandId, runId, postKey, destinations }) })
      const data = await response.json()
      if (!response.ok) throw new Error(data.message)
      setSaved((current) => [...current, ...data.schedules])
      setMessage("გამოქვეყნების ზუსტი დრო შენახულია.")
    } catch (error) { setMessage(error instanceof Error ? error.message : "განრიგი ვერ შეინახა.") }
    finally { setBusy(false) }
  }
  const active = saved.filter((item) => item.lifecycle.status === "scheduled")
  return <section className="fp-schedule" aria-label="გამოქვეყნების განრიგი">
    <h4>გამოქვეყნების დაგეგმვა</h4>
    {active.map((item) => <p key={item.schedule.id}><strong>{item.schedule.channel === "facebook" ? "Facebook" : "Instagram"}</strong> · <time dateTime={item.lifecycle.publishAt ?? item.schedule.publishAt}>{displayDate(item.lifecycle.publishAt ?? item.schedule.publishAt, { year: "numeric", hour: "2-digit" })}</time></p>)}
    {channels.map((channel) => { const choices = accounts.filter((item) => item.channel === channel && item.connected && item.canPublish); return <fieldset key={channel}><legend>{channel === "facebook" ? "Facebook" : "Instagram"}</legend>
      <label>ანგარიში<select value={account[channel] ?? ""} onChange={(event) => setAccount((value) => ({ ...value, [channel]: event.target.value }))}><option value="">აირჩიეთ</option>{choices.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label>
      <label>ზუსტი დრო<input type="datetime-local" value={time[channel] ?? ""} onChange={(event) => setTime((value) => ({ ...value, [channel]: event.target.value }))} /></label>
      <label>კონტენტის ტიპი<select value={mode[channel] ?? ""} onChange={(event) => setMode((value) => ({ ...value, [channel]: event.target.value }))}><option value="">აირჩიეთ</option>{modeOptions.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
      {!choices.length ? <small>ამ არხზე გამოსაქვეყნებელი ანგარიში ჯერ არ არის დაკავშირებული.</small> : null}
    </fieldset> })}
    <button type="button" className="wp-button" disabled={busy} onClick={() => void submit()}>{busy ? "ინახება…" : "განრიგში დამატება"}</button>
    {message ? <p role="status">{message}</p> : null}
  </section>
}
