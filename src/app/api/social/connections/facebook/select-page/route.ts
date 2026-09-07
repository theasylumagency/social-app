import { socialConnectionHttp } from "../../../../../_server/social-connections"

export const runtime = "nodejs"
export async function POST(request: Request) { return socialConnectionHttp.select(request) }
