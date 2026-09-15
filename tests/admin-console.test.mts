import assert from "node:assert/strict"
import test from "node:test"

import {
  deriveWorkspaceHealth,
  interventionsFromCustomers,
  subscriptionLifecycle,
  type AdminCustomer,
} from "../src/application/admin-console/model"
import { internalAdminEmails, isInternalAdminEmail } from "../src/lib/auth/internal-admin"

const now = new Date("2026-09-15T10:00:00.000Z")

test("internal admin allowlist is explicit, trimmed, and case insensitive", () => {
  const configured = internalAdminEmails(" Ops@UNDA.pro, founder@unda.pro ,")
  assert.equal(isInternalAdminEmail("ops@unda.pro", configured), true)
  assert.equal(isInternalAdminEmail("FOUNDER@UNDA.PRO", configured), true)
  assert.equal(isInternalAdminEmail("customer@example.com", configured), false)
  assert.equal(isInternalAdminEmail("ops@unda.pro", internalAdminEmails("")), false)
})

test("subscription lifecycle only reports states evidenced by stored dates", () => {
  assert.equal(subscriptionLifecycle(null, now), "none")
  assert.equal(subscriptionLifecycle({ paidAt: new Date("2026-09-01T00:00:00Z"), expiresAt: new Date("2026-10-01T00:00:00Z") }, now), "active")
  assert.equal(subscriptionLifecycle({ paidAt: new Date("2026-08-01T00:00:00Z"), expiresAt: new Date("2026-09-01T00:00:00Z") }, now), "expired")
})

test("workspace health is explainable and blocking reasons take precedence", () => {
  const health = deriveWorkspaceHealth({
    hasWorkspace: true, brandCount: 1, readyBrandCount: 1, subscriptionLifecycle: "expired",
    connectionIssueCount: 1, affectedScheduleCount: 2, unknownOutcomeCount: 0,
    failedPublicationCount: 0, analyticsLastObservedAt: null,
    workflowFailureCount: 0,
    lastMeaningfulActivityAt: "2026-09-15T09:00:00.000Z", now,
  })
  assert.equal(health.status, "blocked")
  assert.deepEqual(health.reasons.map((reason) => reason.code), ["subscriptionInactive", "publishingConnectionUnavailable"])
  assert.equal(health.reasons[1]?.priority, "urgent")
})

test("stale analytics is informational and does not enter the intervention queue", () => {
  const health = deriveWorkspaceHealth({
    hasWorkspace: true, brandCount: 1, readyBrandCount: 1, subscriptionLifecycle: "active",
    connectionIssueCount: 0, affectedScheduleCount: 0, unknownOutcomeCount: 0,
    failedPublicationCount: 0, analyticsLastObservedAt: "2026-09-10T00:00:00.000Z",
    workflowFailureCount: 0,
    lastMeaningfulActivityAt: "2026-09-15T09:00:00.000Z", now,
  })
  assert.equal(health.status, "needsAttention")
  assert.equal(health.reasons[0]?.interventionWorthy, false)

  const customer: AdminCustomer = {
    id: "customer-1", name: "Customer", email: "customer@example.com", emailVerified: true,
    joinedAt: "2026-09-01T00:00:00.000Z", workspaceId: "workspace-1", workspaceCreatedAt: "2026-09-01T00:00:00.000Z",
    brandIds: ["brand-1"], brandNames: ["Brand"], readyBrandCount: 1,
    subscription: { lifecycle: "active", plan: "solo", paidAt: "2026-09-01T00:00:00.000Z", expiresAt: "2026-10-01T00:00:00.000Z", paymentCount: 1 },
    health: health.status, healthReasons: health.reasons, lastMeaningfulActivityAt: "2026-09-15T09:00:00.000Z",
    affectedScheduleCount: 0, unknownOutcomeCount: 0, failedPublicationCount: 0, workflowFailureCount: 0, analyticsLastObservedAt: "2026-09-10T00:00:00.000Z",
  }
  assert.deepEqual(interventionsFromCustomers([customer]), [])
})

test("a failed current workflow blocks the workspace with an actionable reason", () => {
  const health = deriveWorkspaceHealth({
    hasWorkspace: true, brandCount: 1, readyBrandCount: 1, subscriptionLifecycle: "active",
    connectionIssueCount: 0, affectedScheduleCount: 0, unknownOutcomeCount: 0,
    failedPublicationCount: 0, workflowFailureCount: 1, analyticsLastObservedAt: null,
    lastMeaningfulActivityAt: "2026-09-15T09:00:00.000Z", now,
  })
  assert.equal(health.status, "blocked")
  assert.equal(health.reasons[0]?.code, "workflowFailure")
  assert.equal(health.reasons[0]?.interventionWorthy, true)
})
