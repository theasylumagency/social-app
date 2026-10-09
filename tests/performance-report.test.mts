import assert from "node:assert/strict"
import test from "node:test"
import { summarizeAttempts, latencyStats, type AttemptMetric } from "../src/application/evaluation/performance-report"
import type { ModelAttemptTelemetry } from "../src/infrastructure/models/attempt-telemetry"
const telemetry: ModelAttemptTelemetry = { version: 1, logicalCallId: "call", requestOrdinal: 1, validationAttempt: 1, kind: "initial", outcome: "provider_failure",
  startedAt: "2026-10-09T00:00:00Z", completedAt: "2026-10-09T00:00:01Z", requestDurationMs: 1000, validationDurationMs: 0,
  backoffBeforeMs: 0, requestHash: "hash", inputBytes: 100, instructionsBytes: 20, schemaBytes: 40, timeoutMs: 150000, reasoningEffort: "low", responseModel: null }
const row: AttemptMetric = { id: "1", workflow: "weekly", workflowId: "week", step: "post_review", promptVersion: "v1", model: "model", durationMs: 1000, usage: {}, validationErrors: ["timeout"], telemetry }

test("reports include failed attempts and backoff, without inventing missing cost or end-to-end quality", () => {
  const success = { ...row, id: "2", validationErrors: [], usage: { input_tokens: 100, output_tokens: 25, input_tokens_details: { cached_tokens: 50 }, output_tokens_details: { reasoning_tokens: 10 } },
    telemetry: { ...telemetry, requestOrdinal: 2, kind: "transport_retry" as const, outcome: "accepted" as const,
      startedAt: "2026-10-09T00:00:02Z", completedAt: "2026-10-09T00:00:03Z", backoffBeforeMs: 1000 } }
  const summary = summarizeAttempts([row, success])[0]!
  assert.equal(summary.requests, 2); assert.equal(summary.failedOrInvalidRequests, 1)
  assert.equal(summary.telemetry.logicalCallElapsedMs!.p50, 3000)
  assert.equal(summary.summedAttemptMs, 2000); assert.equal(summary.telemetry.backoffMs, 1000)
  assert.equal(summary.telemetry.transportRetries, 1)
  assert.equal(summary.usage.knownInputTokens, 100); assert.equal(summary.usage.missingTokenReceipts, 1)
  assert.equal(summary.monetaryCostUsd, null); assert.equal(summary.endToEndMs, null); assert.equal(summary.qualityScore, null)
  assert.equal(summarizeAttempts([success])[0]!.telemetry.completeSuccessfulLogicalCalls, 0, "truncated call cannot become a successful full-call latency")
})

test("legacy and different prompt/model settings cannot silently become comparable current evidence", () => {
  const legacy = summarizeAttempts([{ ...row, telemetry: null }])[0]!
  assert.equal(legacy.telemetry.transportRetries, null); assert.equal(legacy.telemetry.inputBytes, null)
  assert.equal(legacy.telemetry.logicalCallElapsedMs, null)
  assert.equal(summarizeAttempts([row, { ...row, id: "2", promptVersion: "v2" }, { ...row, id: "3", model: "other" }, { ...row, id: "4", telemetry: null }]).length, 4)
  assert.throws(() => summarizeAttempts([row, row]), /DUPLICATE/)
  assert.equal(latencyStats([]), null); assert.throws(() => latencyStats([NaN]), /INVALID/)
  assert.equal(latencyStats([1, 4, 3, 2])!.p50, 2)
})
