import { after } from "next/server"
import { authenticateWorkRequest } from "../../../_server/auth"
import { getDatabasePool } from "../../../_server/database"
import { assertVisualEnabled, readVisualPolicy, VisualError } from "../../../../application/visuals/policy"
import { parseVisualInput, readVisualJson } from "../../../../application/visuals/input"
import { runVisualGeneration } from "../../../../application/visuals/generate"
import { createPendingVisualGeneration } from "../../../../infrastructure/postgres/visual-generation-store"
import { getVisualCreditBalance } from "../../../../infrastructure/postgres/visual-credit-store"
import { ensurePersonalWorkspace } from "../../../../infrastructure/postgres/workspace-store"

export const runtime = "nodejs"
export const maxDuration = 300
export async function POST(request: Request) {
  const auth = await authenticateWorkRequest(request)
  if (auth.error) return auth.error
  try {
    const input = parseVisualInput(await readVisualJson(request))
    const policy = readVisualPolicy(); assertVisualEnabled(policy, process.env.OPENAI_API_KEY)
    const pool = getDatabasePool(); const access = await ensurePersonalWorkspace(pool, auth.session.user.id)
    const generation = await createPendingVisualGeneration(pool, access, input, policy)
    // Durable queue is also drained by worker:operator if this process stops.
    if (generation.status === "pending") after(() => runVisualGeneration(pool, generation.id))
    return Response.json({ generation, ...await getVisualCreditBalance(pool, access) }, { status: generation.status === "pending" ? 202 : 200, headers: { "cache-control": "private, no-store" } })
  } catch (e) {
    return Response.json({ message: e instanceof VisualError ? e.message : "გენერაციის დაწყება ვერ მოხერხდა. ხელახლა ცდა უსაფრთხოა.", code: e instanceof VisualError ? e.code : "unavailable" }, { status: e instanceof VisualError ? e.status : 503 })
  }
}
