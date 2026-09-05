"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState, type FormEvent } from "react"
import { authClient } from "../../lib/auth/client"
import { authErrorMessage, PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from "../../lib/auth/policy"

type Mode = "login" | "register" | "forgot" | "reset"
type Props = {
  mode: Mode
  next?: string
  google?: boolean
  github?: boolean
  token?: string
  initialError?: string
  verified?: boolean
}

const copy: Record<Mode, { title: string; intro: string; action: string }> = {
  login: { title: "კეთილი დაბრუნება", intro: "შედი ანგარიშში და გააგრძელე შენს ბრენდთან მუშაობა.", action: "შესვლა" },
  register: { title: "დაიწყე UNDA-სთან ერთად", intro: "შექმენი ანგარიში. საცდელი 14 დღე პირველი ბრენდის გამართვის შემდეგ დაიწყება.", action: "ანგარიშის შექმნა" },
  forgot: { title: "პაროლის აღდგენა", intro: "მოგწერთ ბმულს, რომლითაც ახალ პაროლს დააყენებ.", action: "ბმულის გამოგზავნა" },
  reset: { title: "დააყენე ახალი პაროლი", intro: "ეს პაროლი იმავე UNDA ანგარიშში შესასვლელად გამოგადგება.", action: "პაროლის შენახვა" },
}

export function AuthForm({ mode, next = "/", google = false, github = false, token, initialError, verified }: Props) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(initialError ? authErrorMessage(initialError) : "")
  const [success, setSuccess] = useState("")
  const [rememberMe, setRememberMe] = useState(false)
  const [visible, setVisible] = useState(false)
  const [email, setEmail] = useState("")
  const [needsVerification, setNeedsVerification] = useState(false)
  const isEntry = mode === "login" || mode === "register"
  const hasPassword = isEntry || mode === "reset"
  const invalidReset = mode === "reset" && (!token || Boolean(initialError))
  const details = copy[mode]
  const verificationCallback = `/login?verified=1&next=${encodeURIComponent(next)}`

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const values = new FormData(event.currentTarget)
    const password = String(values.get("password") || "")
    if (mode === "reset" && password !== values.get("confirmPassword")) {
      setError("პაროლები ერთმანეთს არ ემთხვევა.")
      return
    }
    setBusy(true)
    setError("")
    setSuccess("")
    try {
      if (mode === "login") {
        const result = await authClient.signIn.email({ email: email.trim(), password, rememberMe })
        if (result.error) {
          setNeedsVerification(result.error.code === "EMAIL_NOT_VERIFIED")
          setError(authErrorMessage(result.error.status === 429 ? "TOO_MANY_REQUESTS" : result.error.code))
        } else { router.replace(next); router.refresh() }
      } else if (mode === "register") {
        const result = await authClient.signUp.email({ name: String(values.get("name") || "").trim(), email: email.trim(), password, callbackURL: verificationCallback })
        if (result.error) setError(authErrorMessage(result.error.status === 429 ? "TOO_MANY_REQUESTS" : result.error.code))
        else {
          setSuccess("შეამოწმე ელფოსტა. ანგარიშის გასააქტიურებლად გახსენი დადასტურების ბმული, შემდეგ შედი ანგარიშში.")
          setNeedsVerification(true)
        }
      } else if (mode === "forgot") {
        const result = await authClient.requestPasswordReset({ email: email.trim(), redirectTo: "/reset-password" })
        if (result.error) setError(authErrorMessage(result.error.status === 429 ? "TOO_MANY_REQUESTS" : result.error.code))
        else setSuccess("თუ ამ ელფოსტაზე ანგარიში არსებობს, პაროლის დაყენების ბმულს მიიღებ. შეამოწმე სპამის საქაღალდეც.")
      } else if (token) {
        const result = await authClient.resetPassword({ newPassword: password, token })
        if (result.error) setError(authErrorMessage(result.error.code))
        else setSuccess("პაროლი შენახულია. უსაფრთხოებისთვის წინა სესიები დასრულდა. შედი ახალი პაროლით ან Google-ით.")
      }
    } catch {
      setError("სერვერთან დაკავშირება ვერ მოხერხდა. სცადე ხელახლა.")
    } finally { setBusy(false) }
  }

  async function social(provider: "google" | "github") {
    setBusy(true)
    setError("")
    try {
      const result = await authClient.signIn.social({ provider, callbackURL: next, errorCallbackURL: `/login?next=${encodeURIComponent(next)}`, additionalData: { rememberMe } })
      if (result.error) { setError(authErrorMessage(result.error.code)); setBusy(false) }
    } catch { setError("შესვლა ვერ დაიწყო. სცადე ხელახლა."); setBusy(false) }
  }

  async function resend() {
    setBusy(true)
    setError("")
    try {
      const result = await authClient.sendVerificationEmail({ email: email.trim(), callbackURL: verificationCallback })
      if (result.error) setError(authErrorMessage(result.error.status === 429 ? "TOO_MANY_REQUESTS" : result.error.code))
      else setSuccess("თუ ელფოსტას დადასტურება სჭირდება, ახალ ბმულს მიიღებ. შეამოწმე მიღებული წერილები.")
    } catch { setError("წერილის მოთხოვნა ვერ დასრულდა. სცადე ხელახლა.") }
    finally { setBusy(false) }
  }

  return (
    <div className="auth-card">
      <span className="eyebrow">UNDA ანგარიში</span>
      <h2>{details.title}</h2>
      <p className="auth-intro">{details.intro}</p>
      {verified && !error ? <p className="auth-message success" role="status">ელფოსტა დადასტურებულია. ახლა შეგიძლია შეხვიდე.</p> : null}
      {error ? <p className="auth-message error" role="alert">{error}</p> : null}
      {success ? <p className="auth-message success" role="status">{success}</p> : null}

      {isEntry && !success ? <>
        <div className="auth-providers">
          <button className="auth-provider" type="button" disabled={!google || busy} onClick={() => social("google")}><span className="google-letter" aria-hidden="true">G</span>Google-ით გაგრძელება</button>
          {!google ? <p className="auth-helper">Google-ით შესვლა ჯერ მიუწვდომელია.</p> : null}
          {github ? <button className="auth-provider" type="button" disabled={busy} onClick={() => social("github")}>GitHub-ით გაგრძელება</button> : null}
        </div>
        <label className="auth-remember"><input type="checkbox" checked={rememberMe} onChange={(event) => setRememberMe(event.target.checked)} disabled={busy} /><span>დამიმახსოვრე ამ მოწყობილობაზე<small>30 დღე · მხოლოდ პირად მოწყობილობაზე</small></span></label>
        <div className="auth-divider"><span>ან ელფოსტით</span></div>
      </> : null}

      {!success && !invalidReset ? <form className="auth-form" onSubmit={submit} aria-busy={busy}>
        {mode === "register" ? <label htmlFor="name">შენი სახელი<input id="name" name="name" autoComplete="name" required minLength={2} maxLength={80} disabled={busy} /></label> : null}
        {mode !== "reset" ? <label htmlFor="email">ელფოსტა<input id="email" name="email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required maxLength={254} disabled={busy} /></label> : null}
        {hasPassword ? <label htmlFor="password">პაროლი<div className="auth-password"><input id="password" name="password" type={visible ? "text" : "password"} autoComplete={mode === "login" ? "current-password" : "new-password"} required minLength={mode === "login" ? 1 : PASSWORD_MIN_LENGTH} maxLength={PASSWORD_MAX_LENGTH} disabled={busy} aria-describedby={mode !== "login" ? "password-hint" : undefined} /><button type="button" onClick={() => setVisible(!visible)} aria-label={visible ? "პაროლის დამალვა" : "პაროლის ჩვენება"} aria-pressed={visible}>{visible ? "დამალვა" : "ჩვენება"}</button></div>{mode !== "login" ? <small id="password-hint">სულ მცირე {PASSWORD_MIN_LENGTH} სიმბოლო. შეგიძლია გამოიყენო გრძელი ფრაზა.</small> : null}</label> : null}
        {mode === "reset" ? <label htmlFor="confirmPassword">გაიმეორე პაროლი<input id="confirmPassword" name="confirmPassword" type={visible ? "text" : "password"} autoComplete="new-password" required maxLength={PASSWORD_MAX_LENGTH} disabled={busy} /></label> : null}
        {mode === "login" ? <Link className="auth-forgot" href="/forgot-password">პაროლი დაგავიწყდა?</Link> : null}
        <button className="auth-primary" type="submit" disabled={busy}>{busy ? "მიმდინარეობს…" : details.action}</button>
      </form> : null}
      {needsVerification && email ? <button className="auth-text-button" type="button" onClick={resend} disabled={busy}>დადასტურების წერილის ხელახლა გამოგზავნა</button> : null}
      {invalidReset ? <Link className="auth-primary auth-button-link" href="/forgot-password">ახალი ბმულის მოთხოვნა</Link> : null}
      <p className="auth-switch">{mode === "login" ? <>ჯერ არ გაქვს ანგარიში? <Link href={`/register?next=${encodeURIComponent(next)}`}>რეგისტრაცია</Link></> : <>უკვე გაქვს ანგარიში? <Link href={`/login?next=${encodeURIComponent(next)}`}>შესვლა</Link></>}</p>
    </div>
  )
}
