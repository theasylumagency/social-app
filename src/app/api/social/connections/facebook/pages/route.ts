import { socialConnectionHttp } from "../../../../../_server/social-connections"

export const runtime = "nodejs"
export async function GET(request: Request) { return socialConnectionHttp.pages(request) }
