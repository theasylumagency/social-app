import { socialConnectionHttp } from "../../../../_server/social-connections"

export const runtime = "nodejs"
export async function POST(request: Request, context: { params: Promise<{ platform: string }> }) {
  return socialConnectionHttp.begin(request, (await context.params).platform)
}
