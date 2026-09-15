import "server-only"

import { notFound, redirect } from "next/navigation"
import { isInternalAdminEmail } from "../../lib/auth/internal-admin"
import { currentSession } from "./auth"

export async function requireInternalAdmin(returnTo = "/admin") {
  const session = await currentSession()
  if (!session || !session.user.emailVerified) redirect(`/login?next=${encodeURIComponent(returnTo)}`)
  if (!isInternalAdminEmail(session.user.email)) notFound()
  return session
}
