import Link from "next/link"
import type { ReactNode } from "react"

import { ADMIN_SECTIONS, adminSectionLabels, type AdminSection } from "../../application/admin-console/model"
import { SessionRefresh, SignOutButton } from "../account/account-controls"

type IconName = AdminSection | "arrow" | "search" | "shield" | "activity" | "external"

export function AdminIcon({ name }: { name: IconName }) {
  const common = { width: 18, height: 18, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true }
  switch (name) {
    case "overview": return <svg {...common}><path d="M4 4h6v6H4zM14 4h6v4h-6zM14 12h6v8h-6zM4 14h6v6H4z" /></svg>
    case "customers": return <svg {...common}><path d="M16 20v-1.8a3.8 3.8 0 0 0-3.8-3.8H6.8A3.8 3.8 0 0 0 3 18.2V20M9.5 10.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM16 4.2a3.5 3.5 0 0 1 0 6.6M21 20v-1.8a3.8 3.8 0 0 0-2.8-3.7" /></svg>
    case "interventions": return <svg {...common}><path d="M12 3 2.8 19h18.4L12 3Z" /><path d="M12 9v4M12 17h.01" /></svg>
    case "subscriptions": return <svg {...common}><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 9h18M7 15h3" /></svg>
    case "communication": return <svg {...common}><path d="M21 15a4 4 0 0 1-4 4H8l-5 2V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4Z" /><path d="M8 9h8M8 13h5" /></svg>
    case "audit": return <svg {...common}><path d="M8 3h8M9 3v3m6-3v3M5 6h14v15H5z" /><path d="m9 13 2 2 4-5" /></svg>
    case "arrow": return <svg {...common}><path d="m9 18 6-6-6-6" /></svg>
    case "search": return <svg {...common}><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></svg>
    case "shield": return <svg {...common}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" /><path d="m9 12 2 2 4-4" /></svg>
    case "activity": return <svg {...common}><path d="M3 12h4l2-6 4 12 2-6h6" /></svg>
    case "external": return <svg {...common}><path d="M14 4h6v6M20 4l-9 9" /><path d="M18 13v6a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h6" /></svg>
  }
}

function sectionUrl(section: AdminSection) {
  return section === "overview" ? "/admin" : `/admin/${section}`
}

export function AdminShell({ section, user, interventionCount, children }: {
  section: AdminSection
  user: { name: string; email: string }
  interventionCount: number | null
  children: ReactNode
}) {
  return <div className="admin-shell">
    <a className="admin-skip" href="#admin-main">მთავარ შინაარსზე გადასვლა</a>
    <aside className="admin-sidebar">
      <Link className="admin-logo" href="/admin" aria-label="UNDA Operations მთავარი">
        <span className="admin-logo-mark">u<span>·</span></span>
        <span>UNDA<small>OPERATIONS</small></span>
      </Link>
      <div className="admin-scope"><AdminIcon name="shield" /><span><strong>შიდა კონსოლი</strong><small>მხოლოდ UNDA გუნდისთვის</small></span></div>
      <p className="admin-nav-caption">ოპერაციები</p>
      <nav className="admin-nav" aria-label="ოპერაციების ნავიგაცია">
        {ADMIN_SECTIONS.map((item) => <Link key={item} href={sectionUrl(item)} className={section === item ? "is-active" : ""} aria-current={section === item ? "page" : undefined}>
          <AdminIcon name={item} /><span>{adminSectionLabels[item]}</span>
          {item === "interventions" && interventionCount !== null && interventionCount > 0 ? <em>{interventionCount}</em> : null}
        </Link>)}
      </nav>
      <div className="admin-sidebar-footer">
        <div className="admin-user"><span>{user.name.slice(0, 1).toLocaleUpperCase("ka-GE")}</span><div><strong>{user.name}</strong><small>{user.email}</small></div></div>
        <Link href="/workspace" className="admin-workspace-link">კლიენტის სივრცე <AdminIcon name="external" /></Link>
      </div>
    </aside>
    <div className="admin-content-shell">
      <header className="admin-topbar">
        <div><span className="admin-live-dot" /> <span>Live operational view</span></div>
        <div><span className="admin-read-only">Read only</span><SignOutButton /></div>
      </header>
      <main className="admin-main" id="admin-main"><SessionRefresh />{children}</main>
      <footer className="admin-footer"><span>UNDA Operations</span><span>მონაცემები განახლებულია გვერდის გახსნის მომენტისთვის.</span></footer>
    </div>
  </div>
}
