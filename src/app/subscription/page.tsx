import Link from "next/link"
import { requireSession } from "../_server/auth"
import { getDatabasePool } from "../_server/database"
import { ensurePersonalWorkspace } from "../../infrastructure/postgres/workspace-store"
import { readSubscription } from "../../infrastructure/postgres/subscription-store"
import { SubscriptionClient } from "./subscription-client"
import { SignOutButton } from "../account/account-controls"
import "./subscription.css"

export const metadata = { title: "გამოწერა — UNDA" }
export default async function SubscriptionPage() {
  const session = await requireSession("/subscription")
  const pool = getDatabasePool()
  const workspace = await ensurePersonalWorkspace(pool, session.user.id)
  const [subscription, custom, payments, brands] = await Promise.all([
    readSubscription(pool, session.user.id),
    pool.query<{ brand_limit: number; terms: string }>("SELECT brand_limit,terms FROM subscription_custom_terms WHERE workspace_id=$1", [workspace.workspaceId]),
    pool.query<{ id: string; plan: string; paid_at: Date }>("SELECT id,plan,paid_at FROM subscription_payments WHERE workspace_id=$1 ORDER BY paid_at DESC LIMIT 10", [workspace.workspaceId]),
    pool.query<{ n: number }>("SELECT count(*)::int n FROM brands WHERE workspace_id=$1", [workspace.workspaceId]),
  ])
  return <main className="subscription-shell"><header><Link className="brand-mark" href="/">UNDA</Link><nav><Link href="/account">ჩემი ანგარიში</Link><SignOutButton /></nav></header>
    <p className="eyebrow">სოციალური ქსელების AI მენეჯერი</p><h1>აირჩიეთ სივრცე თქვენი ბრენდებისთვის.</h1><p>ყველა ტარიფში: ბრენდის გაცნობა, სოციალური სტრატეგია, მიმდინარე კვირის კონტენტი და შედეგებიდან სწავლა.</p>
    <SubscriptionClient subscription={subscription} brandCount={brands.rows[0]!.n} custom={custom.rows[0] ?? null} enabled={process.env.NODE_ENV !== "production" || process.env.BILLING_MODE === "simulated"} />
    {payments.rowCount ? <details><summary>გადახდების ისტორია</summary><ul>{payments.rows.map((p) => <li key={p.id}>{p.paid_at.toLocaleString("ka-GE", { timeZone: "Asia/Tbilisi" })} · {p.plan} · სატესტო გადახდა</li>)}</ul></details> : null}
  </main>
}
