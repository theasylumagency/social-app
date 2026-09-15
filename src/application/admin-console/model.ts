export const ADMIN_SECTIONS = ["overview", "customers", "interventions", "subscriptions", "communication", "audit"] as const

export type AdminSection = typeof ADMIN_SECTIONS[number]
export type WorkspaceHealth = "healthy" | "needsAttention" | "blocked" | "inactive"
export type SubscriptionLifecycle = "active" | "expired" | "none"
export type InterventionPriority = "urgent" | "normal" | "low"

export type HealthReasonCode =
  | "workspaceMissing"
  | "onboardingIncomplete"
  | "subscriptionInactive"
  | "publishingConnectionUnavailable"
  | "workflowFailure"
  | "publishingOutcomeUnknown"
  | "publishingFailure"
  | "analyticsStale"
  | "noRecentActivity"

export type HealthReason = {
  code: HealthReasonCode
  label: string
  detail: string
  priority: InterventionPriority
  interventionWorthy: boolean
}

export type AdminCustomer = {
  id: string
  name: string
  email: string
  emailVerified: boolean
  joinedAt: string
  workspaceId: string | null
  workspaceCreatedAt: string | null
  brandIds: string[]
  brandNames: string[]
  readyBrandCount: number
  subscription: {
    lifecycle: SubscriptionLifecycle
    plan: string | null
    paidAt: string | null
    expiresAt: string | null
    paymentCount: number
  }
  health: WorkspaceHealth
  healthReasons: HealthReason[]
  lastMeaningfulActivityAt: string
  affectedScheduleCount: number
  unknownOutcomeCount: number
  failedPublicationCount: number
  workflowFailureCount: number
  analyticsLastObservedAt: string | null
}

export type AdminIntervention = {
  id: string
  customerId: string
  customerName: string
  workspaceId: string | null
  workspaceName: string
  reason: HealthReason
  detectedAt: string
  affectedCapability: string
  affectedCount: number
}

export type AdminAuditEvent = {
  id: string
  occurredAt: string
  category: "subscription" | "onboarding" | "connection" | "publishing"
  title: string
  detail: string
  customerId: string
  customerName: string
  actor: string
}

export const adminSectionLabels: Record<AdminSection, string> = {
  overview: "მიმოხილვა",
  customers: "კლიენტები",
  interventions: "ჩარევები",
  subscriptions: "გამოწერები",
  communication: "კომუნიკაცია",
  audit: "აუდიტი",
}

export const workspaceHealthLabels: Record<WorkspaceHealth, string> = {
  healthy: "გამართული",
  needsAttention: "საჭიროებს ყურადღებას",
  blocked: "დაბლოკილია",
  inactive: "არააქტიური",
}

export const subscriptionLifecycleLabels: Record<SubscriptionLifecycle, string> = {
  active: "აქტიური",
  expired: "ვადაგასული",
  none: "გამოწერის გარეშე",
}

export const planLabels: Record<string, string> = {
  solo: "Single",
  studio: "Manager",
  agency: "Agency",
  custom: "Custom",
}

type HealthInput = {
  hasWorkspace: boolean
  brandCount: number
  readyBrandCount: number
  subscriptionLifecycle: SubscriptionLifecycle
  connectionIssueCount: number
  affectedScheduleCount: number
  unknownOutcomeCount: number
  failedPublicationCount: number
  workflowFailureCount: number
  analyticsLastObservedAt: string | null
  lastMeaningfulActivityAt: string
  now?: Date
}

const HOUR = 60 * 60 * 1000
const DAY = 24 * HOUR

export function subscriptionLifecycle(
  subscription: { paidAt: Date | null; expiresAt: Date | null } | null,
  now = new Date(),
): SubscriptionLifecycle {
  if (!subscription?.paidAt || !subscription.expiresAt) return "none"
  return subscription.paidAt.getTime() <= now.getTime() && subscription.expiresAt.getTime() > now.getTime()
    ? "active"
    : "expired"
}

