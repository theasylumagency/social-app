export type ScheduleTimeContext = { timeZone: string; localDateTime: string; disambiguation: "earlier" | "later" | null }
export class ScheduleTimeError extends Error {
  constructor(message: string, readonly candidates: readonly string[] = []) { super(message); this.name = "ScheduleTimeError" }
}
function formatter(timeZone: string) {
  if (typeof timeZone !== "string" || !timeZone || timeZone.length > 120 || !/^[A-Za-z][A-Za-z0-9_+\-/]*$/u.test(timeZone)) throw new ScheduleTimeError("აირჩიეთ მოქმედი IANA დროის სარტყელი.")
  try { return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }) }
  catch { throw new ScheduleTimeError("დროის სარტყელი ვერ მოიძებნა. გამოიყენეთ IANA დასახელება, მაგალითად Asia/Tbilisi.") }
}
function wallTime(date: Date, format: Intl.DateTimeFormat) {
  const parts = format.formatToParts(date), part = (key: string) => parts.find(p => p.type === key)!.value
  return `${part("year")}-${part("month")}-${part("day")}T${part("hour")}:${part("minute")}`
}
export function localScheduleTime(instant: string, timeZone: string) { return wallTime(new Date(instant), formatter(timeZone)) }

/** Round-trip all surrounding offsets; never silently shift a DST gap or choose a repeated hour. */
export function scheduleTimeCandidates(localDateTime: string, timeZone: string): string[] {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/u.test(localDateTime)) throw new ScheduleTimeError("მიუთითეთ ზუსტი თარიღი და დრო.")
  const naive = Date.parse(localDateTime + ":00.000Z")
  if (!Number.isFinite(naive) || new Date(naive).toISOString().slice(0, 16) !== localDateTime) throw new ScheduleTimeError("თარიღი ან საათი არასწორია.")
  const format = formatter(timeZone), offsets = new Set<number>()
  for (let hours = -36; hours <= 36; hours += 6) {
    const probe = naive + hours * 3_600_000
    offsets.add(Date.parse(wallTime(new Date(probe), format) + ":00.000Z") - probe)
  }
  return [...offsets].map(offset => new Date(naive - offset).toISOString())
    .filter(candidate => wallTime(new Date(candidate), format) === localDateTime).sort()
}
export function resolveScheduleTime(context: ScheduleTimeContext) {
  const candidates = scheduleTimeCandidates(context.localDateTime, context.timeZone)
  if (!candidates.length) throw new ScheduleTimeError("ამ სარტყელში ასეთი საათი არ არსებობს საათის ცვლილების გამო. აირჩიეთ სხვა დრო.")
  if (context.disambiguation !== null && context.disambiguation !== "earlier" && context.disambiguation !== "later") throw new ScheduleTimeError("განმეორებული საათის არჩევანი არასწორია.")
  if (candidates.length > 1 && !context.disambiguation) throw new ScheduleTimeError("ეს საათი ორჯერ გვხვდება. აირჩიეთ პირველი ან მეორე დრო.", candidates)
  return context.disambiguation === "later" ? candidates.at(-1)! : candidates[0]!
}
export function suggestedScheduleTime(week: string, dayOffset: number, timeZone: string, now: string) {
  const date = new Date(`${week}T12:00:00Z`); date.setUTCDate(date.getUTCDate() + dayOffset)
  const today = localScheduleTime(now, timeZone).slice(0, 10)
  let local = `${date.toISOString().slice(0, 10) < today ? today : date.toISOString().slice(0, 10)}T12:00`
  const candidates = scheduleTimeCandidates(local, timeZone)
  if (candidates.length && Date.parse(candidates[0]!) <= Date.parse(now)) {
    const next = new Date(`${local.slice(0, 10)}T12:00:00Z`); next.setUTCDate(next.getUTCDate() + 1)
    local = `${next.toISOString().slice(0, 10)}T12:00`
  }
  return local
}
