export const DASHBOARD_SECTIONS = ["week", "content", "results", "brand", "connections", "settings"] as const
export type DashboardSection = typeof DASHBOARD_SECTIONS[number]

export type DashboardBrand = {
  id: string
  name: string
  createdAt: string
  ready: boolean
  knowledge: Record<string, unknown>
}

export type DashboardSource = {
  id: string
  kind: string
  url: string | null
  capturedAt: string | null
}

export type WeeklyBrief = { objective: string; updatedAt: string } | null

export function knowledgeText(knowledge: Record<string, unknown>, key: string): string {
  const value = knowledge[key]
  return typeof value === "string" ? value : ""
}

export function knowledgeList(knowledge: Record<string, unknown>, key: string): string[] {
  const value = knowledge[key]
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : []
}

export function selectBrand(brands: readonly DashboardBrand[], preferredId?: string): DashboardBrand | undefined {
  return brands.find((brand) => brand.id === preferredId) ?? brands[0]
}

// Weeks are calendar dates in the workspace timezone, independent of server/browser locale.
export function currentWeek(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tbilisi", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(now)
  const part = (name: string) => parts.find((item) => item.type === name)?.value
  const day = new Date(`${part("year")}-${part("month")}-${part("day")}T12:00:00Z`)
  day.setUTCDate(day.getUTCDate() - (day.getUTCDay() + 6) % 7)
  return day.toISOString().slice(0, 10)
}

export function shiftWeek(week: string, amount: number): string {
  const date = new Date(`${week}T12:00:00Z`)
  date.setUTCDate(date.getUTCDate() + amount * 7)
  return date.toISOString().slice(0, 10)
}

export function isWeek(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(`${value}T12:00:00Z`)
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value && date.getUTCDay() === 1
}

export function displayDate(value: string, options: Intl.DateTimeFormatOptions = {}): string {
  return new Intl.DateTimeFormat("ka-GE", {
    day: "numeric", month: "long", timeZone: "Asia/Tbilisi", ...options,
  }).format(new Date(value.length === 10 ? `${value}T12:00:00Z` : value))
}

export function weekLabel(week: string): string {
  const end = new Date(`${week}T12:00:00Z`)
  end.setUTCDate(end.getUTCDate() + 6)
  const start = new Date(`${week}T12:00:00Z`)
  return start.getUTCMonth() === end.getUTCMonth()
    ? `${start.getUTCDate()} – ${displayDate(end.toISOString())}`
    : `${displayDate(week)} – ${displayDate(end.toISOString())}`
}

export function safeSourceUrl(value: unknown): string | null {
  if (typeof value !== "string") return null
  try {
    const url = new URL(value)
    return ["https:", "http:"].includes(url.protocol) ? url.href : null
  } catch { return null }
}
