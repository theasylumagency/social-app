import Link from "next/link"
import { displayDate } from "../../application/dashboard/model"
import { SUBSCRIPTION_PLANS, type SubscriptionPlan } from "../../application/subscriptions/policy"
import { requireSession } from "../_server/auth"
import { getDatabasePool } from "../_server/database"
import { ensurePersonalWorkspace } from "../../infrastructure/postgres/workspace-store"
import { readSubscription } from "../../infrastructure/postgres/subscription-store"
import { SubscriptionClient } from "./subscription-client"
import { SignOutButton } from "../account/account-controls"
import "./subscription.css"

export const metadata = { title: "ტარიფის არჩევა — UNDA" }

function planName(plan: string) {
  if (plan === "custom") return "Custom"
  return SUBSCRIPTION_PLANS[plan as Exclude<SubscriptionPlan, "custom">]?.name ?? plan
}

export default async function SubscriptionPage() {
  const session = await requireSession("/subscription")
  const pool = getDatabasePool()
  const workspace = await ensurePersonalWorkspace(pool, session.user.id)
  const [subscription, payments, brands] = await Promise.all([
    readSubscription(pool, session.user.id),
    pool.query<{ id: string; plan: string; paid_at: Date }>(
      "SELECT id,plan,paid_at FROM subscription_payments WHERE workspace_id=$1 ORDER BY paid_at DESC LIMIT 10",
      [workspace.workspaceId],
    ),
    pool.query<{ n: number }>("SELECT count(*)::int n FROM brands WHERE workspace_id=$1", [workspace.workspaceId]),
  ])

  const simulatedBilling = process.env.NODE_ENV !== "production" || process.env.BILLING_MODE === "simulated"

  return (
    <main className="subscription-shell">
      <header>
        <Link className="brand-mark" href="/">UNDA</Link>
        <nav>
          <Link href="/account">ჩემი ანგარიში</Link>
          <SignOutButton />
        </nav>
      </header>

      <section className="subscription-hero">
        <p className="eyebrow">UNDA Social</p>
        <h1>აირჩიეთ ტარიფი</h1>
        <p>რამდენი აქტიური ბრენდის მართვა გსურთ?</p>
      </section>

      <section className="subscription-content">
        <SubscriptionClient
          subscription={subscription}
          brandCount={brands.rows[0]!.n}
          enabled={simulatedBilling}
        />

        {payments.rowCount ? (
          <details className="subscription-history">
            <summary>გადახდების ისტორია</summary>
            <ul>
              {payments.rows.map((payment) => (
                <li key={payment.id}>
                  {displayDate(payment.paid_at.toISOString(), { year: "numeric", hour: "2-digit" })}
                  {" · "}{planName(payment.plan)} · სატესტო გადახდა
                </li>
              ))}
            </ul>
          </details>
        ) : null}
      </section>
    </main>
  )
}
