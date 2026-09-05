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
        html: `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 24px; color: #111; line-height: 1.6;">
          <h2 style="font-size: 22px; font-weight: 700; margin-bottom: 16px; color: #111;">პაროლის დაყენება ან შეცვლა</h2>
          <p style="font-size: 15px; margin-bottom: 16px;">გამარჯობა,</p>
          <p style="font-size: 15px; margin-bottom: 24px;">შენი UNDA ანგარიშისთვის ახალი პაროლის დასაყენებლად ან შესაცვლელად დააჭირე ქვემოთ მოცემულ ღილაკს:</p>
          <p style="margin-bottom: 24px;">
            <a href="${url}" style="display: inline-block; background-color: #000; color: #fff; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-size: 15px; font-weight: 600;">პაროლის დაყენება</a>
          </p>
          <p style="font-size: 13px; color: #555; margin-bottom: 8px;">ბმული მოქმედებს 30 წუთი და გამოიყენება მხოლოდ ერთხელ.</p>
          <p style="font-size: 13px; color: #555;">თუ ეს მოქმედება შენ არ მოგითხოვია, შეგიძლია უგულებელყო ეს წერილი.</p>
          <hr style="border: none; border-top: 1px solid #eaeaea; margin: 32px 0 16px;" />
          <p style="font-size: 12px; color: #888;">UNDA Social Operator · <a href="${origin}" style="color: #888; text-decoration: underline;">${origin}</a></p>
        </div>`,
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
        html: `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 24px; color: #111; line-height: 1.6;">
          <h2 style="font-size: 22px; font-weight: 700; margin-bottom: 16px; color: #111;">დაადასტურე შენი ელფოსტა</h2>
          <p style="font-size: 15px; margin-bottom: 16px;">გამარჯობა,</p>
          <p style="font-size: 15px; margin-bottom: 24px;">UNDA ანგარიშის გასააქტიურებლად გთხოვთ დაადასტუროთ თქვენი ელფოსტის მისამართი:</p>
          <p style="margin-bottom: 24px;">
            <a href="${url}" style="display: inline-block; background-color: #000; color: #fff; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-size: 15px; font-weight: 600;">ელფოსტის დადასტურება</a>
          </p>
          <p style="font-size: 13px; color: #555; margin-bottom: 8px;">ბმული მოქმედებს 1 საათის განმავლობაში.</p>
          <p style="font-size: 13px; color: #555;">თუ ანგარიში შენ არ შეგიქმნია, შეგიძლია უგულებელყო ეს წერილი.</p>
          <hr style="border: none; border-top: 1px solid #eaeaea; margin: 32px 0 16px;" />
          <p style="font-size: 12px; color: #888;">UNDA Social Operator · <a href="${origin}" style="color: #888; text-decoration: underline;">${origin}</a></p>
        </div>`,
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
      user: {
        create: {
          after: async (user) => {
            if (user.emailVerified) {
              const name = user.name ? ` ${user.name}` : ""
              await sendEmail({
                to: user.email,
                subject: "UNDA — რეგისტრაცია წარმატებით დასრულდა!",
                text: `გამარჯობა${name},\n\nმოგესალმებით UNDA-ში! შენი ანგარიში წარმატებით შეიქმნა.\n\nსამუშაო სივრცეში გადასასვლელად გახსენი ბმული:\n${origin}\n\n14-დღიანი საცდელი პერიოდი დაიწყება პირველი ბრენდის გამართვისთანავე.\n\nშეგიძლია ნებისმიერ დროს შეხვიდე Google-ით, ან ანგარიშის პარამეტრებიდან დაამატო პაროლი.\n\nპატივისცემით,\nUNDA გუნდი`,
                html: `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 24px; color: #111; line-height: 1.6;">
                  <h2 style="font-size: 22px; font-weight: 700; margin-bottom: 16px; color: #111;">მოგესალმებით UNDA-ში!</h2>
                  <p style="font-size: 15px; margin-bottom: 16px;">გამარჯობა${name},</p>
                  <p style="font-size: 15px; margin-bottom: 24px;">შენი UNDA ანგარიში წარმატებით შეიქმნა.</p>
                  <p style="margin-bottom: 24px;">
                    <a href="${origin}" style="display: inline-block; background-color: #000; color: #fff; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-size: 15px; font-weight: 600;">სამუშაო სივრცეში გადასვლა</a>
                  </p>
                  <p style="font-size: 13px; color: #555; margin-bottom: 8px;">14-დღიანი საცდელი პერიოდი დაიწყება პირველი ბრენდის გამართვისთანავე. შეგიძლია ნებისმიერ დროს შეხვიდე Google-ით ან ანგარიშის პარამეტრებიდან დაამატო პაროლი.</p>
                  <hr style="border: none; border-top: 1px solid #eaeaea; margin: 32px 0 16px;" />
                  <p style="font-size: 12px; color: #888;">UNDA Social Operator · <a href="${origin}" style="color: #888; text-decoration: underline;">${origin}</a></p>
                </div>`,
              }).catch((error) => console.error("Welcome email delivery failed:", error))
            }
          },
        },
        update: {
          after: async (user, ctx) => {
            if (ctx?.path === "/verify-email" && user.emailVerified) {
              const name = user.name ? ` ${user.name}` : ""
              await sendEmail({
                to: user.email,
                subject: "UNDA — რეგისტრაცია წარმატებით დასრულდა!",
                text: `გამარჯობა${name},\n\nშენი UNDA ანგარიში წარმატებით გააქტიურდა.\n\nშესვლა შეგიძლია ბმულიდან:\n${origin}/login\n\n14-დღიანი საცდელი პერიოდი დაიწყება პირველი ბრენდის გამართვისთანავე.\n\nთუ რაიმე შეკითხვა გაგიჩნდება, მოგვწერე ნებისმიერ დროს.\n\nპატივისცემით,\nUNDA გუნდი`,
                html: `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 24px; color: #111; line-height: 1.6;">
                  <h2 style="font-size: 22px; font-weight: 700; margin-bottom: 16px; color: #111;">მოგესალმებით UNDA-ში!</h2>
                  <p style="font-size: 15px; margin-bottom: 16px;">გამარჯობა${name},</p>
                  <p style="font-size: 15px; margin-bottom: 24px;">შენი ანგარიში წარმატებით გააქტიურდა და ელფოსტა დადასტურებულია.</p>
                  <p style="margin-bottom: 24px;">
                    <a href="${origin}/login" style="display: inline-block; background-color: #000; color: #fff; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-size: 15px; font-weight: 600;">სამუშაო სივრცეში შესვლა</a>
                  </p>
                  <p style="font-size: 13px; color: #555; margin-bottom: 8px;">14-დღიანი საცდელი პერიოდი დაიწყება პირველი ბრენდის გამართვისთანავე.</p>
                  <p style="font-size: 13px; color: #555;">თუ რაიმე შეკითხვა გაგიჩნდება, მოგვწერე ნებისმიერ დროს.</p>
                  <hr style="border: none; border-top: 1px solid #eaeaea; margin: 32px 0 16px;" />
                  <p style="font-size: 12px; color: #888;">UNDA Social Operator · <a href="${origin}" style="color: #888; text-decoration: underline;">${origin}</a></p>
                </div>`,
              }).catch((error) => console.error("Welcome email delivery failed:", error))
            }
          },
        },
      },
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
