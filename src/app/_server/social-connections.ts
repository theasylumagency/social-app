import "server-only"
import { hasSubscription } from "../../infrastructure/postgres/subscription-store"
import { authOrigin } from "../../lib/auth/environment"
import { SocialConnectionService } from "../../application/social-connections/service"
import { SocialProviderRegistry } from "../../application/social-connections/provider-registry"
import { PostgresSocialConnectionFlowStore } from "../../infrastructure/postgres/social-connection-flow-store"
import { createZernioClient } from "../../infrastructure/zernio/client"
import { createZernioConnectionProvider } from "../../infrastructure/zernio/connect"
import { createConnectionContextCipher } from "../../infrastructure/zernio/connection-context"
import { readZernioEnvironment } from "../../infrastructure/zernio/environment"
import { createSocialConnectionHttp } from "../../infrastructure/web/social-connection-http"
import { authenticateWorkRequest, getAuth } from "./auth"
import { getDatabasePool } from "./database"
import { rememberBrand } from "./active-brand"

export function socialConnectionsAvailable() {
  try { const env = readZernioEnvironment(); return Boolean(env.apiKey && env.connectionContextKey) } catch { return false }
}
function service() {
  const env = readZernioEnvironment()
  if (!env.apiKey || !env.connectionContextKey) throw new Error("Social connections are not configured")
  return new SocialConnectionService(new PostgresSocialConnectionFlowStore(getDatabasePool()),
    new SocialProviderRegistry([["zernio", createZernioConnectionProvider(createZernioClient(env), env.applicationOrigin)]]),
    createConnectionContextCipher(env.connectionContextKey), env.applicationOrigin)
}
export const socialConnectionHttp = createSocialConnectionHttp({ authenticate: authenticateWorkRequest,
  session: async (request) => { const session = await getAuth().api.getSession({ headers: request.headers }); return session && await hasSubscription(getDatabasePool(), session.user.id) ? session : null }, service, origin: authOrigin, rememberBrand })
