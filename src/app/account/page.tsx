import Link from "next/link"
import { headers } from "next/headers"
import { getAuth, requireSession } from "../_server/auth"
import { PasswordControl, RevokeOtherSessions, SessionRefresh, SignOutButton } from "./account-controls"

export const metadata = { title: "ანგარიში — UNDA", robots: { index: false, follow: false } }

export default async function AccountPage() {
  const session = await requireSession("/account")
  const accounts = await getAuth().api.listUserAccounts({ headers: await headers() })
  return <main className="account-shell">
    <SessionRefresh />
    <div className="account-topline"><Link href="/">← სამუშაო სივრცე</Link><SignOutButton /></div>
    <span className="eyebrow">UNDA ანგარიში</span><h1>ანგარიშის პარამეტრები</h1><p className="account-identity">{session.user.name} · {session.user.email}</p>
    <div className="account-card"><PasswordControl email={session.user.email} hasPassword={accounts.some((account) => account.providerId === "credential")} hasGoogle={accounts.some((account) => account.providerId === "google")} /><RevokeOtherSessions /></div>
  </main>
}
