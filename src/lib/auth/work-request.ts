/** Shared work-route guard; the server supplies the existing Better Auth session reader. */
export function createWorkRequestAuthenticator<T extends { user: { id: string; emailVerified: boolean } }>(deps: {
  origin(): string
  isDevelopment(): boolean
  session(request: Request): Promise<T | null>
}) {
  return async (request: Request) => {
    const origin = request.headers.get("origin")
    const isAllowedDevOrigin = deps.isDevelopment() && (origin === "http://localhost:3000" || origin === "http://127.0.0.1:3000")
    if (origin !== deps.origin() && !isAllowedDevOrigin) {
      return { error: Response.json({ message: "მოთხოვნა დაუშვებელია." }, { status: 403 }) } as const
    }
    const session = await deps.session(request)
    if (!session || !session.user.emailVerified) {
      return { error: Response.json({ message: "გაგრძელებისთვის შედი ანგარიშში." }, { status: 401 }) } as const
    }
    return { session } as const
  }
}
