import { authenticateAccountRequest } from "../../_server/auth"
import { getDatabasePool } from "../../_server/database"
import { purchaseSubscription } from "../../../infrastructure/postgres/subscription-store"
import { isDiscoveryId } from "../../../infrastructure/postgres/brand-discovery-store"
import type { SubscriptionPlan } from "../../../application/subscriptions/policy"

export async function POST(request: Request) {
  const auth = await authenticateAccountRequest(request)
  if (auth.error) return auth.error
  // Explicitly enabled in deployed test environments; never silently becomes a real payment.
  if (process.env.NODE_ENV === "production" && process.env.BILLING_MODE !== "simulated") return Response.json({ message: "სატესტო გადახდა ამ გარემოში გამორთულია." }, { status: 403 })
  try {
    const raw = await request.text()
    if (raw.length > 1000) throw Error()
    const body = JSON.parse(raw)
    if (!body || !isDiscoveryId(body.paymentId) || !["solo", "studio", "agency", "custom"].includes(body.plan)) throw Error()
    const subscription = await purchaseSubscription(getDatabasePool(), auth.session.user.id, body.paymentId, body.plan as SubscriptionPlan)
    return Response.json({ subscription, redirect: "/" })
  } catch (error) {
    return Response.json({ message: error instanceof Error && /[ა-ჰ]/u.test(error.message) ? error.message : "გადახდა ვერ შეინახა. სცადეთ ხელახლა." }, { status: 422 })
  }
}
