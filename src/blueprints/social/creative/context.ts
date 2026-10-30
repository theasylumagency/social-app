import type { BrandDossier } from "../brand-discovery/model"
import type { CreativeInput } from "./model"
import type { PostChannel } from "../weekly-planning/posts"

/** Explicit allowlist. This can run directly after discovery without any weekly strategy. */
export function compileCreativeInput(basis: BrandDossier, platforms: PostChannel[]): CreativeInput {
  const understanding = basis.payload.understanding
  if (!understanding || !basis.payload.landscape) throw Error("Brand discovery is required for creative exploration")
  const audiences = basis.payload.landscape.entries.filter(e => e.influence !== "none").map(entry => ({
    name: entry.audience.name,
    situation: entry.source === "operator" ? entry.audience.buyingSituation : entry.audience.description,
  }))
  if (!audiences.length || !platforms.length) throw Error("An audience and platform are required for creative exploration")
  return { business: understanding.summary, audiences, platforms: [...new Set(platforms)] }
}
