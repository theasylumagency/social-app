import "server-only"

import { cache } from "react"
import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { createAuth } from "../../lib/auth/create-auth"
import { authOrigin, socialProviders } from "../../lib/auth/environment"
import { createEmailSender } from "../../lib/auth/email"
import { getDatabasePool } from "./database"
import { createWorkRequestAuthenticator } from "../../lib/auth/work-request"
import { hasSubscription, readSubscription } from "../../infrastructure/postgres/subscription-store"
import { subscriptionActive } from "../../application/subscriptions/policy"

let instance: ReturnType<typeof createAuth> | undefined

export function getAuth() {
  return instance ??= createAuth({
    pool: getDatabasePool(),
    origin: authOrigin(),
    secret: process.env.BETTER_AUTH_SECRET || "",
    providers: socialProviders(),
    sendEmail: createEmailSender(),
  })
}

export const currentSession = cache(async () => {
  const requestHeaders = await headers()
  return getAuth().api.getSession({ headers: requestHeaders })
})
export const currentSubscription = cache((ownerId: string) => readSubscription(getDatabasePool(), ownerId))

export async function requireSession(returnTo = "/") {
  const session = await currentSession()
  if (!session || !session.user.emailVerified) redirect(`/login?next=${encodeURIComponent(returnTo)}`)
  if (returnTo !== "/account" && returnTo !== "/subscription" && !subscriptionActive(await currentSubscription(session.user.id))) redirect("/subscription")
  return session
}

export const authenticateAccountRequest = createWorkRequestAuthenticator({
  origin: authOrigin,
  isDevelopment: () => process.env.NODE_ENV !== "production",
  session: (request) => getAuth().api.getSession({ headers: request.headers }),
})

export async function authenticateWorkRequest(request: Request) {
  const access = await authenticateAccountRequest(request)
  if (access.error) return access
  if (!await hasSubscription(getDatabasePool(), access.session.user.id)) return { error: Response.json({ message: "გამოწერა არ არის აქტიური. გასაგრძელებლად განაახლეთ იგი.", redirect: "/subscription" }, { status: 402 }) } as const
  return access
}
export async function subscriptionRequired(ownerId: string) {
  return await hasSubscription(getDatabasePool(), ownerId) ? null : Response.json({ message: "გასაგრძელებლად განაახლეთ გამოწერა.", redirect: "/subscription" }, { status: 402 })
}