export function deriveWorkspaceHealth(input: HealthInput): { status: WorkspaceHealth; reasons: HealthReason[] } {
  const now = input.now ?? new Date()
  const reasons: HealthReason[] = []

  if (!input.hasWorkspace) reasons.push({
    code: "workspaceMissing", label: "სამუშაო სივრცე არ შექმნილა",
    detail: "ანგარიშს სამუშაო სივრცე ჯერ არ აქვს.", priority: "normal", interventionWorthy: true,
  })
  if (input.hasWorkspace && (input.brandCount === 0 || input.readyBrandCount < input.brandCount)) reasons.push({
    code: "onboardingIncomplete", label: "Onboarding დაუსრულებელია",
    detail: input.brandCount === 0 ? "სამუშაო სივრცეში ბრენდი ჯერ არ შექმნილა." : "ბრენდის ცოდნის საწყისი ეტაპი დასრულებული არ არის.",
    priority: "normal", interventionWorthy: true,
  })
  if (input.subscriptionLifecycle !== "active") reasons.push({
    code: "subscriptionInactive", label: input.subscriptionLifecycle === "expired" ? "გამოწერას ვადა გაუვიდა" : "აქტიური გამოწერა არ არის",
    detail: "Subscription მდგომარეობა სამუშაო პროცესის გაგრძელებას ზღუდავს.", priority: "normal", interventionWorthy: true,
  })
  if (input.connectionIssueCount > 0) reasons.push({
    code: "publishingConnectionUnavailable", label: "გამომცემლობის კავშირი მიუწვდომელია",
    detail: input.affectedScheduleCount > 0
      ? `${input.affectedScheduleCount} დაგეგმილი პუბლიკაცია შეიძლება დაზიანდეს.`
      : "Facebook-ის ან Instagram-ის კავშირი შემოწმებას საჭიროებს.",
    priority: input.affectedScheduleCount > 0 ? "urgent" : "normal", interventionWorthy: true,
  })
  if (input.workflowFailureCount > 0) reasons.push({
    code: "workflowFailure", label: "სამუშაო პროცესი შეცდომით დასრულდა",
    detail: `${input.workflowFailureCount} ბრენდის მიმდინარე workflow საჭიროებს დიაგნოსტიკას ან მხარდაჭერილ recovery მოქმედებას.`,
    priority: "normal", interventionWorthy: true,
  })
  if (input.unknownOutcomeCount > 0) reasons.push({
    code: "publishingOutcomeUnknown", label: "პუბლიკაციის შედეგი დაუდგენელია",
    detail: `${input.unknownOutcomeCount} გაგზავნის საბოლოო მდგომარეობა დაზუსტებას ელოდება. ხელახლა გაგზავნა reconciliation-მდე არ შეიძლება.`,
    priority: "urgent", interventionWorthy: true,
  })
  if (input.failedPublicationCount > 0) reasons.push({
    code: "publishingFailure", label: "გამოქვეყნება ვერ დასრულდა",
    detail: `${input.failedPublicationCount} წარუმატებელი პუბლიკაცია საჭიროებს დიაგნოსტიკას.`,
    priority: "normal", interventionWorthy: true,
  })
  if (input.analyticsLastObservedAt && now.getTime() - Date.parse(input.analyticsLastObservedAt) > 3 * DAY) reasons.push({
    code: "analyticsStale", label: "ანალიტიკა დაგვიანებულია",
    detail: "უახლესი დაკვირვება 72 საათზე ძველია.", priority: "low", interventionWorthy: false,
  })

  const blockingReason = reasons.some((reason) =>
    reason.code === "workspaceMissing"
      || reason.code === "onboardingIncomplete"
      || reason.code === "subscriptionInactive"
      || reason.code === "workflowFailure"
      || (reason.code === "publishingConnectionUnavailable" && input.affectedScheduleCount > 0),
  )
  if (blockingReason) return { status: "blocked", reasons }
  if (reasons.length > 0) return { status: "needsAttention", reasons }

  if (now.getTime() - Date.parse(input.lastMeaningfulActivityAt) > 30 * DAY) {
    return {
      status: "inactive",
      reasons: [{
        code: "noRecentActivity", label: "ბოლო 30 დღეში აქტივობა არ ყოფილა",
        detail: "არააქტიური მდგომარეობა ავტომატურად პრობლემას ან churn-ს არ ნიშნავს.",
        priority: "low", interventionWorthy: false,
      }],
    }
  }
  return { status: "healthy", reasons: [] }
}

export function customerWorkspaceName(customer: Pick<AdminCustomer, "brandNames">) {
  return customer.brandNames.length > 0 ? customer.brandNames.join(", ") : "ბრენდის გარეშე"
}

export function interventionsFromCustomers(customers: readonly AdminCustomer[]): AdminIntervention[] {
  return customers.flatMap((customer) => customer.healthReasons
    .filter((reason) => reason.interventionWorthy)
    .map((reason) => ({
      id: `${customer.id}:${reason.code}`,
      customerId: customer.id,
      customerName: customer.name,
      workspaceId: customer.workspaceId,
      workspaceName: customerWorkspaceName(customer),
      reason,
      detectedAt: customer.lastMeaningfulActivityAt,
      affectedCapability: reason.code === "subscriptionInactive" ? "Subscription"
        : reason.code === "onboardingIncomplete" || reason.code === "workspaceMissing" ? "Onboarding"
          : reason.code === "workflowFailure" ? "Workflow"
          : "Publishing",
      affectedCount: reason.code === "publishingConnectionUnavailable" ? customer.affectedScheduleCount
        : reason.code === "publishingOutcomeUnknown" ? customer.unknownOutcomeCount
          : reason.code === "publishingFailure" ? customer.failedPublicationCount : 0,
    })))
    .sort((a, b) => {
      const rank: Record<InterventionPriority, number> = { urgent: 0, normal: 1, low: 2 }
      return rank[a.reason.priority] - rank[b.reason.priority] || Date.parse(b.detectedAt) - Date.parse(a.detectedAt)
    })
}

export function isAdminSection(value: string): value is AdminSection {
  return (ADMIN_SECTIONS as readonly string[]).includes(value)
}
