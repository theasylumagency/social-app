import { redirect } from "next/navigation"
import { currentSession } from "../../_server/auth"
import { availableProviders } from "../../../lib/auth/environment"
import { safeReturnPath } from "../../../lib/auth/policy"
import { AuthForm } from "../auth-form"

export default async function RegisterPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const next = safeReturnPath((await searchParams).next)
  if ((await currentSession())?.user.emailVerified) redirect(next)
  return <AuthForm mode="register" next={next} {...availableProviders()} />
}
