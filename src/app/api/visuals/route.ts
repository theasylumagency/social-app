import { currentSession, subscriptionRequired } from "../../_server/auth"
import { getDatabasePool } from "../../_server/database"
import { readVisualPolicy, VisualError } from "../../../application/visuals/policy"
import { visualUuid } from "../../../application/visuals/input"
import { expireVisualGenerations, listVisualGenerationsForWorkspace } from "../../../infrastructure/postgres/visual-generation-store"
import { getVisualCreditBalance, seedDemoCreditsIfNeeded } from "../../../infrastructure/postgres/visual-credit-store"
import { ensurePersonalWorkspace } from "../../../infrastructure/postgres/workspace-store"

export const runtime = "nodejs"
export async function GET(request: Request) {
  const session = await currentSession()
  if (!session?.user.emailVerified) return Response.json({ message: "შედით ანგარიშში." }, { status: 401 })
  const billing = await subscriptionRequired(session.user.id); if (billing) return billing
  try {
    const query = new URL(request.url).searchParams; const id = query.get("id"); const runId = query.get("runId")
    if ((id && !visualUuid(id)) || (runId && !visualUuid(runId))) throw new VisualError("invalid_input", "მისამართი არასწორია.", 400)
    const pool = getDatabasePool(); const access = await ensurePersonalWorkspace(pool, session.user.id)
    const policy = readVisualPolicy()
    await expireVisualGenerations(pool)
    await seedDemoCreditsIfNeeded(pool, access, policy)
    const [generations, balance] = await Promise.all([listVisualGenerationsForWorkspace(pool, access, { ...(id ? { id } : {}), ...(runId ? { runId } : {}) }), getVisualCreditBalance(pool, access)])
    const enabled = policy.enabled && !!process.env.OPENAI_API_KEY?.trim()
    return Response.json({ generations, ...balance, enabled, mode: policy.mode, message: enabled ? null : "გამოსახულების სერვისი დროებით მიუწვდომელია." }, { headers: { "cache-control": "private, no-store" } })
  } catch (e) { return Response.json({ message: e instanceof VisualError ? e.message : "ვიზუალების ჩატვირთვა ვერ მოხერხდა." }, { status: e instanceof VisualError ? e.status : 503 }) }
}
