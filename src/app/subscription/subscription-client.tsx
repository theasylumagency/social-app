"use client"
import { useRouter } from "next/navigation"
import { useRef, useState } from "react"
import Link from "next/link"
import { displayDate } from "../../application/dashboard/model"
import { SUBSCRIPTION_PLANS, subscriptionActive, type Subscription, type SubscriptionPlan } from "../../application/subscriptions/policy"

export function SubscriptionClient({ subscription, brandCount, custom, enabled }: { subscription: Subscription | null; brandCount: number; custom: { brand_limit: number; terms: string } | null; enabled: boolean }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const request = useRef<{ plan: SubscriptionPlan; id: string } | null>(null)
  const active = subscriptionActive(subscription)
  async function purchase(plan: SubscriptionPlan) {
    if (busy) return
    setBusy(true); setError("")
    if (request.current?.plan !== plan) request.current = { plan, id: crypto.randomUUID() }
    try {
      const response = await fetch("/api/subscription", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ plan, paymentId: request.current.id }) })
      const result = await response.json()
      if (!response.ok) throw Error(result.message)
      router.push("/"); router.refresh()
    } catch (error) { setError(error instanceof Error ? error.message : "სცადეთ ხელახლა."); setBusy(false) }
  }
  const plans = [...Object.entries(SUBSCRIPTION_PLANS).map(([id, p]) => ({ id: id as SubscriptionPlan, name: p.name, limit: p.brandLimit as number })), { id: "custom" as const, name: "10-ზე მეტი ბრენდი", limit: custom?.brand_limit ?? null }]
  return <>
    <div className="subscription-notice"><strong>ტესტირების ეტაპი — თანხა არ ჩამოიჭრება.</strong><p>ღილაკი მხოლოდ სატესტო გადახდას აფიქსირებს. გამოწერა მოქმედებს ერთი კალენდარული თვე; საცდელი პერიოდი არ არსებობს.</p></div>
    {subscription ? <section className="subscription-status"><strong>{active ? "გამოწერა აქტიურია" : "წვდომა შეჩერებულია — განაახლეთ გამოწერა"}</strong><p>{brandCount} / {subscription.brandLimit} ბრენდი · ბოლო გადახდა: {displayDate(subscription.paidAt, { year: "numeric" })} · ვადა: {displayDate(subscription.expiresAt, { year: "numeric", hour: "2-digit" })}</p>{active ? <Link href="/">სამუშაო სივრცეში დაბრუნება →</Link> : <p>ბრენდები და შესრულებული სამუშაო შენარჩუნებულია.</p>}</section> : null}
    <div className="subscription-grid">{plans.map((p) => <article key={p.id}><p className="eyebrow">{p.id === "custom" ? "ინდივიდუალური პირობები" : "ყოველთვიური გამოწერა"}</p><h2>{p.name}</h2><p>{p.limit ? `${p.limit} ბრენდის მართვა ერთ ანგარიშში` : "ლიმიტი და პირობები შეთანხმდება ინდივიდუალურად."}</p><p>{p.id === "custom" ? custom?.terms : "სტრატეგია და სამუშაო ციკლი თითოეული ბრენდისთვის."}</p><strong>ტესტირებისას გადასახდელი: 0 ₾</strong><button disabled={busy || !enabled || !p.limit || p.limit < brandCount || (active && p.limit < subscription!.brandLimit)} onClick={() => void purchase(p.id)}>{busy ? "ინახება…" : !p.limit ? "პირობები ჯერ არ არის შეთანხმებული" : active && p.limit > subscription!.brandLimit ? "გამოწერის გაუმჯობესება" : subscription?.plan === p.id ? "გამოწერის განახლება" : "არჩევა და სატესტო გადახდა"}</button></article>)}</div>
    <p>გაუმჯობესება მაშინვე ზრდის ბრენდების ლიმიტს და ინარჩუნებს მიმდინარე ვადას. განახლება ამატებს ერთ თვეს. გადაუხდელობისას სამუშაო სივრცე შეჩერდება.</p>
    {!enabled ? <p role="status">ამ გარემოში სატესტო გადახდა გამორთულია.</p> : null}{error ? <p role="alert">{error}</p> : null}
  </>
}
