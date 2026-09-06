import Link from "next/link"
import { notFound } from "next/navigation"
import { DiscoveryClient } from "../discovery-client"
import { requireSession } from "../_server/auth"
import { getDatabasePool } from "../_server/database"
import { ensurePersonalWorkspace } from "../../infrastructure/postgres/workspace-store"
import { listDashboardBrands } from "../../infrastructure/postgres/dashboard-store"
import { readDiscovery } from "../../infrastructure/postgres/brand-discovery-store"
import { knowledgeText, knowledgeList } from "../../application/dashboard/model"
import { publicDiscoveryPayload, type DiscoveryInput } from "../../blueprints/social/brand-discovery/model"
import { SessionRefresh, SignOutButton } from "../account/account-controls"
import "../discovery.css"

export const metadata = { title: "ბრენდის გაცნობა — UNDA", robots: { index: false, follow: false } }

export default async function OnboardingPage({ searchParams }: { searchParams: Promise<{ brand?: string }> }) {
  const auth = await requireSession("/onboarding")
  const { brand: brandId } = await searchParams
  const pool = getDatabasePool()
  await ensurePersonalWorkspace(pool, auth.user.id)
  const brands = brandId ? await listDashboardBrands(pool, auth.user.id) : []
  const brand = brands.find((item) => item.id === brandId)
  if (brandId && !brand) notFound()
  const session = await readDiscovery(pool, auth.user.id, undefined, brandId ?? null)
  const website = brand ? knowledgeText(brand.knowledge, "identityWebsite") : ""
  const initialInput: DiscoveryInput = {
    website,
    notes: brand && !website ? `${brand.name}\n${knowledgeText(brand.knowledge, "identityShortDescription")}` : "",
    language: brand && knowledgeList(brand.knowledge, "identityLanguages").includes("en") ? "en" : "ka",
  }
  return <div className="bd-shell">
    <header className="bd-topbar"><Link className="brand-mark" href="/workspace" aria-label="UNDA მთავარი"><span className="brand-symbol" aria-hidden="true">U</span><span>UNDA</span></Link><div className="account-menu"><Link href="/workspace">სამუშაო სივრცე</Link><Link href="/account">ჩემი ანგარიში</Link><SignOutButton /></div></header>
    <main id="main" className="bd-main"><SessionRefresh /><DiscoveryClient initialSession={session ? { ...session, payload: publicDiscoveryPayload(session.payload) } : null} initialInput={initialInput} brandId={brandId ?? null} ownerId={auth.user.id} /></main>
  </div>
}
