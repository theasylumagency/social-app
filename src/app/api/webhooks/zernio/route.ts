import { receiveZernioWebhook } from "../../../_server/social-delivery"

export const runtime = "nodejs"
export async function POST(request: Request) { return receiveZernioWebhook(request) }
