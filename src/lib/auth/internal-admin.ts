export function internalAdminEmails(value = process.env.UNDA_ADMIN_EMAILS): Set<string> {
  return new Set((value ?? "").split(",").map((email) => email.trim().toLocaleLowerCase("en-US")).filter(Boolean))
}

export function isInternalAdminEmail(email: string | null | undefined, configured = internalAdminEmails()): boolean {
  return typeof email === "string" && configured.has(email.trim().toLocaleLowerCase("en-US"))
}
