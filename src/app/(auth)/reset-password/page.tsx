import { AuthForm } from "../auth-form"

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams
  return <AuthForm mode="reset" {...(typeof params.token === "string" ? { token: params.token } : {})} {...(typeof params.error === "string" ? { initialError: params.error } : {})} />
}
