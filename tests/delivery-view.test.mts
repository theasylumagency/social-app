import assert from "node:assert/strict"
import test from "node:test"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { JSDOM } from "jsdom"
import { deliveryItem, loadDeliverySnapshot, type DeliveryAttempt, type DeliveryRecord } from "../src/application/publishing/delivery-view"
import { DeliveryStatus } from "../src/app/workspace/delivery-status"

const now = "2026-09-15T12:00:00.000Z"
const recent = "2026-09-15T11:59:00.000Z"
const old = "2026-09-15T11:00:00.000Z"
const future = "2026-09-15T13:00:00.000Z"
const policy = { enabled: true, maxAttempts: 3, graceMs: 120_000 }
const record: DeliveryRecord = { id: "s1", week: "2026-09-14", runId: "run", version: 2, postKey: "p1", channel: "facebook", accountName: "Page", publishAt: future, cancelled: false, canPublish: true, attempts: [] }
const attempt: DeliveryAttempt = { number: 1, attemptedAt: recent, requestState: "prepared", result: null, recordedAt: null, retryAfter: null, publishedAt: null, reconciliation: null, reconciledAt: null, reconciledPublishedAt: null, failureType: null }
const project = (changes: Partial<DeliveryRecord>, attempts: Partial<DeliveryAttempt>[] = []) => deliveryItem({ ...record, ...changes, attempts: attempts.map((a) => ({ ...attempt, ...a })) }, policy, now)

test("scheduled, due and overdue work distinguish time from confirmed execution", () => {
  assert.equal(project({}).state, "scheduled")
  assert.equal(project({ publishAt: recent }).state, "queued")
  assert.equal(project({ publishAt: old }).state, "delayed")
  assert.equal(project({}, [{}]).state, "sending")
  assert.equal(project({}, [{ attemptedAt: old }]).state, "delayed")
  assert.equal(project({ canPublish: false }).state, "disconnected")
  assert.equal(deliveryItem(record, { ...policy, enabled: false }, now).state, "disabled")
  assert.equal(deliveryItem(record, null, now).state, "unavailable")
})

test("accepted and ambiguous dispatch are never publication; repeated inconclusive checks do not reset age", () => {
  for (const requestState of ["dispatchStarted", "responseReceived"] as const) {
    assert.equal(project({}, [{ requestState }]).state, "confirming")
    assert.equal(project({}, [{ requestState, attemptedAt: old }]).state, "unconfirmed")
  }
  const unknown = { result: "unknownOutcome" as const, recordedAt: old, reconciliation: "inconclusive" as const, reconciledAt: recent }
  assert.equal(project({}, [unknown]).state, "unconfirmed")
  assert.equal(project({ cancelled: true }, [unknown]).state, "unconfirmed")
  assert.equal(project({ cancelled: true }, []).state, "cancelled")
})

test("only confirmed results count as publication, even after cancellation or binding loss", () => {
  for (const evidence of [{ result: "published" as const, publishedAt: old }, { result: "unknownOutcome" as const, reconciliation: "publicationFound" as const, reconciledPublishedAt: old }]) {
    const item = project({ cancelled: true, canPublish: false }, [evidence])
    assert.equal(item.state, "published")
    assert.equal(item.publishedAt, old)
  }
  const anomaly = project({}, [{ result: "published", publishedAt: old }, { number: 2, result: "unknownOutcome", recordedAt: old }])
  assert.equal(anomaly.state, "published")
  assert.equal(anomaly.attention, true, "a second unresolved dispatch must stay visible")
})

test("retry timing, final failures, attempt exhaustion and terminal reconciliation remain distinct", () => {
  assert.equal(project({ publishAt: old }, [{ result: "retryableFailure", recordedAt: old, retryAfter: future }]).state, "retrying")
  assert.equal(project({ publishAt: future }, [{ result: "retryableFailure", recordedAt: old }]).state, "retrying", "rescheduling defers the retry")
  assert.equal(project({ publishAt: old }, [{ result: "retryableFailure", recordedAt: old }]).state, "delayed")
  assert.equal(project({}, [{ result: "permanentFailure" }]).state, "failed")
  assert.equal(project({}, [{ number: 3, result: "retryableFailure" }]).state, "failed")
  assert.equal(project({}, [{ result: "unknownOutcome", reconciliation: "publicationFailed", failureType: "permanent" }]).state, "failed")
  assert.equal(project({}, [{ result: "unknownOutcome", reconciliation: "confirmedAbsent", reconciledAt: recent }]).state, "retrying")
  assert.equal(project({ cancelled: true }, [{ result: "retryableFailure" }]).state, "cancelled")
})

test("failed reads and unavailable configuration cannot appear as a successful empty queue", async () => {
  const snapshot = await loadDeliverySnapshot(async () => { throw new Error("private provider information") }, policy, now)
  assert.deepEqual(snapshot, { availability: "unavailable", checkedAt: now })
  const html = renderToStaticMarkup(createElement(DeliveryStatus, { snapshot }))
  assert.match(html, /მდგომარეობა ვერ გადამოწმდა/)
  assert.doesNotMatch(html, /private provider/)
  const empty = await loadDeliverySnapshot(async () => [], null, now)
  assert.equal(empty.availability === "available" && empty.publishingEnabled, null)
})

test("content scopes schedules by source week; attention is expanded and publication history is collapsed", () => {
  const items = [project({}, [{ result: "published", publishedAt: old }]), project({ id: "s2", publishAt: old }), project({ id: "s3", week: "2026-09-07", accountName: "Other week" })]
  const snapshot = { availability: "available" as const, checkedAt: now, publishingEnabled: true, items }
  const doc = new JSDOM(renderToStaticMarkup(createElement(DeliveryStatus, { snapshot, week: record.week }))).window.document
  assert.equal(doc.querySelectorAll(".delivery-row").length, 2)
  assert.equal(doc.querySelector<HTMLDetailsElement>(".delivery-issues")!.open, true)
  assert.equal(doc.querySelector<HTMLDetailsElement>(".delivery-history")!.open, false)
  assert.doesNotMatch(doc.body.textContent!, /Other week/)
  assert.match(doc.querySelector(".delivery-row a")!.getAttribute("href")!, /week=2026-09-14/)
})
