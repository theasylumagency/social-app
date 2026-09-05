const assert = require("node:assert/strict")
const test = require("node:test")
const { currentWeek, shiftWeek, isWeek, selectBrand, safeSourceUrl } = require("../dist/application/dashboard/model.js")

test("workspace weeks follow Tbilisi midnight, including year boundaries", () => {
  assert.equal(currentWeek(new Date("2026-09-06T19:59:59Z")), "2026-08-31")
  assert.equal(currentWeek(new Date("2026-09-06T20:00:00Z")), "2026-09-07")
  assert.equal(currentWeek(new Date("2027-01-01T00:00:00Z")), "2026-12-28")
  assert.equal(shiftWeek("2026-12-28", 1), "2027-01-04")
  assert.equal(isWeek("2026-08-31"), true)
  for (const invalid of ["2026-09-05", "2026-02-30", "bad", "", ["2026-08-31"]]) assert.equal(isWeek(invalid), false)
})

test("brand selection never trusts a stale or foreign preference", () => {
  const brands = [{ id: "own-one" }, { id: "own-two" }]
  assert.equal(selectBrand(brands, "own-two"), brands[1])
  assert.equal(selectBrand(brands, "foreign-brand"), brands[0])
  assert.equal(selectBrand(brands), brands[0])
  assert.equal(selectBrand([], "own-one"), undefined)
  assert.equal(safeSourceUrl("javascript:alert(1)"), null)
  assert.equal(safeSourceUrl("data:text/html,<h1>hello</h1>"), null)
  assert.equal(safeSourceUrl("https://example.com"), "https://example.com/")
})
