const assert = require("node:assert/strict")
const test = require("node:test")

const {
  createConfidenceScore,
  createIsoDate,
  createIsoDateTime,
  createPriorityScore,
  isIsoDate,
  isIsoDateTime,
} = require("../dist/core/domain/index.js")

test("score constructors accept the inclusive 0-100 range", () => {
  assert.equal(createConfidenceScore(0), 0)
  assert.equal(createConfidenceScore(42.5), 42.5)
  assert.equal(createPriorityScore(100), 100)
})

test("score constructors reject out-of-range and non-finite values", () => {
  for (const value of [-1, 101, Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.throws(() => createConfidenceScore(value), RangeError)
    assert.throws(() => createPriorityScore(value), RangeError)
  }
})

test("ISO date construction validates calendar dates", () => {
  assert.equal(createIsoDate("2024-02-29"), "2024-02-29")
  assert.equal(isIsoDate("2024-02-29"), true)
  assert.equal(isIsoDate("2023-02-29"), false)
  assert.throws(() => createIsoDate("2023-02-29"), RangeError)
})

test("ISO date-time construction validates date and time components", () => {
  assert.equal(
    createIsoDateTime("2026-09-04T12:30:45.123+04:00"),
    "2026-09-04T12:30:45.123+04:00",
  )
  assert.equal(isIsoDateTime("2026-09-04T08:30:45Z"), true)
  assert.equal(isIsoDateTime("2026-02-30T08:30:45Z"), false)
  assert.equal(isIsoDateTime("2026-09-04T25:00:00Z"), false)
})
