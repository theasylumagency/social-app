import type { BrandDossier } from "../../blueprints/social/brand-discovery/model"
import type { ReconSource } from "../../blueprints/social/strategy/model"
import { inspectPublicPage } from "../../infrastructure/web/website-discovery"

export function socialChannel(url: string) {
  try { const host = new URL(url).hostname; return ["facebook", "instagram", "linkedin", "tiktok", "youtube"].find((c) => host === `${c}.com` || host.endsWith(`.${c}.com`)) ?? null } catch { return null }
}
export async function inspectSocialPresence(basis: BrandDossier, knownUrls: string[], inspect = inspectPublicPage): Promise<ReconSource[]> {
  const urls = new Set([...knownUrls, ...basis.payload.sources.flatMap((s) => s.url ? [s.url] : []), ...(basis.payload.input.notes.match(/https:\/\/[^\s<>"']+/g) ?? [])])
  const website = basis.payload.input.website
  if (website && !socialChannel(website)) {
    try { const page = await inspect(website); for (const url of page.socialLinks) urls.add(url) } catch { /* Failure means unknown, never absence. */ }
  }
  const channels = [...new Set(["facebook", "instagram", ...[...urls].map(socialChannel).filter((c): c is string => !!c)])].slice(0, 5)
  return Promise.all(channels.map(async (channel): Promise<ReconSource> => {
    const url = [...urls].find((url) => socialChannel(url) === channel) ?? null
    const capturedAt = new Date().toISOString()
    if (!url) return { channel, url, capturedAt, text: "", availability: "unknown" }
    try {
      const page = await inspect(url)
      // Authentication pages and cross-channel redirects cannot establish the account state.
      const usable = socialChannel(page.url) === channel && page.text.length > 100 && !/log in to continue|you must log in|login required/i.test(page.text)
      return { channel, url, capturedAt, text: usable ? page.text : "", availability: usable ? "accessible" : "unknown" }
    } catch { return { channel, url, capturedAt, text: "", availability: "unknown" } }
  }))
}
