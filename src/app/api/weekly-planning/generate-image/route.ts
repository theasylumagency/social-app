import { authenticateWorkRequest } from "../../../_server/auth"
import { IMAGE_GENERATION_POLICY } from "../../../../blueprints/social/weekly-planning/posts"

export async function POST(request: Request) {
  const access = await authenticateWorkRequest(request)
  if (access.error) return access.error
  // Future integration must enforce paid entitlement, quotas and idempotency here.
  // This hard stop deliberately has no image provider import or network call.
  return Response.json({ ...IMAGE_GENERATION_POLICY, message: "გამოსახულების გენერაცია ტესტირებისას გამორთულია." }, { status: 409 })
}
