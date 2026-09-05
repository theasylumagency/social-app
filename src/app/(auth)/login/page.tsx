import { redirect } from "next/navigation"
import { currentSession } from "../../_server/auth"
import { availableProviders } from "../../../lib/auth/environment"
import { safeReturnPath } from "../../../lib/auth/policy"
import { AuthForm } from "../auth-form"

export default async function LoginPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams
  const next = safeReturnPath(params.next)
  const initialEmail = typeof params.email === "string" ? params.email : undefined
  if ((await currentSession())?.user.emailVerified) redirect(next)
  return <AuthForm mode="login" next={next} {...availableProviders()} {...(typeof params.error === "string" ? { initialError: params.error } : {})} {...(initialEmail ? { initialEmail } : {})} verified={params.verified === "1"} />
}
