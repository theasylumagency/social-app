import { currentSession, subscriptionRequired } from "../../../_server/auth"
import { getDatabasePool } from "../../../_server/database"
import { visualUuid } from "../../../../application/visuals/input"
import { readVisualAsset } from "../../../../infrastructure/postgres/visual-generation-store"
import { ensurePersonalWorkspace } from "../../../../infrastructure/postgres/workspace-store"

export const runtime = "nodejs"
export async function GET(request: Request) {
  const session = await currentSession()
  if (!session?.user.emailVerified) return new Response(null, { status: 401 })
  const billing = await subscriptionRequired(session.user.id); if (billing) return billing
  const id = new URL(request.url).searchParams.get("id")
  if (!visualUuid(id)) return new Response(null, { status: 404 })
  const pool = getDatabasePool(); const access = await ensurePersonalWorkspace(pool, session.user.id)
  const asset = await readVisualAsset(pool, access, id)
  if (!asset) return new Response(null, { status: 404 })
  return new Response(new Uint8Array(asset.content), { headers: { "content-type": "image/webp", "cache-control": "private, no-store", "x-content-type-options": "nosniff", "content-disposition": "inline" } })
}
