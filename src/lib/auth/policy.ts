export const PASSWORD_MIN_LENGTH = 12
export const PASSWORD_MAX_LENGTH = 128
export const REMEMBERED_SESSION_SECONDS = 60 * 60 * 24 * 30
export const TEMPORARY_SESSION_SECONDS = 60 * 60 * 24

export function safeReturnPath(value: unknown): string {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//") || /[\\\u0000-\u0020]/.test(value)) return "/"
  const url = new URL(value, "https://app.unda.pro")
  if (url.origin !== "https://app.unda.pro" || url.pathname.startsWith("/api/") || url.pathname === "/login" || url.pathname === "/register") return "/"
  return `${url.pathname}${url.search}${url.hash}`
}

export function authErrorMessage(code: string | undefined): string {
  switch (code) {
    case "INVALID_EMAIL_OR_PASSWORD":
    case "INVALID_PASSWORD": return "ელფოსტა ან პაროლი არასწორია."
    case "EMAIL_NOT_VERIFIED": return "შესვლამდე დაადასტურე ელფოსტა — შეამოწმე მიღებული წერილი."
    case "PASSWORD_TOO_SHORT": return `პაროლი სულ მცირე ${PASSWORD_MIN_LENGTH} სიმბოლოს უნდა შეიცავდეს.`
    case "PASSWORD_TOO_LONG": return `პაროლი მაქსიმუმ ${PASSWORD_MAX_LENGTH} სიმბოლოს უნდა შეიცავდეს.`
    case "INVALID_TOKEN":
    case "invalid_token":
    case "TOKEN_EXPIRED": return "ბმული ვადაგასულია ან უკვე გამოყენებულია. მოითხოვე ახალი წერილი."
    case "account_not_linked": return "ჯერ შედი ელფოსტითა და პაროლით და დაადასტურე ელფოსტა, შემდეგ სცადე Google-ით შესვლა."
    case "access_denied": return "შესვლა გაუქმდა. შეგიძლია ხელახლა სცადო."
    case "TOO_MANY_REQUESTS": return "ძალიან ბევრი მცდელობაა. ცოტა ხანში სცადე ხელახლა."
    default: return "მოქმედება ვერ დასრულდა. სცადე ხელახლა."
  }
}
