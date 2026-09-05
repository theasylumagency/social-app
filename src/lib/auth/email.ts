import { randomUUID } from "node:crypto"
import { mkdir, writeFile } from "node:fs/promises"
import path from "node:path"
import nodemailer from "nodemailer"

export type AuthEmail = { to: string; subject: string; text: string }
export type SendAuthEmail = (message: AuthEmail) => Promise<void>

export function createEmailSender(env: NodeJS.ProcessEnv = process.env): SendAuthEmail {
  if (env.AUTH_EMAIL_MODE === "preview" && env.NODE_ENV !== "production") {
    return async (message) => {
      const directory = path.join(process.cwd(), ".local", "auth-mail")
      await mkdir(directory, { recursive: true })
      await writeFile(path.join(directory, `${Date.now()}-${randomUUID()}.json`), JSON.stringify(message, null, 2), { mode: 0o600 })
    }
  }
  if (!env.SMTP_HOST || !env.SMTP_FROM) throw new Error("Configure SMTP_HOST and SMTP_FROM for authentication emails")
  const from = env.SMTP_FROM
  const port = Number(env.SMTP_PORT || "587")
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("Invalid SMTP_PORT")
  const transport = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port,
    secure: port === 465,
    requireTLS: port !== 465,
    ...(env.SMTP_USER && env.SMTP_PASSWORD ? { auth: { user: env.SMTP_USER, pass: env.SMTP_PASSWORD } } : {}),
    connectionTimeout: 10_000,
    socketTimeout: 20_000,
  })
  return async (message) => {
    await transport.sendMail({ from, ...message })
  }
}
