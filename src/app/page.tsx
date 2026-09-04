import { OnboardingForm } from "./onboarding-form"

export default function Home() {
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
        <div className="local-badge">
          <span aria-hidden="true" />
          Local workspace
        </div>
      </header>

      <main id="main" className="main-content">
        <OnboardingForm />
      </main>
    </div>
  )
}
