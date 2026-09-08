import type { Pool, PoolClient } from "pg"
import { ensurePersonalWorkspace } from "./workspace-store"
import { nextSubscriptionPeriod, SUBSCRIPTION_PLANS, subscriptionActive, type Subscription, type SubscriptionPlan } from "../../application/subscriptions/policy"

export async function readSubscription(pool: Pool | PoolClient, ownerId: string): Promise<Subscription | null> {
  const r = await pool.query<{ plan: SubscriptionPlan; brand_limit: number; paid_at: Date; expires_at: Date }>(`SELECT s.* FROM workspace_subscriptions s JOIN workspaces w ON w.id=s.workspace_id WHERE w.owner_user_id=$1`, [ownerId])
  const s = r.rows[0]
  return s ? { plan: s.plan, brandLimit: s.brand_limit, paidAt: s.paid_at.toISOString(), expiresAt: s.expires_at.toISOString(), paymentMode: "simulated" } : null
}
export async function hasSubscription(pool: Pool | PoolClient, ownerId: string) { return subscriptionActive(await readSubscription(pool, ownerId)) }
export async function purchaseSubscription(pool: Pool, ownerId: string, paymentId: string, plan: SubscriptionPlan) {
  const workspace = await ensurePersonalWorkspace(pool, ownerId)
  const c = await pool.connect()
  try {
    await c.query("BEGIN")
    await c.query("SELECT id FROM workspaces WHERE id=$1 FOR UPDATE", [workspace.workspaceId])
    const previousPayment = await c.query("SELECT plan FROM subscription_payments WHERE id=$1 AND workspace_id=$2", [paymentId, workspace.workspaceId])
    if (previousPayment.rowCount) {
      if (previousPayment.rows[0].plan !== plan) throw Error("გადახდის მოთხოვნა უკვე გამოყენებულია.")
      await c.query("COMMIT"); return await readSubscription(c, ownerId)
    }
    const custom = plan === "custom" ? await c.query<{ brand_limit: number }>("SELECT brand_limit FROM subscription_custom_terms WHERE workspace_id=$1", [workspace.workspaceId]) : null
    const limit = plan === "custom" ? custom?.rows[0]?.brand_limit : SUBSCRIPTION_PLANS[plan]?.brandLimit
    if (!limit) throw Error("სპეციალური ტარიფისთვის ჯერ ინდივიდუალური პირობებია შესათანხმებელი.")
    const brands = await c.query<{ n: number }>("SELECT count(*)::int n FROM brands WHERE workspace_id=$1", [workspace.workspaceId])
    if (brands.rows[0]!.n > limit) throw Error("აირჩიეთ ტარიფი, რომელიც თქვენს ყველა ბრენდს მოიცავს.")
    const s = nextSubscriptionPeriod(await readSubscription(c, ownerId), plan, limit)
    await c.query(`INSERT INTO workspace_subscriptions(workspace_id,plan,brand_limit,paid_at,expires_at,payment_mode) VALUES($1,$2,$3,$4,$5,'simulated') ON CONFLICT(workspace_id) DO UPDATE SET plan=excluded.plan,brand_limit=excluded.brand_limit,paid_at=excluded.paid_at,expires_at=excluded.expires_at`, [workspace.workspaceId, plan, limit, s.paidAt, s.expiresAt])
    await c.query("INSERT INTO subscription_payments(id,workspace_id,plan,brand_limit,paid_at,expires_at,mode) VALUES($1,$2,$3,$4,$5,$6,'simulated')", [paymentId, workspace.workspaceId, plan, limit, s.paidAt, s.expiresAt])
    await c.query("COMMIT"); return s
  } catch (error) { await c.query("ROLLBACK"); throw error } finally { c.release() }
}

/** Held through the brand insert, sharing checkout's lock to prevent concurrent over-allocation. */
export async function assertBrandCapacity(c: PoolClient, workspaceId: string, brandId: string) {
  const w = await c.query<{ owner_user_id: string }>("SELECT owner_user_id FROM workspaces WHERE id=$1 FOR UPDATE", [workspaceId])
  if (!w.rowCount) throw Error("სამუშაო სივრცე ვერ მოიძებნა.")
  const subscription = await readSubscription(c, w.rows[0]!.owner_user_id)
  if (!subscriptionActive(subscription)) throw Error("გასაგრძელებლად განაახლეთ გამოწერა.")
  const existing = await c.query("SELECT id FROM brands WHERE id=$1 AND workspace_id=$2", [brandId, workspaceId])
  if (existing.rowCount) return
  const count = await c.query<{ n: number }>("SELECT count(*)::int n FROM brands WHERE workspace_id=$1", [workspaceId])
  if (count.rows[0]!.n >= subscription!.brandLimit) throw Error("ბრენდების ლიმიტი შევსებულია. გააუმჯობესეთ გამოწერა.")
}
