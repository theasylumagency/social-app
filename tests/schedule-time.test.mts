import assert from "node:assert/strict"
import test from "node:test"
import { localScheduleTime, resolveScheduleTime, scheduleTimeCandidates, suggestedScheduleTime } from "../src/application/publishing/schedule-time"
import { scheduleChangeRequest, scheduleTimeContext } from "../src/application/publishing/schedule-request"
const resolve = (localDateTime: string, timeZone: string, disambiguation: "earlier" | "later" | null = null) => resolveScheduleTime({ localDateTime, timeZone, disambiguation })
test("explicit IANA scheduling uses the chosen zone regardless of browser or server timezone", () => {
  assert.equal(resolve("2030-01-07T12:00", "Asia/Tbilisi"), "2030-01-07T08:00:00.000Z")
  assert.equal(resolve("2030-01-07T12:00", "UTC"), "2030-01-07T12:00:00.000Z")
  assert.equal(resolve("2030-01-07T12:00", "Asia/Kathmandu"), "2030-01-07T06:15:00.000Z")
  assert.equal(localScheduleTime("2030-01-07T08:00:00Z", "Asia/Tbilisi"), "2030-01-07T12:00")
})
test("nonexistent DST hours cannot be silently shifted", () => {
  assert.deepEqual(scheduleTimeCandidates("2026-03-08T02:30", "America/New_York"), [])
  assert.throws(() => resolve("2026-03-08T02:30", "America/New_York"), /არ არსებობს/u)
  assert.deepEqual(scheduleTimeCandidates("2026-03-29T02:30", "Europe/Berlin"), [])
})
test("repeated DST hours require an explicit choice, including half-hour transitions", () => {
  assert.deepEqual(scheduleTimeCandidates("2026-11-01T01:30", "America/New_York"), ["2026-11-01T05:30:00.000Z", "2026-11-01T06:30:00.000Z"])
  assert.throws(() => resolve("2026-11-01T01:30", "America/New_York"), /ორჯერ/u)
  assert.equal(resolve("2026-11-01T01:30", "America/New_York", "later"), "2026-11-01T06:30:00.000Z")
  assert.equal(resolve("2026-11-01T01:30", "America/New_York", "earlier"), "2026-11-01T05:30:00.000Z")
  assert.deepEqual(scheduleTimeCandidates("2026-04-05T01:45", "Australia/Lord_Howe"), ["2026-04-04T14:45:00.000Z", "2026-04-04T15:15:00.000Z"])
})
test("invalid dates, zones and missing disambiguation metadata are rejected", () => {
  for (const date of ["2026-02-29T12:00", "2026-01-01T24:00", "2026-13-01T12:00", "2026-01-01T12:60", "2026-01-01 12:00"]) assert.throws(() => resolve(date, "Asia/Tbilisi"))
  for (const zone of ["", "Unknown/Place", "+04", "+04:00"]) assert.throws(() => resolve("2030-01-01T12:00", zone))
  assert.throws(() => scheduleTimeContext({ timeZone: "UTC", localDateTime: "2030-01-01T12:00" }))
  assert.throws(() => scheduleChangeRequest({ brandId: "brand", scheduleId: "s", operationId: "x", expectedRevision: 0 }))
  assert.throws(() => scheduleChangeRequest({ brandId: "brand", scheduleId: "s", operationId: "f26e6c0a-86d4-40c2-80d8-107ca989f6d8", expectedRevision: -1 }))
})
test("suggested times respect the proposed local day and move elapsed times into the future", () => {
  assert.equal(suggestedScheduleTime("2030-01-07", 2, "Asia/Tbilisi", "2030-01-07T09:00:00Z"), "2030-01-09T12:00")
  assert.equal(suggestedScheduleTime("2026-01-05", 0, "Asia/Tbilisi", "2030-01-07T09:00:00Z"), "2030-01-08T12:00")
  assert.equal(suggestedScheduleTime("2026-01-05", 0, "America/New_York", "2030-01-07T01:00:00Z"), "2030-01-07T12:00")
})
