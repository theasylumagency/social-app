import { OnboardingForm } from "./onboarding-form"
import Link from "next/link"
import { requireSession } from "./_server/auth"
import { getDatabasePool } from "./_server/database"
import { ensurePersonalWorkspace } from "../infrastructure/postgres/workspace-store"
import { SessionRefresh, SignOutButton } from "./account/account-controls"

export default async function Home() {
  const session = await requireSession()
  await ensurePersonalWorkspace(getDatabasePool(), session.user.id)
  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand-mark" href="#main" aria-label="UNDA მთავარი">
          <span className="brand-symbol" aria-hidden="true">U</span>
          <span>UNDA</span>
        </a>
        <div className="topbar-center" aria-label="მიმდინარე ეტაპი">
          <span className="topbar-label">Brand setup</span>
          <span className="progress-track" aria-hidden="true">
            <span />
          </span>
          <span className="progress-copy">1 / 4</span>
        </div>
        <div className="account-menu">
          <Link href="/account">ჩემი ანგარიში</Link>
          <SignOutButton />
        </div>
      </header>

      <main id="main" className="main-content">
        <SessionRefresh />
        <OnboardingForm />
      </main>
    </div>
  )
}
