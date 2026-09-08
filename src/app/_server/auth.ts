import "server-only"

import { cache } from "react"
import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { createAuth } from "../../lib/auth/create-auth"
import { authOrigin, socialProviders } from "../../lib/auth/environment"
import { createEmailSender } from "../../lib/auth/email"
import { getDatabasePool } from "./database"
import { createWorkRequestAuthenticator } from "../../lib/auth/work-request"

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

export async function requireSession(returnTo = "/") {
  const session = await currentSession()
  if (!session || !session.user.emailVerified) redirect(`/login?next=${encodeURIComponent(returnTo)}`)
  return session
}

export const authenticateWorkRequest = createWorkRequestAuthenticator({
  origin: authOrigin,
  isDevelopment: () => process.env.NODE_ENV !== "production",
  session: (request) => getAuth().api.getSession({ headers: request.headers }),
})
