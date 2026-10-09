import type { ScheduleTimeContext } from "./schedule-time"
export const scheduleIdentifier = (value: unknown): string => {
  if (typeof value !== "string" || !value.trim() || value.length > 160) throw Error("განრიგის მოთხოვნა არასწორია.")
  return value
}
export function scheduleTimeContext(value: unknown): ScheduleTimeContext {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw Error("მიუთითეთ დრო და სარტყელი.")
  const v = value as Record<string, unknown>
  if (typeof v.timeZone !== "string" || typeof v.localDateTime !== "string" || (v.disambiguation !== null && v.disambiguation !== "earlier" && v.disambiguation !== "later")) throw Error("მიუთითეთ დრო და სარტყელი.")
  return { timeZone: v.timeZone, localDateTime: v.localDateTime, disambiguation: v.disambiguation }
}
export function scheduleChangeRequest(input: Record<string, unknown>) {
  const brandId = scheduleIdentifier(input.brandId), scheduleId = scheduleIdentifier(input.scheduleId)
  if (typeof input.operationId !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu.test(input.operationId)
    || !Number.isSafeInteger(input.expectedRevision) || (input.expectedRevision as number) < 0) throw Error("განრიგის ცვლილების მოთხოვნა არასწორია.")
  return { brandId, scheduleId, operationId: `schedule-event:${input.operationId}`, expectedRevision: input.expectedRevision as number }
}
