import { betterAuth, type BetterAuthOptions } from "better-auth"
import { createAuthMiddleware, getOAuthState } from "better-auth/api"
import { expireCookie, setSessionCookie } from "better-auth/cookies"
import type { Pool } from "pg"
import type { SendAuthEmail } from "./email"
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH, REMEMBERED_SESSION_SECONDS, TEMPORARY_SESSION_SECONDS } from "./policy"

type AuthConfiguration = {
  pool: Pool
  origin: string
  secret: string
  providers: BetterAuthOptions["socialProviders"]
  sendEmail: SendAuthEmail
}

export function createAuth({ pool, origin, secret, providers, sendEmail }: AuthConfiguration) {
  if (secret.length < 32) throw new Error("BETTER_AUTH_SECRET must contain at least 32 characters")
  return betterAuth({
    appName: "UNDA",
    baseURL: origin,
    secret,
    database: pool,
    trustedOrigins: [origin],
    user: { modelName: "auth_user" },
    session: {
      modelName: "auth_session",
      expiresIn: REMEMBERED_SESSION_SECONDS,
      updateAge: 60 * 60 * 24,
      freshAge: 60 * 10,
      cookieCache: { enabled: false },
    },
    account: {
      modelName: "auth_account",
      encryptOAuthTokens: true,
      accountLinking: { enabled: true, requireLocalEmailVerified: true, allowDifferentEmails: false, trustedProviders: [] },
    },
    verification: { modelName: "auth_verification" },
    socialProviders: providers ?? {},
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: true,
      minPasswordLength: PASSWORD_MIN_LENGTH,
      maxPasswordLength: PASSWORD_MAX_LENGTH,
      revokeSessionsOnPasswordReset: true,
      resetPasswordTokenExpiresIn: 60 * 30,
      sendResetPassword: async ({ user, url }) => sendEmail({
        to: user.email,
        subject: "UNDA — პაროლის დაყენება",
        text: `პაროლის დასაყენებლად ან შესაცვლელად გახსენი ბმული:\n\n${url}\n\nბმული მოქმედებს 30 წუთი და გამოიყენება ერთხელ. თუ ეს შენ არ მოგითხოვია, უგულებელყავი წერილი.`,
      }),
    },
    emailVerification: {
      sendOnSignUp: true,
      sendOnSignIn: true,
      autoSignInAfterVerification: false,
      expiresIn: 60 * 60,
      sendVerificationEmail: async ({ user, url }) => sendEmail({
        to: user.email,
        subject: "UNDA — დაადასტურე ელფოსტა",
        text: `UNDA ანგარიშის გასააქტიურებლად დაადასტურე ელფოსტა:\n\n${url}\n\nბმული მოქმედებს ერთი საათი. თუ ანგარიში შენ არ შეგიქმნია, უგულებელყავი წერილი.`,
      }),
    },
    rateLimit: {
      enabled: true,
      storage: "database",
      modelName: "auth_rate_limit",
      window: 60,
      max: 100,
      customRules: {
        "/sign-in/email": { window: 60, max: 5 },
        "/sign-up/email": { window: 60, max: 3 },
        "/request-password-reset": { window: 60, max: 3 },
        "/send-verification-email": { window: 60, max: 3 },
      },
    },
    advanced: { cookiePrefix: "unda", useSecureCookies: origin.startsWith("https://") },
    hooks: {
      after: createAuthMiddleware(async (ctx) => {
        if (!ctx.context.newSession) return
        if (ctx.path === "/sign-in/email" && ctx.body?.rememberMe === true) {
          expireCookie(ctx, ctx.context.authCookies.dontRememberToken)
          return
        }
        if (ctx.path !== "/sign-in/social" && !ctx.path.startsWith("/callback/")) return
        // Read the preference from validated OAuth state, so simultaneous login
        // flows cannot overwrite each other's choice in a browser-wide cookie.
        const state = await getOAuthState<{ rememberMe?: boolean }>()
        const rememberMe = ctx.path === "/sign-in/social" ? ctx.body?.additionalData?.rememberMe === true : state?.rememberMe === true
        const headers = ctx.context.responseHeaders
        const name = ctx.context.authCookies.sessionToken.name
        if (headers) {
          const remaining = headers.getSetCookie().filter((cookie) => !cookie.startsWith(`${name}=`))
          headers.delete("set-cookie")
          for (const cookie of remaining) headers.append("set-cookie", cookie)
        }
        if (rememberMe) expireCookie(ctx, ctx.context.authCookies.dontRememberToken)
        await setSessionCookie(ctx, ctx.context.newSession, !rememberMe)
      }),
    },
    databaseHooks: {
      session: {
        create: {
          before: async (session, ctx) => {
            if (!ctx || (ctx.path !== "/sign-in/social" && !ctx.path.startsWith("/callback/"))) return
            const state = await getOAuthState<{ rememberMe?: boolean }>()
            const rememberMe = ctx.path === "/sign-in/social" ? ctx.body?.additionalData?.rememberMe === true : state?.rememberMe === true
            if (!rememberMe) {
              return { data: { ...session, expiresAt: new Date(Date.now() + TEMPORARY_SESSION_SECONDS * 1_000) } }
            }
          },
        },
      },
    },
  })
}
