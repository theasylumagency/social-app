import "server-only"

import { cache } from "react"
import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { createAuth } from "../../lib/auth/create-auth"
import { authOrigin, socialProviders } from "../../lib/auth/environment"
import { createEmailSender } from "../../lib/auth/email"
import { getDatabasePool } from "./database"

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

export async function authenticateWorkRequest(request: Request) {
  const origin = request.headers.get("origin")
  const expectedOrigin = authOrigin()
  const isDev = process.env.NODE_ENV !== "production"
  const isAllowedDevOrigin = isDev && (origin === "http://localhost:3000" || origin === "http://127.0.0.1:3000")
  if (origin !== expectedOrigin && !isAllowedDevOrigin) {
    return { error: Response.json({ message: "მოთხოვნა დაუშვებელია." }, { status: 403 }) } as const
  }
  const session = await getAuth().api.getSession({ headers: request.headers })
  if (!session || !session.user.emailVerified) {
    return { error: Response.json({ message: "გაგრძელებისთვის შედი ანგარიშში." }, { status: 401 }) } as const
  }
  return { session } as const
}
