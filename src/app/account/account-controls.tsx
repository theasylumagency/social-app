"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { authClient } from "../../lib/auth/client"
import { authErrorMessage } from "../../lib/auth/policy"

export function SessionRefresh() {
  // The client session endpoint can refresh HttpOnly cookies; RSC reads cannot.
  const { data, isPending, error } = authClient.useSession()
  if (isPending || data || error) return null
  return <p className="auth-message error" role="status">სესია დასრულდა. <Link href="/login">ხელახლა შესვლა</Link></p>
}

export function SignOutButton() {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  return <div className="sign-out-control"><button className="auth-text-button" disabled={busy} onClick={async () => {
    setBusy(true)
    setError("")
    try {
      const result = await authClient.signOut()
      if (result.error) setError("გამოსვლა ვერ დასრულდა.")
      else { router.replace("/login"); router.refresh() }
    } catch { setError("გამოსვლა ვერ დასრულდა. სცადე ხელახლა.") }
    finally { setBusy(false) }
  }}>{busy ? "მიმდინარეობს…" : "გამოსვლა"}</button>{error ? <span role="alert">{error}</span> : null}</div>
}

export function PasswordControl({ email, hasPassword, hasGoogle }: { email: string; hasPassword: boolean; hasGoogle: boolean }) {
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")
  return <section className="account-section">
    <div><h2>{hasPassword ? "პაროლის შეცვლა" : "პაროლის დამატება"}</h2><p>{hasPassword ? "ახალი პაროლის დასაყენებლად დადასტურების ბმულს გამოგიგზავნით." : "დაამატე პაროლი და იმავე ანგარიშში ელფოსტითაც შედი."}</p><p className="auth-helper">ბმული გაიგზავნება {email}-ზე.{hasGoogle ? " Google-ით შესვლა ხელმისაწვდომი დარჩება." : ""}</p></div>
    <button className="auth-primary" disabled={busy} onClick={async () => {
      setBusy(true); setError("")
      try {
        const result = await authClient.requestPasswordReset({ email, redirectTo: "/reset-password" })
        if (result.error) setError(authErrorMessage(result.error.status === 429 ? "TOO_MANY_REQUESTS" : result.error.code))
        else setMessage("შეამოწმე ელფოსტა. ბმული მოქმედებს 30 წუთი. პაროლის შენახვის შემდეგ თავიდან შესვლა დაგჭირდება.")
      } catch { setError("წერილის მოთხოვნა ვერ დასრულდა. სცადე ხელახლა.") }
      finally { setBusy(false) }
    }}>{busy ? "მიმდინარეობს…" : "დადასტურების ბმულის გამოგზავნა"}</button>
    {message ? <p className="auth-message success" role="status">{message}</p> : null}{error ? <p className="auth-message error" role="alert">{error}</p> : null}
  </section>
}

export function RevokeOtherSessions() {
  const [message, setMessage] = useState("")
  const [busy, setBusy] = useState(false)
  return <section className="account-section"><div><h2>შესული მოწყობილობები</h2><p>დაასრულე ყველა სხვა მოწყობილობის სესია. ამ მოწყობილობაზე შესული დარჩები.</p></div><button className="auth-provider" disabled={busy} onClick={async () => {
    setBusy(true)
    try {
      const result = await authClient.revokeOtherSessions()
      setMessage(result.error ? authErrorMessage(result.error.code) : "სხვა მოწყობილობებზე სესიები დასრულებულია.")
    } catch { setMessage("მოქმედება ვერ დასრულდა. სცადე ხელახლა.") }
    finally { setBusy(false) }
  }}>{busy ? "მიმდინარეობს…" : "სხვა მოწყობილობებიდან გამოსვლა"}</button>{message ? <p role="status">{message}</p> : null}</section>
}
