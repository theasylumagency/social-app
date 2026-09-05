export function authOrigin(env: NodeJS.ProcessEnv = process.env): string {
  const value = env.BETTER_AUTH_URL || (env.NODE_ENV === "production" ? "" : "http://localhost:3000")
  if (!value) throw new Error("BETTER_AUTH_URL is required")
  const url = new URL(value)
  if (url.username || url.password || url.pathname !== "/" || url.search || url.hash || (url.protocol !== "https:" && !(env.NODE_ENV !== "production" && url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname)))) {
    throw new Error("BETTER_AUTH_URL must be an HTTPS origin (localhost HTTP is allowed in development)")
  }
  return url.origin
}

export function socialProviders(env: NodeJS.ProcessEnv = process.env) {
  return {
    ...(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET ? {
      google: { clientId: env.GOOGLE_CLIENT_ID, clientSecret: env.GOOGLE_CLIENT_SECRET, prompt: "select_account" as const, requireEmailVerification: true },
    } : {}),
    ...(env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET ? {
      github: { clientId: env.GITHUB_CLIENT_ID, clientSecret: env.GITHUB_CLIENT_SECRET, requireEmailVerification: true },
    } : {}),
  }
}

export function availableProviders() {
  const providers = socialProviders()
  return { google: Boolean(providers.google), github: Boolean(providers.github) }
}
