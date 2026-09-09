import "server-only"
import { getDatabasePool } from "./database"
import { PostgresSocialWebhookStore } from "../../infrastructure/postgres/social-webhook-store"
import { readZernioEnvironment } from "../../infrastructure/zernio/environment"
import { createZernioWebhookHttp } from "../../infrastructure/zernio/webhooks"

export async function receiveZernioWebhook(request: Request) {
  const secret = readZernioEnvironment().webhookSecret
  if (!secret) return new Response(null, { status: 503 })
  return createZernioWebhookHttp({ secret, store: new PostgresSocialWebhookStore(getDatabasePool()) })(request)
}
