import Link from "next/link"
import type { ReactNode } from "react"
import type { DashboardBrand, DashboardSection } from "../../application/dashboard/model"
import { SessionRefresh, SignOutButton } from "../account/account-controls"
import { BrandSwitcher } from "./controls"
import { Icon } from "./icons"

export const sectionLabels: Record<DashboardSection, string> = {
  week: "კვირა", content: "კონტენტი", results: "შედეგები", brand: "ბრენდი", connections: "კავშირები", settings: "პარამეტრები",
}
export function sectionUrl(section: DashboardSection) { return section === "week" ? "/workspace" : `/workspace/${section}` }

export function WorkspaceShell({ section, brands, brand, user, children }: {
  section: DashboardSection; brands: DashboardBrand[]; brand: DashboardBrand
  user: { name: string; email: string }; children: ReactNode
}) {
  return <div className="ws-shell">
    <a className="ws-skip" href="#workspace-main">მთავარ შინაარსზე გადასვლა</a>
    <aside className="ws-sidebar">
      <Link className="ws-logo" href="/workspace" aria-label="UNDA Social მთავარი"><span className="ws-logo-mark">u<span>·</span></span><span>UNDA<small>SOCIAL OPERATOR</small></span></Link>
      <BrandSwitcher brands={brands.map(({ id, name }) => ({ id, name }))} active={brand.id} />
      <div className="ws-nav-caption">თქვენი ოპერატორი</div>
      <nav className="ws-nav" aria-label="მთავარი ნავიგაცია">
        {(Object.keys(sectionLabels) as DashboardSection[]).map((item) => <Link className={`${section === item ? "is-active" : ""} ${item === "connections" ? "ws-nav-divider" : ""}`} key={item} href={sectionUrl(item)} aria-current={section === item ? "page" : undefined}><Icon name={item} /><span>{sectionLabels[item]}</span>{section === item ? <span className="ws-nav-dot" /> : null}</Link>)}
      </nav>
      <div className="ws-sidebar-bottom"><div className="ws-sidebar-note"><Icon name="spark" /><p>ბრენდიდან —<br />შემდეგ სწორ ნაბიჯამდე.</p></div><Link className="ws-user" href="/account"><span className="ws-user-avatar">{user.name.slice(0, 1).toLocaleUpperCase("ka-GE")}</span><span><strong>{user.name}</strong><small>ჩემი ანგარიში</small></span><Icon name="chevron" /></Link></div>
    </aside>
    <div className="ws-main-shell">
      <header className="ws-topbar"><div><span>Social Operator</span><Icon name="chevron" /><strong>{sectionLabels[section]}</strong></div><div><span className="ws-private"><Icon name="brand" /> პირადი სივრცე</span><SignOutButton /></div></header>
      <main className="ws-main" id="workspace-main"><SessionRefresh />{children}</main>
      <footer className="ws-footer"><span>UNDA Social Operator</span><span>ნაბიჯ-ნაბიჯ, თქვენი ბრენდისთვის.</span></footer>
    </div>
  </div>
}
