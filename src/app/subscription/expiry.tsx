"use client"
import { useEffect } from "react"
import { useRouter } from "next/navigation"

/** Revalidate on expiry/focus; server state decides whether a concurrent renewal succeeded. */
export function SubscriptionExpiry({ expiresAt }: { expiresAt: string }) {
  const router = useRouter()
  useEffect(() => {
    const check = () => { if (Date.now() >= Date.parse(expiresAt)) router.refresh() }
    const timer = setInterval(check, 60000)
    window.addEventListener("focus", check)
    return () => { clearInterval(timer); window.removeEventListener("focus", check) }
  }, [expiresAt, router])
  return null
}
