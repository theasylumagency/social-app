"use client"

import { useRouter } from "next/navigation"
import { useRef, useState } from "react"
import Link from "next/link"
import { displayDate } from "../../application/dashboard/model"
import {
  SUBSCRIPTION_PLANS,
  subscriptionActive,
  type BillingPeriod,
  type Subscription,
  type SubscriptionPlan,
} from "../../application/subscriptions/policy"

const PLAN_IDS = ["solo", "studio", "agency"] as const

type PublicPlan = (typeof PLAN_IDS)[number]

type PendingRequest = {
  plan: PublicPlan
  billingPeriod: BillingPeriod
  id: string
}

function money(value: number) {
  return new Intl.NumberFormat("ka-GE", { maximumFractionDigits: 0 }).format(value)
}

export function SubscriptionClient({
  subscription,
  brandCount,
  enabled,
}: {
  subscription: Subscription | null
  brandCount: number
  enabled: boolean
}) {
  const router = useRouter()
  const active = subscriptionActive(subscription)
  const initialPlan = active && subscription?.plan !== "custom" ? subscription?.plan : null
  const [selectedPlan, setSelectedPlan] = useState<PublicPlan | null>(initialPlan as PublicPlan | null)
  const [billingPeriod, setBillingPeriod] = useState<BillingPeriod>("monthly")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const request = useRef<PendingRequest | null>(null)

  async function purchase() {
    if (!selectedPlan || busy) return
    setBusy(true)
    setError("")

    if (
      request.current?.plan !== selectedPlan ||
      request.current?.billingPeriod !== billingPeriod
    ) {
      request.current = {
        plan: selectedPlan,
        billingPeriod,
        id: crypto.randomUUID(),
      }
    }

    try {
      const response = await fetch("/api/subscription", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          plan: selectedPlan,
          billingPeriod,
          paymentId: request.current.id,
        }),
      })
      const result = await response.json()
      if (!response.ok) throw Error(result.message)
      router.push("/")
      router.refresh()
    } catch (error) {
      setError(error instanceof Error ? error.message : "სცადეთ ხელახლა.")
      setBusy(false)
    }
  }

  const selectedName = selectedPlan ? SUBSCRIPTION_PLANS[selectedPlan].name : null

  return (
    <>
      {subscription ? (
        <section className="subscription-status">
          <div>
            <strong>{active ? "გამოწერა აქტიურია" : "წვდომა შეჩერებულია"}</strong>
            <p>
              {brandCount} / {subscription.brandLimit} ბრენდი · ვადა: {displayDate(subscription.expiresAt, { year: "numeric" })}
            </p>
          </div>
          {active ? <Link href="/">სამუშაო სივრცეში დაბრუნება →</Link> : null}
        </section>
      ) : null}

      <div className="billing-row" aria-label="გადახდის პერიოდულობა">
        <div className={`billing-toggle ${billingPeriod === "annual" ? "annual" : ""}`}>
          <button
            type="button"
            className={billingPeriod === "monthly" ? "active" : ""}
            onClick={() => setBillingPeriod("monthly")}
          >
            Monthly
          </button>
          <button
            type="button"
            className={billingPeriod === "annual" ? "active" : ""}
            onClick={() => setBillingPeriod("annual")}
          >
            Annual
          </button>
        </div>
        <span className="annual-saving">{billingPeriod === "annual" ? "2 თვე უფასოდ" : ""}</span>
      </div>

      <div className="subscription-grid">
        {PLAN_IDS.map((id) => {
          const plan = SUBSCRIPTION_PLANS[id]
          const selected = selectedPlan === id
          const unavailable =
            plan.brandLimit < brandCount ||
            (active && subscription ? plan.brandLimit < subscription.brandLimit : false)
          const price = billingPeriod === "annual" ? plan.annualPriceGel : plan.monthlyPriceGel
          const effectiveMonthly = plan.annualPriceGel / 12

          return (
            <button
              key={id}
              type="button"
              className={`subscription-card ${selected ? "selected" : ""}`}
              aria-pressed={selected}
              disabled={unavailable}
              onClick={() => setSelectedPlan(id)}
            >
              <span className="selected-mark" aria-hidden="true">✓</span>
              <span className="plan-name">{plan.name}</span>
              <span className="brand-limit">
                {plan.brandLimit === 1 ? "1 აქტიური ბრენდი" : `${plan.brandLimit}-მდე აქტიური ბრენდი`}
              </span>

              <span className="price-block">
                <span className="price-line">
                  <strong>{money(price)} ₾</strong>
                  <span>/ {billingPeriod === "annual" ? "წელი" : "თვე"}</span>
                </span>
                <span className="effective-price">
                  {billingPeriod === "annual"
                    ? `ეფექტურად ${money(Math.round(effectiveMonthly))} ₾ / თვე`
                    : "\u00a0"}
                </span>
              </span>

              <span className="plan-details">
                <span>Full Social Operator</span>
                <span>{plan.brandLimit === 1 ? "1 brand workspace" : `${plan.brandLimit}-მდე brand workspace`}</span>
                <span>{plan.visualCredits} გრაფიკული კრედიტი / თვე</span>
              </span>
            </button>
          )
        })}
      </div>

      <p className="visual-credit-note">
        დამატებითი გრაფიკული კრედიტების შეძენა შესაძლებელია ნებისმიერ დროს.
      </p>

      <section className="money-back-guarantee">
        <span className="guarantee-icon" aria-hidden="true">◇</span>
        <div>
          <strong>30-დღიანი თანხის დაბრუნების გარანტია</strong>
          <p>
            თუ პირველი 30 დღის განმავლობაში გადაწყვეტთ, რომ UNDA თქვენთვის არ არის,
            გააუქმეთ გამოწერა და დაგიბრუნებთ გამოწერისთვის გადახდილ თანხას.
          </p>
          <details>
            <summary>პირობები</summary>
            <p>
              გარანტია ვრცელდება ახალი ანგარიშის პირველ გამოწერაზე. ცალკე შეძენილი
              გრაფიკული კრედიტები თანხის დაბრუნების გარანტიაში არ შედის.
            </p>
          </details>
        </div>
      </section>

      <div className="subscription-action">
        <button
          type="button"
          className="subscription-continue"
          disabled={!selectedPlan || busy || !enabled}
          onClick={() => void purchase()}
        >
          {busy
            ? "ინახება…"
            : selectedName
              ? `გაგრძელება — ${selectedName} →`
              : "აირჩიეთ ტარიფი"}
        </button>
        <p className="simulation-note">სატესტო გარემო · არჩევა არ იწვევს რეალურ გადახდას</p>
      </div>

      {!enabled ? <p role="status">ამ გარემოში სატესტო გადახდა გამორთულია.</p> : null}
      {error ? <p className="subscription-error" role="alert">{error}</p> : null}
    </>
  )
}
