import { authenticateWorkRequest } from "../../../_server/auth"
import { getDatabasePool } from "../../../_server/database"
import { readVisualJson, visualUuid } from "../../../../application/visuals/input"
import { VisualError } from "../../../../application/visuals/policy"
import { readVisualAsset } from "../../../../infrastructure/postgres/visual-generation-store"
import { ensurePersonalWorkspace } from "../../../../infrastructure/postgres/workspace-store"
import { listPostAssets, mutatePostAsset } from "../../../../infrastructure/postgres/weekly-posts-store"

export const runtime = "nodejs"
export async function POST(request: Request) {
  const auth = await authenticateWorkRequest(request)
  if (auth.error) return auth.error
  try {
    const raw = await readVisualJson(request)
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw Error()
    const b = raw as Record<string, unknown>
    if (!visualUuid(b.generationId) || !visualUuid(b.runId) || typeof b.postKey !== "string" || !/^p([1-9]|10)$/.test(b.postKey) || typeof b.slot !== "number" || !Number.isInteger(b.slot) || b.slot < 0 || b.slot > 5) throw Error()
    const pool = getDatabasePool(); const access = await ensurePersonalWorkspace(pool, auth.session.user.id)
    const image = await readVisualAsset(pool, access, b.generationId)
    if (!image) return Response.json({ message: "გამოსახულება ვერ მოიძებნა." }, { status: 404 })
    await mutatePostAsset(pool, auth.session.user.id, b.runId, b.postKey, b.slot, { ...image, name: `AI-${b.generationId.slice(0, 8)}.webp` })
    return Response.json({ assets: await listPostAssets(pool, auth.session.user.id, b.runId) })
  } catch (e) { return Response.json({ message: e instanceof Error && /[ა-ჰ]/u.test(e.message) ? e.message : "გამოსახულება ვერ მიემაგრა. შედეგი ისტორიაში შენახულია." }, { status: e instanceof VisualError ? e.status : 409 }) }
}
